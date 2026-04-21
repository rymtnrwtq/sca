import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Search, X, Crown, Shield, Trash2,
  Save, ArrowLeft, History, Bookmark,
  AlertTriangle, Check, RefreshCw, Key, Video,
  ChevronRight, Calendar, User as UserIcon, Mail, ChevronDown,
  Radio, Bell, Send, Filter, Monitor, Laptop, Smartphone, CreditCard,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const TIER_COLORS: Record<string, string> = {
  premium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  free: 'bg-green-500/10 text-green-400 border-green-500/20',
  guest: 'bg-zinc-800/50 text-zinc-500 border-white/5',
};
const TIER_LABELS: Record<string, string> = { premium: 'Premium', free: 'Free', guest: 'Guest' };

function authHeader() {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

interface AdminUser {
  id: string; username: string; name: string; tier: string;
  is_admin: number; subscription_expires_at: string | null;
  subscription_started_at?: string | null;
  last_seen?: string | null;
  notes: string | null; created_at: string;
  watch_count: number; bookmark_count: number;
}

interface HistoryItem {
  video_id: string;
  video_title: string | null;
  video_poster: string | null;
  progress: number;
  last_position: number;
  last_watched: string;
}

interface BookmarkItem {
  video_id: string;
  added_at: string;
  video_title: string | null;
  video_poster: string | null;
}

interface AdminDeviceItem {
  id: string;
  name: string;
  last_seen: string;
  created_at: string;
}

interface AdminPaymentItem {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface AdminChatMessage {
  id: number;
  user_message: string;
  ai_reply: string;
  created_at: string;
}

interface UserDetailData {
  user: AdminUser;
  history: HistoryItem[];
  bookmarks: BookmarkItem[];
}

// ─── Custom Select Dropdown ────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

function CustomSelect({
  value, onChange, options, placeholder, icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 bg-zinc-950 border rounded-2xl px-5 py-3.5 text-sm font-bold text-white transition-all text-left",
          open ? "border-orange-500/50" : "border-white/10 hover:border-white/20"
        )}
      >
        {icon && <span className="text-zinc-500 shrink-0">{icon}</span>}
        <span className={cn("flex-1", !selected && "text-zinc-600")}>
          {selected?.label ?? placeholder ?? 'Выбрать...'}
        </span>
        <ChevronDown size={16} className={cn("text-zinc-500 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 p-1"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm font-bold rounded-xl transition-all",
                  opt.value === value
                    ? "bg-orange-500/15 text-orange-400"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── User Avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-20 h-20 text-3xl' : size === 'md' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm';
  const rounded = size === 'lg' ? 'rounded-[28px]' : 'rounded-2xl';
  return (
    <div className={cn(sz, rounded, "bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-orange-500/20")}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ─── User Detail Panel ─────────────────────────────────────────────────────────

const TIER_OPTIONS: SelectOption[] = [
  { value: 'free', label: 'Free — Базовый' },
  { value: 'premium', label: 'Premium — Премиум' },
];

const PLAN_LABELS_ADMIN: Record<string, string> = {
  '1month': '1 месяц', '6months': '6 месяцев', '1year': '1 год',
};
const STATUS_LABELS_ADMIN: Record<string, { label: string; color: string }> = {
  succeeded: { label: 'Оплачен', color: 'text-green-400' },
  pending:   { label: 'В обработке', color: 'text-yellow-400' },
  cancelled: { label: 'Отменён', color: 'text-zinc-500' },
};

function UserDetailPanel({ userId, onClose, onUpdate }: { userId: string; onClose: () => void; onUpdate: () => void }) {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'history' | 'bookmarks' | 'devices' | 'payments' | 'chat'>('info');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tier: '', subscription_expires_at: '', name: '', notes: '' });
  const [pwForm, setPwForm] = useState({ newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [toast, setToast] = useState('');
  const [devices, setDevices] = useState<AdminDeviceItem[]>([]);
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, devData, payData, chatData] = await Promise.all([
        apiFetch(`/api/admin/users/${userId}`),
        apiFetch(`/api/admin/users/${userId}/devices`),
        apiFetch(`/api/admin/users/${userId}/payments`),
        apiFetch(`/api/admin/users/${userId}/chat`),
      ]);
      setData(d as UserDetailData);
      setDevices((devData as any).devices || []);
      setPayments((payData as any).payments || []);
      setChatMessages((chatData as any).messages || []);
      setForm({
        tier: (d as UserDetailData).user.tier,
        subscription_expires_at: (d as UserDetailData).user.subscription_expires_at
          ? (d as UserDetailData).user.subscription_expires_at!.split('T')[0]
          : '',
        name: (d as UserDetailData).user.name || '',
        notes: (d as UserDetailData).user.notes || '',
      });
    } catch (e: any) {
      showToast('Ошибка загрузки: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // When tier changes — sync subscription date logic
  const handleTierChange = (newTier: string) => {
    setForm(f => {
      if (newTier === 'premium' && !f.subscription_expires_at) {
        // Auto-set to 1 year from today
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return { ...f, tier: newTier, subscription_expires_at: d.toISOString().split('T')[0] };
      }
      if (newTier === 'free') {
        // Clear subscription date when downgrading
        return { ...f, tier: newTier, subscription_expires_at: '' };
      }
      return { ...f, tier: newTier };
    });
  };

  const save = async () => {
    if (form.tier === 'premium' && !form.subscription_expires_at) {
      showToast('Укажите дату окончания подписки для Premium');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          tier: form.tier,
          subscription_expires_at: form.subscription_expires_at || null,
          name: form.name,
          notes: form.notes,
        }),
      });
      showToast('Изменения сохранены');
      onUpdate();
      await load();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetPw = async () => {
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('Пароли не совпадают'); return; }
    if (pwForm.newPassword.length < 4) { setPwError('Минимум 4 символа'); return; }
    try {
      await apiFetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: pwForm.newPassword }),
      });
      setPwForm({ newPassword: '', confirm: '' });
      setPwError('');
      showToast('Пароль изменён');
    } catch (e: any) {
      setPwError(e.message);
    }
  };

  const deleteUser = async () => {
    if (confirmDelete !== 'DELETE') return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      onUpdate();
      onClose();
    } catch (e: any) {
      showToast('Ошибка удаления: ' + e.message);
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/devices/${deviceId}`, { method: 'DELETE' });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      showToast('Устройство удалено');
    } catch (e: any) {
      showToast('Ошибка: ' + e.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;
  const { user, history, bookmarks } = data;

  return (
    <div className="relative space-y-8 pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 md:top-6 md:bottom-auto z-50 bg-zinc-900 border border-white/10 px-6 py-4 rounded-[24px] text-sm text-white flex items-center gap-3 shadow-2xl backdrop-blur-xl"
          >
            <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Check size={16} className="text-green-400" />
            </div>
            <span className="font-bold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={onClose}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-zinc-900 border border-white/5 rounded-2xl text-zinc-400 hover:text-white hover:border-white/10 transition-all shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3 md:gap-5">
            <UserAvatar name={user.name || user.username} size="md" />
            <div>
              <h2 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">{user.name || 'Без имени'}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-zinc-500 text-sm font-bold tracking-tight">@{user.username}</p>
                <div className="h-1 w-1 bg-zinc-800 rounded-full" />
                <span className={cn("text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border", TIER_COLORS[user.tier])}>
                  {TIER_LABELS[user.tier]}
                </span>
                {user.subscription_expires_at && (
                  <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1.5">
                    <Calendar size={11} className="text-orange-500/60" />
                    {user.subscription_started_at ? `с ${new Date(user.subscription_started_at).toLocaleDateString('ru')} ` : ''}
                    до {new Date(user.subscription_expires_at).toLocaleDateString('ru')}
                  </span>
                )}
                {user.is_admin ? (
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
                    <Shield size={12} /> Админ
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 md:gap-8 bg-zinc-900/40 border border-white/5 px-4 py-4 md:p-6 rounded-[24px] md:rounded-[32px]">
          <div className="text-center px-2 md:px-4">
            <div className="text-xl md:text-2xl font-black text-white">{user.watch_count}</div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Просм.</div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="text-center px-2 md:px-4">
            <div className="text-xl md:text-2xl font-black text-white">{user.bookmark_count}</div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Закладок</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {([
          ['info', <><span className="hidden sm:inline">Редактировать </span>профиль</>],
          ['history', `История (${history.length})`],
          ['bookmarks', `Закладки (${bookmarks.length})`],
          ['devices', `Сессии (${devices.length})`],
          ['payments', `Платежи (${payments.length})`],
          ['chat', `AI Чат (${chatMessages.length})`],
        ] as [string, React.ReactNode][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={cn(
              "px-6 py-3.5 rounded-[20px] text-sm font-black transition-all whitespace-nowrap tracking-tight",
              tab === t
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
        <div className="lg:col-span-2 space-y-5 md:space-y-8">

          {/* Info Tab */}
          {tab === 'info' && (
            <div className="space-y-8">
              <div className="bg-zinc-900/40 border border-white/5 rounded-[24px] md:rounded-[32px] p-5 md:p-8 space-y-6 md:space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                    <UserIcon size={20} />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">Общая информация</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="space-y-2.5">
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Полное имя</span>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full bg-zinc-950 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-700"
                        placeholder="Введите имя..."
                      />
                    </div>
                  </label>

                  <div className="space-y-2.5">
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Тарифный план</span>
                    <CustomSelect
                      value={form.tier}
                      onChange={handleTierChange}
                      options={TIER_OPTIONS}
                      icon={<Crown size={18} />}
                    />
                  </div>

                  {form.tier === 'premium' && (
                    <label className="space-y-2.5 md:col-span-2">
                      <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">
                        Подписка активна до <span className="text-orange-500">*</span>
                      </span>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                        <input
                          type="date"
                          value={form.subscription_expires_at}
                          onChange={e => setForm(f => ({ ...f, subscription_expires_at: e.target.value }))}
                          className="w-full bg-zinc-950 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all [color-scheme:dark] font-bold"
                        />
                      </div>
                    </label>
                  )}
                </div>

                <label className="block space-y-2.5">
                  <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Заметки администратора</span>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={4}
                    className="w-full bg-zinc-950 border border-white/10 rounded-[24px] px-5 py-4 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all resize-none placeholder:text-zinc-700"
                    placeholder="Добавьте служебную информацию..."
                  />
                </label>

                <div className="pt-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="w-full md:w-auto md:ml-auto md:flex flex items-center justify-center gap-3 px-8 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                  >
                    {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                    Сохранить изменения
                  </button>
                </div>
              </div>

              {/* Password Reset */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-[24px] md:rounded-[32px] p-5 md:p-8 space-y-5 md:space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                    <Key size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Безопасность</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    placeholder="Новый пароль"
                    type="password"
                    value={pwForm.newPassword}
                    onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                    className="bg-zinc-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-700"
                  />
                  <input
                    placeholder="Подтвердите пароль"
                    type="password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    className="bg-zinc-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-700"
                  />
                </div>
                {pwError && <p className="text-red-400 text-xs font-bold px-1">{pwError}</p>}
                <button
                  onClick={resetPw}
                  className="px-6 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-sm font-black transition-all active:scale-95"
                >
                  Обновить пароль
                </button>
              </div>
            </div>
          )}

          {/* History Tab */}
          {tab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 opacity-20">
                    <History size={32} className="text-white" />
                  </div>
                  <p className="text-zinc-500 font-bold">История просмотров пуста</p>
                  <p className="text-zinc-600 text-xs mt-2">Записи появятся после просмотра видео</p>
                </div>
              ) : history.map(h => (
                <div key={h.video_id} className="flex items-center gap-5 p-4 bg-zinc-900/40 border border-white/5 rounded-[24px]">
                  {h.video_poster ? (
                    <img
                      src={h.video_poster}
                      alt={h.video_title || 'Видео'}
                      className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-white/5"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-zinc-950 flex items-center justify-center shrink-0 border border-white/5">
                      <Video size={24} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-white font-bold truncate">{h.video_title || h.video_id}</p>
                    <p className="text-xs text-zinc-500 mt-1 font-medium">
                      {new Date(h.last_watched).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[15px] font-black text-white">{h.progress}%</div>
                    <div className="w-20 h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${h.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bookmarks Tab */}
          {tab === 'bookmarks' && (
            <div className="grid grid-cols-1 gap-3">
              {bookmarks.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 opacity-20">
                    <Bookmark size={32} className="text-white" />
                  </div>
                  <p className="text-zinc-500 font-bold">Закладок пока нет</p>
                  <p className="text-zinc-600 text-xs mt-2">Пользователь не добавил ни одного видео</p>
                </div>
              ) : bookmarks.map(b => (
                <div key={b.video_id} className="flex items-center gap-5 p-5 bg-zinc-900/40 border border-white/5 rounded-[24px]">
                  {b.video_poster ? (
                    <img
                      src={b.video_poster}
                      alt={b.video_title || 'Видео'}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/5"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                      <Bookmark size={20} fill="currentColor" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-white font-black truncate">{b.video_title || b.video_id}</p>
                    <p className="text-xs text-zinc-500 mt-1 font-medium">
                      Добавлено {new Date(b.added_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Devices Tab */}
          {tab === 'devices' && (
            <div className="space-y-3">
              {devices.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 opacity-20">
                    <Monitor size={32} className="text-white" />
                  </div>
                  <p className="text-zinc-500 font-bold">Нет активных сессий</p>
                </div>
              ) : devices.map(d => {
                const isMobile = /iphone|ipad|android/i.test(d.name ?? '');
                const lastSeen = new Date(d.last_seen);
                const diffMs = Date.now() - lastSeen.getTime();
                const diffMin = Math.floor(diffMs / 60_000);
                const diffHours = Math.floor(diffMs / 3_600_000);
                const diffDays = Math.floor(diffMs / 86_400_000);
                const lastSeenStr = diffMin < 2 ? 'только что'
                  : diffMin < 60 ? `${diffMin} мин. назад`
                  : diffHours < 24 ? `${diffHours} ч. назад`
                  : diffDays < 7 ? `${diffDays} дн. назад`
                  : lastSeen.toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-4 bg-zinc-900/40 border border-white/5 rounded-[24px]">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 shrink-0">
                        {isMobile ? <Smartphone size={18} /> : <Laptop size={18} />}
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{d.name || 'Неизвестный браузер'}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">Активность: {lastSeenStr}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeDevice(d.id)}
                      className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payments Tab */}
          {tab === 'payments' && (
            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 opacity-20">
                    <CreditCard size={32} className="text-white" />
                  </div>
                  <p className="text-zinc-500 font-bold">История платежей пуста</p>
                </div>
              ) : payments.map(p => {
                const s = STATUS_LABELS_ADMIN[p.status] ?? { label: p.status, color: 'text-zinc-500' };
                return (
                  <div key={p.id} className="flex items-center justify-between gap-4 p-4 bg-zinc-900/40 border border-white/5 rounded-[24px]">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 shrink-0">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{PLAN_LABELS_ADMIN[p.plan] ?? p.plan}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {new Date(p.created_at).toLocaleString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-sm font-black">{p.amount.toLocaleString('ru')} {p.currency}</p>
                      <p className={cn("text-xs font-bold", s.color)}>{s.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Chat Tab */}
          {tab === 'chat' && (
            <div className="space-y-4">
              {chatMessages.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 opacity-20">
                    <Send size={32} className="text-white" />
                  </div>
                  <p className="text-zinc-500 font-bold">Диалогов с AI ботом нет</p>
                </div>
              ) : chatMessages.map(m => (
                <div key={m.id} className="bg-zinc-900/40 border border-white/5 rounded-[24px] p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Users size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm leading-relaxed">{m.user_message}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Send size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{m.ai_reply}</p>
                    </div>
                  </div>
                  <p className="text-zinc-600 text-xs text-right">
                    {new Date(m.created_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-8">
          <div className="bg-zinc-900/40 border border-white/5 rounded-[24px] md:rounded-[32px] p-5 md:p-8 space-y-5 md:space-y-6">
            <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Системная информация</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-bold">ID</span>
                <span className="text-white font-mono text-[10px] bg-zinc-950 px-2 py-1 rounded-lg border border-white/5 truncate max-w-[120px]">{user.id}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-bold">Регистрация</span>
                <span className="text-white font-bold">{new Date(user.created_at).toLocaleDateString('ru')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-bold">Логин</span>
                <span className="text-white font-bold">@{user.username}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-bold">Тариф</span>
                <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border", TIER_COLORS[user.tier])}>
                  {TIER_LABELS[user.tier]}
                </span>
              </div>
              {user.subscription_started_at && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold">Подключена</span>
                  <span className="text-white font-bold text-xs">
                    {new Date(user.subscription_started_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {user.subscription_expires_at && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold">Работает до</span>
                  <span className="text-orange-400 font-bold text-xs">
                    {new Date(user.subscription_expires_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {user.last_seen && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold">Последний вход</span>
                  <span className="text-white font-bold text-xs">
                    {new Date(user.last_seen).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {user.is_admin ? (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold">Права</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Администратор
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-red-950/20 border border-red-500/10 rounded-[24px] md:rounded-[32px] p-5 md:p-8 space-y-5 md:space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Удаление</h3>
            </div>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed">
              Удалит весь прогресс, закладки и профиль без возможности восстановления.
            </p>
            <div className="space-y-4">
              <input
                placeholder="Введите DELETE"
                value={confirmDelete}
                onChange={e => setConfirmDelete(e.target.value)}
                className="w-full bg-zinc-950 border border-red-500/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/40 font-mono text-center placeholder:text-zinc-800"
              />
              <button
                onClick={deleteUser}
                disabled={confirmDelete !== 'DELETE'}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white disabled:opacity-20 rounded-2xl text-sm font-black transition-all active:scale-95"
              >
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

interface AnalyticsData {
  totalUsers: number; premiumUsers: number; freeUsers: number;
  activeToday: number; activeWeek: number; newUsersWeek: number;
  conversionRate: number; totalViews: number; expiringSoon: number;
  topVideos: Array<{ video_id: string; video_title: string; views: number; avg_progress: number }>;
}

function StatCard({ label, value, sub, color = 'orange' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    orange: 'text-orange-500 bg-orange-500/10',
    green: 'text-green-400 bg-green-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
  };
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5">
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">{label}</p>
      <p className={cn("text-3xl font-black", colors[color].split(' ')[0])}>{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/analytics')
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <p className="text-zinc-500 text-center py-12">Не удалось загрузить аналитику</p>;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs font-black text-zinc-500 mb-4 uppercase tracking-wider">Пользователи</h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          <div className="shrink-0 w-40"><StatCard label="Всего пользователей" value={data.totalUsers} color="orange" /></div>
          <div className="shrink-0 w-40"><StatCard label="Premium" value={data.premiumUsers} sub={`${data.conversionRate}% конверсия`} color="yellow" /></div>
          <div className="shrink-0 w-40"><StatCard label="Бесплатных" value={data.freeUsers} color="green" /></div>
          <div className="shrink-0 w-40"><StatCard label="Истекает ≤14 дней" value={data.expiringSoon} color="red" /></div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-black text-zinc-500 mb-4 uppercase tracking-wider">Активность</h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          <div className="shrink-0 w-40"><StatCard label="Активных сегодня" value={data.activeToday} color="blue" /></div>
          <div className="shrink-0 w-40"><StatCard label="Активных за неделю" value={data.activeWeek} color="blue" /></div>
          <div className="shrink-0 w-40"><StatCard label="Новых за неделю" value={data.newUsersWeek} color="green" /></div>
          <div className="shrink-0 w-40"><StatCard label="Всего просмотров" value={data.totalViews} color="orange" /></div>
        </div>
      </div>

      {data.topVideos.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-zinc-500 mb-4 uppercase tracking-wider">Топ видео</h3>
          <div className="space-y-2">
            {data.topVideos.map((v, i) => (
              <div key={v.video_id} className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 rounded-2xl px-5 py-4">
                <span className="text-zinc-600 font-black text-sm w-6 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{v.video_title || v.video_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-orange-500 font-black text-sm">{v.views} просм.</p>
                  <p className="text-zinc-500 text-xs">{Math.round(v.avg_progress)}% avg</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live Broadcast Panel ─────────────────────────────────────────────────────

function LiveBroadcastPanel() {
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState(''); // URL actually stored in DB
  const [active, setActive] = useState(false);
  const [op, setOp] = useState<'url' | 'toggle' | null>(null); // current operation (mutex)
  const [urlSaved, setUrlSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await apiFetch('/api/admin/live-broadcast-status');
      setActive(!!d.active);
      setSavedUrl(d.embed_url ?? '');
      setUrl(d.embed_url ?? '');
    } catch (e: any) {
      setError('Ошибка загрузки: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Введите ссылку на трансляцию'); return; }
    if (!trimmed.includes('kinescope.io')) { setError('Ссылка должна быть от kinescope.io'); return; }
    setOp('url'); setUrlSaved(false); setError('');
    try {
      const d = await apiFetch('/api/admin/live-broadcast', {
        method: 'PUT',
        body: JSON.stringify({ url: trimmed }),
      });
      setSavedUrl(d.embed_url ?? trimmed);
      setUrl(d.embed_url ?? trimmed);
      setUrlSaved(true);
      setTimeout(() => setUrlSaved(false), 2500);
    } catch (e: any) {
      setError('Ошибка сохранения: ' + e.message);
    } finally {
      setOp(null);
    }
  };

  const toggle = async () => {
    const trimmed = url.trim();
    if (!active && !trimmed) { setError('Введите ссылку на трансляцию'); return; }
    setOp('toggle'); setError('');
    try {
      // When enabling: always send current URL + active=true (saves + enables in one shot)
      // When disabling: only send active=false
      const body = !active
        ? { url: trimmed, active: true }
        : { active: false };
      const d = await apiFetch('/api/admin/live-broadcast', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setActive(!!d.active);
      if (d.embed_url) { setSavedUrl(d.embed_url); setUrl(d.embed_url); }
    } catch (e: any) {
      setError('Ошибка: ' + e.message);
    } finally {
      setOp(null);
    }
  };

  const busy = op !== null;

  return (
    <div className="max-w-lg space-y-4 md:space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Status card with toggle switch */}
          <div className={cn(
            "flex items-center gap-4 p-5 rounded-[24px] border transition-all",
            active ? "bg-red-950/30 border-red-500/30" : "bg-zinc-900/40 border-white/5"
          )}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              active ? "bg-red-500" : "bg-zinc-800"
            )}>
              {op === 'toggle'
                ? <RefreshCw size={20} className="text-white animate-spin" />
                : <Radio size={22} className="text-white" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold">{active ? 'Эфир активен' : 'Эфир не активен'}</p>
              <p className="text-zinc-500 text-xs mt-0.5 truncate font-mono">
                {savedUrl || 'URL не задан'}
              </p>
            </div>
            {/* Tumbler switch */}
            <button
              onClick={toggle}
              disabled={busy || (!active && !url.trim())}
              title={active ? 'Выключить эфир' : 'Включить эфир'}
              className={cn(
                "relative w-[52px] h-7 rounded-full transition-all duration-200 shrink-0 focus:outline-none",
                active ? "bg-red-500 shadow-lg shadow-red-500/40" : "bg-zinc-700",
                (busy || (!active && !url.trim())) && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "absolute top-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-all duration-200",
                active ? "left-[26px]" : "left-[3px]"
              )} />
            </button>
          </div>

          {/* URL input + Save */}
          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">
                Ссылка на трансляцию
              </span>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlSaved(false); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && !busy && saveUrl()}
                placeholder="https://kinescope.io/ID"
                disabled={busy}
                className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-700 font-mono disabled:opacity-50"
              />
            </label>

            {error && (
              <p className="flex items-center gap-2 text-red-400 text-xs font-bold px-1">
                <AlertTriangle size={13} /> {error}
              </p>
            )}

            <button
              onClick={saveUrl}
              disabled={busy || !url.trim()}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40",
                urlSaved
                  ? "bg-green-500/10 border border-green-500/20 text-green-400"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              )}
            >
              {op === 'url'
                ? <RefreshCw size={14} className="animate-spin" />
                : urlSaved
                  ? <Check size={14} />
                  : <Save size={14} />
              }
              {op === 'url' ? 'Сохранение...' : urlSaved ? 'URL сохранён' : 'Сохранить URL'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

interface SentNotification {
  id: number;
  title: string;
  message: string;
  target: string;
  target_user_ids: string | null;
  created_at: string;
  read_count: number;
}

const TARGET_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'premium', label: 'Только Premium' },
  { value: 'free', label: 'Только Free' },
  { value: 'specific', label: 'Выбрать пользователей' },
];

const TARGET_LABELS: Record<string, string> = {
  all: 'Все',
  premium: 'Premium',
  free: 'Free',
  specific: 'Конкретные',
};

function NotificationsPanel({ allUsers }: { allUsers: AdminUser[] }) {
  const [form, setForm] = useState({ title: '', message: '', target: 'all' });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'ok' | 'err'>('ok');
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast(msg); setToastType(type); setTimeout(() => setToast(''), 3000);
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const d = await apiFetch('/api/admin/notifications');
      setHistory(d.notifications);
    } catch (e: any) {
      showToast('Ошибка загрузки: ' + e.message, 'err');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      showToast('Заполните заголовок и текст', 'err'); return;
    }
    if (form.target === 'specific' && selectedUserIds.length === 0) {
      showToast('Выберите хотя бы одного пользователя', 'err'); return;
    }
    setSending(true);
    try {
      await apiFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          target: form.target,
          target_user_ids: form.target === 'specific' ? selectedUserIds : undefined,
        }),
      });
      setForm({ title: '', message: '', target: 'all' });
      setSelectedUserIds([]);
      showToast('Уведомление отправлено');
      await loadHistory();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'err');
    } finally {
      setSending(false);
    }
  };

  const deleteNotification = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      setHistory(h => h.filter(n => n.id !== id));
    } catch (e: any) {
      showToast('Ошибка удаления: ' + e.message, 'err');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredUsers = allUsers.filter(u =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 md:top-6 md:bottom-auto z-50 bg-zinc-900 border border-white/10 px-6 py-4 rounded-[24px] text-sm text-white flex items-center gap-3 shadow-2xl backdrop-blur-xl"
          >
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", toastType === 'ok' ? "bg-green-500/20" : "bg-red-500/20")}>
              {toastType === 'ok' ? <Check size={16} className="text-green-400" /> : <AlertTriangle size={16} className="text-red-400" />}
            </div>
            <span className="font-bold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-[24px] md:rounded-[32px] p-5 md:p-8 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
            <Bell size={20} />
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">Новое уведомление</h3>
        </div>

        <div className="space-y-5">
          <label className="block space-y-2.5">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Заголовок</span>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Например: Новый семинар доступен"
              className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
            />
          </label>

          <label className="block space-y-2.5">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Текст сообщения</span>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              placeholder="Напишите текст уведомления..."
              className="w-full bg-zinc-950 border border-white/10 rounded-[24px] px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none placeholder:text-zinc-700"
            />
          </label>

          <div className="space-y-2.5">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Получатели</span>
            <CustomSelect
              value={form.target}
              onChange={v => { setForm(f => ({ ...f, target: v })); setSelectedUserIds([]); }}
              options={TARGET_OPTIONS}
              icon={<Filter size={18} />}
            />
          </div>

          {/* Specific user selector */}
          {form.target === 'specific' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Поиск пользователей..."
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
                />
              </div>
              {selectedUserIds.length > 0 && (
                <p className="text-[11px] font-bold text-blue-400 px-1">Выбрано: {selectedUserIds.length} чел.</p>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 rounded-2xl transition-all text-left",
                      selectedUserIds.includes(u.id)
                        ? "bg-blue-500/10 border border-blue-500/20"
                        : "bg-zinc-900/60 border border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                      selectedUserIds.includes(u.id) ? "bg-blue-500 border-blue-500" : "border-zinc-600"
                    )}>
                      {selectedUserIds.includes(u.id) && <Check size={12} className="text-white" />}
                    </div>
                    <UserAvatar name={u.name || u.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{u.name || 'Без имени'}</p>
                      <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                    </div>
                    <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", TIER_COLORS[u.tier])}>
                      {TIER_LABELS[u.tier]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={send}
              disabled={sending}
              className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {sending ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
              Отправить уведомление
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="space-y-5">
        <h3 className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">
          История отправленных — {history.length}
        </h3>

        {historyLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-zinc-900/20 border border-dashed border-white/10 rounded-[32px] py-20 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-[24px] flex items-center justify-center mx-auto mb-4 opacity-20">
              <Bell size={32} className="text-white" />
            </div>
            <p className="text-zinc-500 font-bold">Уведомления ещё не отправлялись</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(n => (
              <div key={n.id} className="bg-zinc-900/40 border border-white/5 rounded-[28px] p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <span className="text-white font-black text-base truncate">{n.title}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      {TARGET_LABELS[n.target] ?? n.target}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteNotification(n.id)}
                    disabled={deletingId === n.id}
                    className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all shrink-0 disabled:opacity-30"
                  >
                    {deletingId === n.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-[11px] text-zinc-600 font-bold">
                    {new Date(n.created_at).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-bold flex items-center gap-1.5">
                    <Check size={11} className="text-green-400" /> {n.read_count} прочитали
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main AdminPage ────────────────────────────────────────────────────────────

const FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'Все тарифы' },
  { value: 'premium', label: 'Premium' },
  { value: 'free', label: 'Free' },
];

export const AdminPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [adminTab, setAdminTab] = useState<'users' | 'broadcasts' | 'notifications' | 'analytics' | 'payments'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser !== undefined && !currentUser?.is_admin) navigate('/');
  }, [currentUser, navigate]);

  const loadUsers = useCallback(async (s = search, t = tierFilter) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (t) params.set('tier', t);
      const d = await apiFetch(`/api/admin/users?${params}`);
      setUsers(d.users);
    } catch {} finally {
      setUsersLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadUsers('', ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => loadUsers(search, tierFilter), 350);
    return () => clearTimeout(t);
  }, [search, tierFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser?.is_admin) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-24 md:pb-8 space-y-10"
    >
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-1">Система управления</h2>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              {adminTab === 'users' ? 'Пользователи' : adminTab === 'broadcasts' ? 'Эфиры' : 'Уведомления'}
            </h1>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 px-3 py-2 md:px-5 md:py-2.5 rounded-2xl flex items-center gap-2 shrink-0">
            <Shield size={16} className="text-purple-400" />
            <span className="hidden sm:inline text-sm font-black text-purple-400 uppercase tracking-wider">Admin</span>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-1.5 bg-zinc-900/60 border border-white/5 p-1.5 rounded-2xl min-w-max">
            <button
              onClick={() => { setAdminTab('users'); setSelectedUserId(null); }}
              className={cn(
                "shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                adminTab === 'users' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Users size={15} /> Пользователи
            </button>
            <button
              onClick={() => { setAdminTab('broadcasts'); setSelectedUserId(null); }}
              className={cn(
                "shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                adminTab === 'broadcasts' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Radio size={15} /> Эфиры
            </button>
            <button
              onClick={() => { setAdminTab('notifications'); setSelectedUserId(null); }}
              className={cn(
                "shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                adminTab === 'notifications' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Bell size={15} /> Уведомления
            </button>
            <button
              onClick={() => { setAdminTab('analytics'); setSelectedUserId(null); }}
              className={cn(
                "shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                adminTab === 'analytics' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Video size={15} /> Аналитика
            </button>
            <button
              onClick={() => { setAdminTab('payments'); setSelectedUserId(null); }}
              className={cn(
                "shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                adminTab === 'payments' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <CreditCard size={15} /> Платежи
            </button>
          </div>
        </div>
      </header>

      {adminTab === 'analytics' && <AnalyticsPanel />}

      {adminTab === 'payments' && <TributePaymentsPanel />}

      {adminTab === 'broadcasts' && <LiveBroadcastPanel />}

      {adminTab === 'notifications' && <NotificationsPanel allUsers={users} />}

      {adminTab === 'users' && (selectedUserId ? (
        <UserDetailPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdate={() => loadUsers(search, tierFilter)}
        />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Найти по имени или @username..."
                className="w-full bg-zinc-900/40 border border-white/5 rounded-[18px] pl-11 pr-11 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <CustomSelect
                  value={tierFilter}
                  onChange={setTierFilter}
                  options={FILTER_OPTIONS}
                />
              </div>
              <button
                onClick={() => loadUsers(search, tierFilter)}
                className="w-12 h-12 bg-zinc-900/40 border border-white/5 rounded-[18px] flex items-center justify-center hover:bg-zinc-800 transition-all active:scale-95 shrink-0"
              >
                <RefreshCw size={20} className={cn("text-zinc-400", usersLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="w-14 h-14 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase animate-pulse">Загрузка...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-zinc-900/20 border border-dashed border-white/10 rounded-[40px] py-32 text-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                <Users size={40} className="text-zinc-700" />
              </div>
              <p className="text-zinc-500 font-black text-xl tracking-tight">Пользователи не найдены</p>
              <p className="text-zinc-600 text-sm mt-2 font-medium">Попробуйте изменить параметры поиска</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] px-6">{users.length} аккаунтов</p>
              <div className="grid grid-cols-1 gap-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="w-full flex items-center gap-3 md:gap-5 p-4 md:p-5 bg-zinc-900/40 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-[24px] md:rounded-[32px] transition-all group text-left relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <UserAvatar name={u.name || u.username} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-black text-base md:text-lg tracking-tight group-hover:text-orange-400 transition-colors truncate max-w-[140px] sm:max-w-none">
                          {u.name || 'Без имени'}
                        </span>
                        <span className="text-zinc-500 text-xs md:text-sm font-bold hidden sm:inline">@{u.username}</span>
                        {u.is_admin ? (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/10 flex items-center gap-1">
                            <Shield size={9} /> Admin
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border", TIER_COLORS[u.tier])}>
                          {TIER_LABELS[u.tier]}
                        </span>
                        {u.subscription_expires_at && (
                          <div className="hidden sm:flex items-center gap-1.5 text-zinc-500 bg-zinc-950/50 px-2 py-0.5 rounded-lg border border-white/5">
                            <Calendar size={11} className="text-orange-500/50" />
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              {u.subscription_started_at ? `${new Date(u.subscription_started_at).toLocaleDateString('ru')} — ` : 'до '}
                              {new Date(u.subscription_expires_at).toLocaleDateString('ru')}
                            </span>
                          </div>
                        )}
                        <div className="hidden md:flex items-center gap-1.5 text-zinc-600">
                          <Mail size={11} />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {new Date(u.created_at).toLocaleDateString('ru')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-8 shrink-0">
                      <div className="hidden md:flex gap-8 text-center">
                        <div className="w-16">
                          <div className="text-xl font-black text-white leading-none">{u.watch_count}</div>
                          <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1.5">Видео</div>
                        </div>
                        <div className="w-16">
                          <div className="text-xl font-black text-white leading-none">{u.bookmark_count}</div>
                          <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1.5">Закладки</div>
                        </div>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white text-zinc-600 transition-all active:scale-90">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
};

// ─── Tribute Payments Panel ──────────────────────────────────────────────────

interface TributePayment {
  id: number;
  source: string;
  event_name: string;
  subscription_name: string;
  channel_name: string | null;
  amount: number | null;
  currency: string | null;
  period: string | null;
  expires_at: string | null;
  paid_at: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  user_id: string | null;
  username: string | null;
  user_name: string | null;
}

function TributePaymentsPanel() {
  const [rows, setRows] = useState<TributePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [sub, setSub] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (sub) params.set('subscription_name', sub);
      params.set('limit', '500');
      const data = await apiFetch(`/api/admin/tribute-payments?${params}`);
      setRows(data.payments || []);
      setAllowed(data.allowed || []);
    } catch {} finally { setLoading(false); }
  }, [q, sub]);

  useEffect(() => { load(); }, [load]);

  const fmtAmount = (k: number | null, c: string | null) => k == null ? '—' : `${(k / 100).toLocaleString('ru')} ${(c || 'rub').toUpperCase()}`;
  const fmtDate = (s: string | null) => !s ? '—' : new Date(s).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const total = rows.reduce((a, r) => a + (r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по @username / tg id / логину"
            className="w-full bg-zinc-900/60 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40"
          />
        </div>
        <select
          value={sub}
          onChange={e => setSub(e.target.value)}
          className="bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
        >
          <option value="">Все подписки</option>
          {allowed.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={load} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white">
          Обновить
        </button>
      </div>

      <div className="flex gap-3 text-sm text-zinc-400">
        <span>Платежей: <b className="text-white">{rows.length}</b></span>
        <span>Сумма: <b className="text-white">{fmtAmount(total, rows[0]?.currency || 'rub')}</b></span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">Нет данных</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2 px-3">Дата</th>
                <th className="text-left py-2 px-3">Пользователь</th>
                <th className="text-left py-2 px-3">Подписка</th>
                <th className="text-left py-2 px-3">Событие</th>
                <th className="text-right py-2 px-3">Сумма</th>
                <th className="text-left py-2 px-3">Истекает</th>
                <th className="text-left py-2 px-3">Источник</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-zinc-400 whitespace-nowrap">{fmtDate(r.paid_at)}</td>
                  <td className="py-2 px-3">
                    {r.username ? (
                      <div>
                        <p className="text-white">{r.user_name || r.username}</p>
                        <p className="text-zinc-500 text-xs">@{r.username}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-zinc-400">{r.telegram_username ? `@${r.telegram_username}` : '—'}</p>
                        <p className="text-zinc-600 text-xs">TG: {r.telegram_user_id}</p>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-zinc-300">{r.subscription_name}</td>
                  <td className="py-2 px-3 text-zinc-400">{r.event_name}</td>
                  <td className="py-2 px-3 text-right text-white">{fmtAmount(r.amount, r.currency)}</td>
                  <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">{fmtDate(r.expires_at)}</td>
                  <td className="py-2 px-3"><span className="text-xs text-zinc-500 uppercase">{r.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
