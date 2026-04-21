import type { Express } from 'express';
import type Database from 'better-sqlite3';
import crypto from 'crypto';

// Exact subscription names that grant platform access
// (the 4 products from the project screenshot — all other Tribute products are ignored)
export const ALLOWED_SUBSCRIPTIONS = [
  'VIP подписка Ассоциации SCA',
  'Вступление в SCA 🍑',
  'Вступление в Ассоциацию тренеров по плаванию 🍑',
  'Вступление в ACA 🍑',
];

type Logger = {
  info: (obj: any, msg?: string) => void;
  warn: (obj: any, msg?: string) => void;
  error: (obj: any, msg?: string) => void;
};

export function ensureTributeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tribute_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT UNIQUE,
      source TEXT NOT NULL,            -- 'webhook' | 'xlsx'
      event_name TEXT,                 -- new_subscription | renewed_subscription | cancelled_subscription | init_payment | recurrent_payment
      telegram_user_id TEXT,
      telegram_username TEXT,
      trb_user_id TEXT,
      subscription_id TEXT,
      subscription_name TEXT,
      channel_id TEXT,
      channel_name TEXT,
      amount INTEGER,                  -- integer in minor units (kopecks) for webhook; major for xlsx — normalized to kopecks on insert
      currency TEXT,
      period TEXT,
      expires_at TEXT,
      paid_at TEXT,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tp_tg ON tribute_payments(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_tp_sub ON tribute_payments(subscription_name);
    CREATE INDEX IF NOT EXISTS idx_tp_expires ON tribute_payments(expires_at);

    CREATE TABLE IF NOT EXISTS tribute_poll_state (
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `);

  // Users: add optional profile columns
  for (const sql of [
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE users ADD COLUMN first_name TEXT",
    "ALTER TABLE users ADD COLUMN last_name TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL",
    "ALTER TABLE tribute_payments ADD COLUMN period_days INTEGER",
  ]) {
    try { db.exec(sql); } catch {}
  }
}

/**
 * Recompute a user's tier based on tribute_payments matched by their telegram_id.
 * If there is any ALLOWED_SUBSCRIPTIONS payment with expires_at in the future
 * (and the most recent event for that subscription is not a cancellation),
 * user is 'premium' and subscription_expires_at = max(expires_at).
 */
export function recomputeUserTier(db: Database.Database, userId: string): { tier: string; expiresAt: string | null } {
  const user = db.prepare("SELECT telegram_id, is_admin FROM users WHERE id = ?").get(userId) as any;
  if (!user) return { tier: 'free', expiresAt: null };

  const tg = user.telegram_id;
  if (!tg) {
    // No TG bound — demote to free unless admin
    db.prepare("UPDATE users SET tier = 'free', subscription_expires_at = NULL WHERE id = ? AND tier != 'guest'").run(userId);
    return { tier: 'free', expiresAt: null };
  }

  const placeholders = ALLOWED_SUBSCRIPTIONS.map(() => '?').join(',');
  // Latest event per subscription_id for this telegram user
  const rows = db.prepare(`
    SELECT subscription_name, event_name, expires_at
    FROM tribute_payments tp
    WHERE telegram_user_id = ?
      AND subscription_name IN (${placeholders})
    ORDER BY COALESCE(paid_at, created_at) DESC
  `).all(tg, ...ALLOWED_SUBSCRIPTIONS) as any[];

  const now = Date.now();
  let maxExpires: number | null = null;
  const seenSubs = new Set<string>();

  for (const r of rows) {
    const key = r.subscription_name;
    if (seenSubs.has(key)) continue;
    seenSubs.add(key);
    if (r.event_name === 'cancelled_subscription') continue;
    if (!r.expires_at) continue;
    const t = Date.parse(r.expires_at);
    if (isNaN(t)) continue;
    if (t > now) {
      if (maxExpires === null || t > maxExpires) maxExpires = t;
    }
  }

  if (maxExpires !== null) {
    const iso = new Date(maxExpires).toISOString();
    db.prepare("UPDATE users SET tier = 'premium', subscription_expires_at = ? WHERE id = ?").run(iso, userId);
    return { tier: 'premium', expiresAt: iso };
  } else {
    db.prepare("UPDATE users SET tier = 'free', subscription_expires_at = NULL WHERE id = ? AND tier != 'guest'").run(userId);
    return { tier: 'free', expiresAt: null };
  }
}

/** Recompute tier for any users whose telegram_id matches this list. */
export function recomputeTierForTelegramIds(db: Database.Database, tgIds: string[]) {
  if (!tgIds.length) return;
  const uniq = [...new Set(tgIds.filter(Boolean).map(String))];
  const placeholders = uniq.map(() => '?').join(',');
  const users = db.prepare(`SELECT id FROM users WHERE telegram_id IN (${placeholders})`).all(...uniq) as any[];
  for (const u of users) recomputeUserTier(db, u.id);
}

type WebhookEvent = {
  id: number;
  name: string | null;
  raw_payload: string | null;
  received_at: string | null;
  payload__telegram_user_id?: number | null;
  payload__telegram_username?: string | null;
  payload__trb_user_id?: string | null;
  payload__subscription_id?: number | null;
  payload__subscription_name?: string | null;
  payload__channel_id?: number | null;
  payload__channel_name?: string | null;
  payload__amount?: number | null;
  payload__currency?: string | null;
  payload__period?: string | null;
  payload__expires_at?: string | null;
};

export function ingestWebhookEvents(db: Database.Database, events: WebhookEvent[]): { inserted: number; touchedTgIds: string[] } {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO tribute_payments
      (external_id, source, event_name, telegram_user_id, telegram_username, trb_user_id,
       subscription_id, subscription_name, channel_id, channel_name,
       amount, currency, period, expires_at, paid_at, raw_json)
    VALUES (?, 'webhook', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const touched = new Set<string>();
  let inserted = 0;
  const tx = db.transaction((evs: WebhookEvent[]) => {
    for (const e of evs) {
      const extId = `webhook:${e.id}`;
      const tgId = e.payload__telegram_user_id != null ? String(e.payload__telegram_user_id) : null;
      const r = insert.run(
        extId,
        e.name || null,
        tgId,
        e.payload__telegram_username || null,
        e.payload__trb_user_id || null,
        e.payload__subscription_id != null ? String(e.payload__subscription_id) : null,
        e.payload__subscription_name || null,
        e.payload__channel_id != null ? String(e.payload__channel_id) : null,
        e.payload__channel_name || null,
        e.payload__amount ?? null,
        e.payload__currency || null,
        e.payload__period || null,
        e.payload__expires_at || null,
        e.received_at || null,
        e.raw_payload || null,
      );
      if (r.changes > 0) {
        inserted++;
        if (tgId) touched.add(tgId);
      }
    }
  });
  tx(events);
  return { inserted, touchedTgIds: [...touched] };
}

export function startTributePoller(
  db: Database.Database,
  opts: { webhookUrl: string; intervalMs?: number; log: Logger }
) {
  const interval = opts.intervalMs ?? 30_000;
  const getState = db.prepare("SELECT v FROM tribute_poll_state WHERE k = 'last_event_id'");
  const setState = db.prepare("INSERT INTO tribute_poll_state (k, v) VALUES ('last_event_id', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v");

  const run = async () => {
    try {
      const resp = await fetch(`${opts.webhookUrl.replace(/\/$/, '')}/events?limit=1000`);
      if (!resp.ok) { opts.log.warn({ status: resp.status }, '[Tribute] Poller: non-200'); return; }
      const events: WebhookEvent[] = await resp.json();
      if (!Array.isArray(events) || events.length === 0) return;

      const lastSeen = Number((getState.get() as any)?.v || 0);
      const fresh = events.filter(e => typeof e.id === 'number' && e.id > lastSeen);
      if (fresh.length === 0) return;

      const { inserted, touchedTgIds } = ingestWebhookEvents(db, fresh);
      const maxId = Math.max(...events.map(e => e.id));
      setState.run(String(maxId));

      if (touchedTgIds.length) recomputeTierForTelegramIds(db, touchedTgIds);
      if (inserted > 0) opts.log.info({ inserted, maxId, affected: touchedTgIds.length }, '[Tribute] Ingested webhook events');
    } catch (e: any) {
      opts.log.error({ err: e?.message || String(e) }, '[Tribute] Poller error');
    }
  };

  // Immediate run, then interval
  void run();
  setInterval(run, interval);
  opts.log.info({ webhookUrl: opts.webhookUrl, intervalMs: interval }, '[Tribute] Poller started');
}

const PERIOD_DAYS: Record<string, number> = {
  monthly: 30,
  yearly: 365,
  halfyearly: 183,
  onetime: 30,
};

function periodToDays(period: string | null | undefined): number {
  if (!period) return 30;
  const p = String(period).toLowerCase().trim();
  return PERIOD_DAYS[p] ?? 30;
}

/** XLSX import — filters to ALLOWED_SUBSCRIPTIONS, upserts into tribute_payments with source='xlsx' */
export async function importXlsx(db: Database.Database, filePath: string, log: Logger): Promise<{ rows: number; inserted: number; touched: number }> {
  const _m = await import('xlsx');
  const XLSX: any = (_m as any).default ?? _m;
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Subscriptions'];
  if (!ws) throw new Error('Sheet "Subscriptions" not found');
  const rows = XLSX.utils.sheet_to_json<any>(ws);

  // Clean reimport: delete all existing xlsx records
  db.prepare("DELETE FROM tribute_payments WHERE source = 'xlsx'").run();

  const insert = db.prepare(`
    INSERT INTO tribute_payments
      (external_id, source, event_name, telegram_user_id, telegram_username, trb_user_id,
       subscription_id, subscription_name, channel_id, channel_name,
       amount, currency, period, period_days, expires_at, paid_at, raw_json)
    VALUES (?, 'xlsx', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const touched = new Set<string>();
  const tx = db.transaction(() => {
    for (const r of rows) {
      const subName = String(r['Subscription'] || '').trim();
      if (!ALLOWED_SUBSCRIPTIONS.includes(subName)) continue;

      const date = String(r['Date'] || '');
      const time = String(r['Time'] || '');
      const paidAtIso = date && time ? `${date}T${time}Z` : (date ? `${date}T00:00:00Z` : null);

      const tgId = r['Follower ID'] != null ? String(r['Follower ID']).trim() : null;
      const subId = r['Subscription ID'] != null ? String(r['Subscription ID']) : null;
      const periodId = r['SubscriptionPeriod ID'] != null ? String(r['SubscriptionPeriod ID']) : '';
      const extId = `xlsx:${tgId}:${subId}:${periodId}:${date}:${time}`;

      const status = String(r['Subscription Status'] || '').toLowerCase();
      const txType = String(r['Type of transaction'] || '').toLowerCase();
      let eventName = txType.includes('init') ? 'init_payment' : (txType.includes('recurrent') ? 'recurrent_payment' : 'payment');
      if (status === 'inactive') eventName = 'cancelled_subscription';

      const amountMajor = Number(r['Amount'] || 0);
      const amountKopecks = Math.round(amountMajor * 100);

      const from = String(r['From'] || '');
      const tgUsername = from.startsWith('@') ? from.slice(1) : null;

      const period = r['Period'] ? String(r['Period']) : null;
      const days = periodToDays(period);
      const expiresAt = paidAtIso
        ? new Date(new Date(paidAtIso).getTime() + days * 86400000).toISOString()
        : null;

      const res = insert.run(
        extId,
        eventName,
        tgId,
        tgUsername,
        null,
        subId,
        subName,
        r['Channel ID'] != null ? String(r['Channel ID']) : null,
        r['Channel'] || null,
        amountKopecks,
        String(r['Currency'] || 'RUB').toLowerCase(),
        period,
        days,
        expiresAt,
        paidAtIso,
        JSON.stringify(r),
      );
      if (res.changes > 0) {
        inserted++;
        if (tgId) touched.add(tgId);
      }
    }
  });
  tx();

  if (touched.size) recomputeTierForTelegramIds(db, [...touched]);
  log.info({ rows: rows.length, inserted, touched: touched.size }, '[Tribute] XLSX import done');
  return { rows: rows.length, inserted, touched: touched.size };
}

/**
 * Verify Telegram Login Widget HMAC.
 * Returns true if signature is valid, false otherwise. If no bot token set, returns true (dev).
 */
export function verifyTelegramWidget(data: Record<string, string>, botToken: string): boolean {
  if (!botToken) return true;
  const { hash, ...rest } = data;
  if (!hash) return false;
  const authDate = parseInt(rest.auth_date || '0');
  if (!authDate || Date.now() / 1000 - authDate > 86400) return false;
  const dataCheckString = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return computed === hash;
}

export function mountTributeRoutes(
  app: Express,
  db: Database.Database,
  authenticate: any,
  requireAdmin: any,
  log: Logger,
) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  // --- Link Telegram to existing authenticated user ---
  app.post('/api/auth/telegram/link', authenticate, (req: any, res) => {
    try {
      const telegram = req.body?.telegram;
      if (!telegram || !telegram.id) return res.status(400).json({ success: false, message: 'Нет данных Telegram' });

      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(telegram)) if (v != null) fields[k] = String(v);
      if (!verifyTelegramWidget(fields, BOT_TOKEN)) {
        return res.status(400).json({ success: false, message: 'Неверная подпись Telegram' });
      }

      const tgId = String(telegram.id);
      // Already linked to another user?
      const conflict = db.prepare("SELECT id FROM users WHERE telegram_id = ? AND id != ?").get(tgId, req.user.id) as any;
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Этот Telegram уже привязан к другому аккаунту' });
      }

      db.prepare(`UPDATE users SET
        telegram_id = ?, telegram_username = ?, telegram_first_name = ?,
        telegram_last_name = ?, telegram_photo_url = ?, telegram_auth_date = ?
        WHERE id = ?`).run(
        tgId,
        telegram.username ?? null,
        telegram.first_name ?? null,
        telegram.last_name ?? null,
        telegram.photo_url ?? null,
        telegram.auth_date ? Number(telegram.auth_date) : null,
        req.user.id,
      );

      const st = recomputeUserTier(db, req.user.id);
      const row = db.prepare("SELECT id, username, name, email, first_name, last_name, tier, is_admin, subscription_expires_at, telegram_id, telegram_username, telegram_photo_url FROM users WHERE id = ?").get(req.user.id);
      res.json({ success: true, user: { ...(row as any), progress: 0 }, tier: st.tier, expiresAt: st.expiresAt });
    } catch (e: any) {
      log.error({ err: e.message }, '[Tribute] link error');
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  });

  // --- Unlink Telegram ---
  app.post('/api/auth/telegram/unlink', authenticate, (req: any, res) => {
    try {
      db.prepare(`UPDATE users SET telegram_id = NULL, telegram_username = NULL, telegram_first_name = NULL, telegram_last_name = NULL, telegram_photo_url = NULL, telegram_auth_date = NULL WHERE id = ?`).run(req.user.id);
      recomputeUserTier(db, req.user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  });

  // --- User's payment history ---
  app.get('/api/me/tribute-payments', authenticate, (req: any, res) => {
    try {
      const user = db.prepare("SELECT telegram_id FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user?.telegram_id) return res.json({ payments: [], tier: 'free', expires_at: null });

      const rows = db.prepare(`
        SELECT id, event_name, subscription_name, channel_name, amount, currency, period, expires_at, paid_at, source
        FROM tribute_payments WHERE telegram_user_id = ?
        ORDER BY COALESCE(paid_at, created_at) DESC
      `).all(user.telegram_id);

      const st = recomputeUserTier(db, req.user.id);
      res.json({ payments: rows, tier: st.tier, expires_at: st.expiresAt });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin: list all tribute payments with user info ---
  app.get('/api/admin/tribute-payments', requireAdmin, (req: any, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const q = (req.query.q as string || '').trim();
      const sub = (req.query.subscription_name as string || '').trim();

      const where: string[] = [];
      const params: any[] = [];
      if (q) {
        where.push('(tp.telegram_username LIKE ? OR tp.telegram_user_id LIKE ? OR u.username LIKE ?)');
        const l = `%${q}%`;
        params.push(l, l, l);
      }
      if (sub) { where.push('tp.subscription_name = ?'); params.push(sub); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const rows = db.prepare(`
        SELECT tp.id, tp.source, tp.event_name, tp.subscription_name, tp.channel_name,
               tp.amount, tp.currency, tp.period, tp.expires_at, tp.paid_at,
               tp.telegram_user_id, tp.telegram_username,
               u.id AS user_id, u.username, u.name AS user_name
        FROM tribute_payments tp
        LEFT JOIN users u ON u.telegram_id = tp.telegram_user_id
        ${whereSql}
        ORDER BY COALESCE(tp.paid_at, tp.created_at) DESC
        LIMIT ?
      `).all(...params, limit);

      res.json({ payments: rows, allowed: ALLOWED_SUBSCRIPTIONS });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin: trigger recompute for a specific user ---
  app.post('/api/admin/users/:id/recompute-tier', requireAdmin, (req: any, res) => {
    try {
      const st = recomputeUserTier(db, req.params.id);
      res.json({ success: true, ...st });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
