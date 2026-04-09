import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import Database from "better-sqlite3";
import fetch from "node-fetch";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, importPKCS8 } from "jose";
import crypto from "crypto";
import pino from "pino";
import { z } from "zod";
import webpush from "web-push";

const log = pino({
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

process.on("unhandledRejection", (reason, promise) => {
  log.error({ promise, reason }, "[Fatal] Unhandled Rejection");
});
process.on("uncaughtException", (err) => {
  log.error(err, "[Fatal] Uncaught Exception");
  process.exit(1);
});

// Load content.json once at startup
let contentJson: any = null;
try {
  const raw = readFileSync(path.join(__dirname, "content.json"), "utf-8");
  contentJson = JSON.parse(raw);
  log.info("[Content] Loaded content.json successfully");
} catch (e) {
  log.warn("[Content] content.json not found or invalid: " + (e as Error).message);
}
const KINESCOPE_API_URL = "https://api.kinescope.io/v1";
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// VAPID keys for Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.APP_URL || "https://localhost:3000",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  log.info("[Push] VAPID keys configured");
} else {
  log.warn("[Push] VAPID keys not set — push notifications disabled. Generate with: npx web-push generate-vapid-keys");
}

// Config constants
const ALLOWED_PROJECTS = {
  broadcasts: ['cc147751-488b-4701-92c0-14f77e068ebe'],
  seminars: ['75a3101e-c447-40bf-9dac-6ab66d06cfe9', '998ad1d1-b0a1-47e1-aa40-58a295fb142e'],
  materials: ['75a3101e-c447-40bf-9dac-62c5cd40fcab']
};

const db = new Database("data.db");

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS watch_history (
    user_id TEXT,
    video_id TEXT,
    progress INTEGER,
    last_position REAL,
    last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
    video_title TEXT,
    video_poster TEXT,
    PRIMARY KEY (user_id, video_id)
  );
  
  CREATE TABLE IF NOT EXISTS watch_later (
    user_id TEXT,
    video_id TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    name TEXT,
    password_hash TEXT,
    tier TEXT DEFAULT 'free',
    is_admin INTEGER DEFAULT 0,
    subscription_expires_at TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS catalog_categories (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    category_key TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS catalog_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    kinescope_folder_id TEXT,
    kinescope_project_id TEXT,
    video_ids TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    video_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS seminar_broadcasts (
    seminar_id TEXT PRIMARY KEY,
    broadcast_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS live_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target TEXT DEFAULT 'all',
    target_user_ids TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id TEXT NOT NULL,
    notification_id INTEGER NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_id)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'RUB',
    status TEXT NOT NULL DEFAULT 'pending',
    save_payment_method INTEGER DEFAULT 0,
    payment_method_id TEXT,
    idempotency_key TEXT UNIQUE,
    confirmation_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    ai_reply TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations for existing tables (in case they weren't created with columns above)
try { db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN subscription_expires_at TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN notes TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN settings_json TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_history ADD COLUMN video_title TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_history ADD COLUMN video_poster TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_history ADD COLUMN video_duration TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_history ADD COLUMN video_duration_sec INTEGER"); } catch {}
try { db.exec("ALTER TABLE watch_history ADD COLUMN video_embed_url TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_later ADD COLUMN video_title TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_later ADD COLUMN video_poster TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_later ADD COLUMN video_duration TEXT"); } catch {}
try { db.exec("ALTER TABLE watch_later ADD COLUMN video_duration_sec INTEGER"); } catch {}
try { db.exec("ALTER TABLE watch_later ADD COLUMN video_embed_url TEXT"); } catch {}
try { db.exec("ALTER TABLE catalog_items ADD COLUMN external_url TEXT"); } catch {}
try { db.exec("ALTER TABLE catalog_items ADD COLUMN links_json TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN payment_method_id TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN trial_used INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN auto_renew INTEGER DEFAULT 0"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_id TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_username TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_first_name TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_last_name TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_photo_url TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN telegram_auth_date INTEGER"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL"); } catch {}

// Seed catalog (idempotent - only if empty)
const catalogSeedData = {
  seminars: [
    {
      key: 'sca', label: 'Семинары SCA',
      items: [
        { folder: '811cf673-5612-49a9-938b-316660a6c728', project: null, videoIds: null, title: 'Обратная сторона успеха 2023', description: 'Первый семинар SCA. 5–8 сентября 2023. Международный семинар с топ-лекторами из СНГ. Теория + практика, максимум общения и обмена опытом.', count: 28 },
        { folder: '42fe4afa-af7b-4aca-aaeb-26dcf5401cd7', project: null, videoIds: null, title: 'Плавание без границ', description: 'Теория + круглый стол. Максимум общения и обмена опытом. Новый формат, где слушатели и специалисты решают задачи вместе.', count: 14 },
        { folder: '93ee737c-bd18-40f4-949e-90293a274869', project: null, videoIds: null, title: 'Плавание для всех: как полюбить воду', description: '11–13 апреля 2024. Начальная подготовка. Мастер-классы и интерактивные лекции. Острые темы от лучших спикеров СНГ.', count: 16 },
        { folder: '3a53098a-abdd-4af3-9546-bf421cfe7876', project: null, videoIds: null, title: 'Начальная подготовка: шаг за шагом к успеху', description: 'Астана, май 2024. Про начальную подготовку от тренеров, психологов и родителей.', count: 12 },
        { folder: '6d99f65c-0026-4ef8-add2-d215f2ef4bbc', project: null, videoIds: null, title: 'Обратная сторона успеха 2024', description: '4–6 ноября 2024. Высшее мастерство. Лекторы — тренеры Олимпийских чемпионов, одни из лучших в мире.', count: 24 },
        { folder: '96fd659b-31f9-4235-92f3-9d4975ac887b', project: null, videoIds: null, title: 'ПЛАВАНИЕ 2.0. Фундамент для будущих чемпионов', description: 'Сэкономьте 10 лет карьеры, переняв опыт лучших специалистов со всего мира на главной конференции о плавании.', count: 20 },
        { folder: 'ef4601b6-d9ac-4a64-937d-62c5cd40fcab', project: null, videoIds: null, title: 'Разрыв шаблонов', description: '400 спортсменов из 5 стран мира в одном онлайн-мероприятии.', count: 8 },
      ]
    },
    {
      key: 'foreign', label: 'Иностранные',
      items: [
        { folder: 'd1f38a94-6ad2-4c56-a698-58d06b6ab55d', project: null, videoIds: null, title: 'Первая европейская тренерская конференция LEN', description: 'Профессиональное собрание высокого уровня. Методологическое мастерство от элитных тренеров и учёных.', count: 11 },
        { folder: '11e3766e-c5c2-4788-9944-7996c3a98ba5', project: null, videoIds: null, title: 'Конференция Learn To Swim 2023', description: 'Международная конференция по обучению плаванию для специалистов. Переведена на русский язык.', count: 9 },
        { folder: '3997c141-ca84-42f0-80d5-248b0ff53af4', project: null, videoIds: null, title: 'FINA Golden Coaches Clinic 2016', description: 'Официальный семинар от международной федерации плавания World Aquatics (бывшая FINA).', count: 26 },
        { folder: '3e44ab35-5d10-4ef0-965d-4af4c8e006f6', project: null, videoIds: null, title: 'FINA Golden Coaches Clinic 2018', description: 'Официальный семинар от международной федерации плавания World Aquatics. 2018 год.', count: 24 },
        { folder: '0e879e60-6ba3-4133-8770-284cd1430cda', project: null, videoIds: null, title: 'Тренерская конференция в Форт-Лодердейле (США)', description: 'Встреча специалистов в области спорта. Лекции от ведущих экспертов, обмен опытом и современные методики развития.', count: 19 },
      ]
    },
    {
      key: 'other', label: 'Другие организации',
      items: [
        { folder: '8bcfe092-8ee6-40ab-b771-bad8c8d6c58c', project: null, videoIds: null, title: 'Серия выступлений Дэвида Марша', description: 'Qazaq Aquatic семинар с американским тренером. Лекции от одного из ведущих тренеров США.', count: 5 },
        { folder: '1c36282e-f1ca-4898-9aed-dab923229089', project: null, videoIds: null, title: 'Семинар Aqua Fest', description: 'Семинар по плаванию AQUA FEST 28–29 августа 2025 года.', count: 7 },
        { folder: '3afd0464-84f1-47a9-9ab2-c27dd721bd66', project: null, videoIds: null, title: 'Сборник конференций и семинаров ВФП', description: 'Доступ к записям, материалам и ключевым выводам мероприятий, посвящённых развитию плавания в России.', count: 17 },
        { folder: 'a327668d-16d7-4494-873b-d2de9291868f', project: null, videoIds: null, title: 'Материалы Европейской федерации плавания LEN', description: 'Доступ к записям от лучших тренеров Европы и мира. Лекции для тренеров и спортсменов.', count: 10 },
        { folder: '0971e5ce-d33b-4f39-a30b-525a61913916', project: null, videoIds: null, title: 'Семинар при поддержке НОК Беларуси 2023', description: 'Семинар для тренеров по плаванию при поддержке Национального Олимпийского Комитета Беларуси.', count: 7 },
        { folder: '4cb0cd5d-c2d5-46c2-8b3f-9e00b6f2206c', project: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', videoIds: null, title: 'Онлайн конференция по психологии', description: 'Онлайн конференция спортивной психологии для родителей и спортсменов.', count: 12 },
      ]
    },
  ],
  materials: [
    {
      key: 'technique', label: 'Техника и навыки',
      items: [
        { folder: 'c9a70dfe-0d7c-4f56-a497-5b83d4c8c56e', project: null, videoIds: null, title: 'Конструкция подводки от Александра Осипенко', description: 'Мастерство выполнения подводной фазы и подхода к старту/повороту.', count: 7 },
        { folder: 'bc609c6c-ec3b-4d17-ba29-13272d17d5e6', project: null, videoIds: null, title: 'Серия видео Калеба Дрессела (RU)', description: 'Разбор техники вместе с 9-кратным Олимпийским чемпионом. Серия видео от Калеба Дрессела на русском языке.', count: 6 },
        { folder: '8cd09764-3024-473c-818d-364f933b952d', project: null, videoIds: null, title: 'Серия видео Калеба Дрессела (EN)', description: 'Оригинальная серия видео от Калеба Дрессела на английском языке.', count: 6 },
        { folder: 'ab26964f-976f-4e91-b1c4-026366f5546b', project: null, videoIds: null, title: 'Образовательные материалы GRC', description: 'Разработки и методики от Glenn Mills и команды GRC.', count: 6 },
        { folder: null, project: null, videoIds: 'dpiA6zUTA8UNuxpMJE3MP6,8gtzHL3xHJfqxJVWLPTYzG', title: 'Мастер-класс рекордсмена мира Егора Корнева', description: 'Техника плавания от рекордсмена мира. Разбор части на воде и на суше.', count: 2 },
      ]
    },
    {
      key: 'training', label: 'Тренировки и упражнения',
      items: [
        { folder: '363f704b-e3e5-4797-8fde-aef816233c32', project: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', videoIds: null, title: 'ОФП на суше с Постовым А.И.', description: 'Упражнения для развития силы и выносливости вне воды.', count: 15 },
        { folder: 'ffe93a8c-9170-45af-846b-d47b92b84ada', project: null, videoIds: null, title: 'Комплексы упражнений от Александра Чиркина', description: 'Комплексы упражнений базового уровня на суше и в воде от тренера Александра Чиркина.', count: 2 },
        { folder: '08eb9bc1-c3e4-4868-887a-5754b2e27eac', project: null, videoIds: null, title: 'Лекции Александра Манкевича', description: 'Тактика и методика подготовки пловцов. Лекции из СК Альбатрос, Волгоград.', count: 23 },
        { folder: null, project: null, videoIds: 'jfNrEKt4228C3iHQiYjzDp,nXD75RpCS7wskURscXVTH4', title: 'Выездной мастер-класс Яськевич Ольги', description: 'Работа с группой на выезде: тренировка в зале и тренировка на воде.', count: 2 },
      ]
    },
    {
      key: 'masterclass', label: 'Мастер-классы тренеров',
      items: [
        { folder: 'ef1fc503-fb65-45a9-85a5-e9f866f63c90', project: null, videoIds: null, title: 'Мастер-классы в Ниагара Фитнес', description: 'Опыт и подходы к подготовке спортсменов. Выездные мастер-классы ведущих тренеров.', count: 23 },
        { folder: '782701d7-e44f-4388-84b7-b1984fdc7237', project: '998ad1d1-b0a1-47e1-aa40-58a295fb142e', videoIds: null, title: 'Комплексный подход Тодда ДеСорбо', description: 'Тренировки по спринтерскому вольному стилю от тренера Олимпийских чемпионов.', count: 2 },
      ]
    },
    {
      key: 'science', label: 'Научно-образовательные',
      items: [
        { folder: 'fed6e3d1-0c0c-4341-a4c0-2e675ec3b3f8', project: '75a3101e-c447-40bf-9dac-62c5cd40fcab', videoIds: null, title: 'Курс по психологии от Мулярчик', description: 'Эффективные методы мотивации, работа с подростками, переходный возраст в спорте.', count: 9 },
        { folder: null, project: null, videoIds: 'knH1aKbitsov7dnBhpU8ts,0ADWnGw3FKr6beGhedZ8u7,4pG5DLf1Sqq8U5a9KkZHFk,g12QpPK32uxydi11jano3z,2eRWsCvLqx5VqVapm91JNj,wY615ttAFSPPAzWWoiN8Jm,cZzUWBZ4DP5gCoKitEeBmj,2a4UqQCMLhXGJeuz8frFVo,oDknMJ5ncvMPVQAYPbHgbW', title: 'Курс по психологии «Пульт управления мозгом»', description: 'Курс спортивной психологии. Постановка целей, управление эмоциями, оптимальное боевое состояние и работа со страхом соревнований.', count: 9 },
        { folder: null, project: null, videoIds: 'a3NuVnyUS7mTcSakNn8eUf,9u3rYoBTHuSSGtJtJVahe5,rxVTfpJZPfR3aJrnnRJ9AG,gSERBZtmqtQMtX7k2fbjoF,0X1AaczsbhqJhTrgPVKSDo,pcCY99YmADry2MzRcPfp25,eikHcoecr8XxT9TE9BamP9,qXntcCpvtD32rn6ixhwgcw,t27E7uDcZYr3x3wEqbyZfH,vFo7ZrHBcsXgN7GYF77AFB,9rdPviRDa8TsfRBk66rXKn,pgiFbJYHbgCjkDCAM7r7sT,7tbdw7bmganngrHvtjLLGs,kFJWMad5idnvyxnVbQdMSQ,oWUu3EoEq1bgkNPsnrne6R', title: 'Сборник от Белорусского ГУФК', description: 'Конференции и лекции от Белорусского государственного университета физической культуры.', count: 15 },
        { folder: '2ea20880-0c9f-4044-8d97-1cd1018d4e5e', project: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', videoIds: null, title: 'Образовательные материалы Aqualibrium', description: 'Школа плавания и фридайвинга. Курс по методике Total Immersion и открытой воде.', count: 10 },
        { folder: null, project: null, videoIds: 'rL1PJeB4hQE21RMh9qFVaT,dVtkFgo4WvFvBPETW8bb9K,g5fJZpjVSdHPPE1G2Hku8r,e3CNvA46tab6C11sq1F7Hr,6VmZrBuV95Rjed6JSL68F1,3GjmAykpjupdVLMRoZjsjL,7KsEgCVSNzAJhCAm987ycY', title: 'Подборка от WORLD AQUATICS (RU)', description: 'Официальные материалы международной федерации. Разборы лучших пловцов и соревнований 2024–2025.', count: 7 },
      ]
    },
    {
      key: 'international', label: 'Международные школы',
      items: [
        { folder: '012002f8-d567-4a78-8092-920bfcaca1e7', project: null, videoIds: null, title: 'Видео от The Race Club', description: 'Материалы от плавательного лагеря The Race Club, основанного Гэри Холлом-старшим и его сыном — обладателями 10 олимпийских медалей.', count: 121 },
      ]
    },
    {
      key: 'motivation', label: 'Личности и мотивация',
      items: [
        { folder: '4cb0cd5d-c2d5-46c2-8b3f-9e00b6f2206c', project: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', videoIds: null, title: 'Семинар «Воспитай Чемпиона»', description: 'Ценности, привычки и методы подготовки спортсменов мирового уровня.', count: 12 },
        { folder: '70a805db-2189-43c9-ba25-e87ff22af4de', project: '998ad1d1-b0a1-47e1-aa40-58a295fb142e', videoIds: null, title: 'Материалы WORLD AQUATICS', description: 'Успех олимпийских чемпионов: Сара Сьёстрём, Адам Пити, Давид Попович — рассказы их тренеров.', count: 7 },
        { folder: null, project: null, videoIds: '53M9ePEDAoCN3FGTzCs8Z3,3ADSKcLdffYdFH7UKGagZm,5WT7ATTW7GDgZntSJi5VLA,6rswEoFtoPrsXu84mxugJ9,tkhXKFG7JrfKdUsGJG5kY7,t3751GPkdDuzjPX47v25tb,tJ2eQ74nTMms3WWe3dM1g4,mkkQvkmegsLvN82XFRtkfe', title: 'Интервью с Бобом Боуманом', description: 'Серия интервью с тренером Майкла Фелпса. Характеристики чемпионов и секреты подготовки к Олимпийским играм.', count: 8 },
        { folder: null, project: null, videoIds: 'tHXRo8xxNFYwXKBQ72TbX6,vQ9vAqWUykCH3XGUqJSPce', title: 'Лекция Адриана Радулеску «Успех Давида Поповича в Париже-2024»', description: 'Разбор победного выступления Давида Поповича тренером Адрианом Радулеску. Доступна на русском и английском языках.', count: 2 },
      ]
    },
    {
      key: 'judging', label: 'Судейство',
      items: [
        { folder: null, project: null, videoIds: 'h9kij1ZyXn6GSr5mYkqJvP', title: 'Курс для судей по открытой воде', description: 'Семинар по судейству в плавании на открытой воде для действующих и начинающих судей.', count: 1 },
        { folder: null, project: null, videoIds: 'duDrMUUrb7Yy3G1x6g3SJd', title: 'Семинар по судейству в плавании', description: 'Разбор правил и практики судейства в плавании. Для действующих и начинающих судей.', count: 1 },
      ]
    },
  ],
};

try {
  const catCount = (db.prepare("SELECT COUNT(*) as c FROM catalog_categories").get() as any).c;
  if (catCount === 0) {
    const insertCat = db.prepare("INSERT INTO catalog_categories (id, section, category_key, label, sort_order) VALUES (?, ?, ?, ?, ?)");
    const insertItem = db.prepare("INSERT INTO catalog_items (id, category_id, kinescope_folder_id, kinescope_project_id, video_ids, title, description, video_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const seedTx = db.transaction(() => {
      let catOrder = 0;
      for (const cat of catalogSeedData.seminars) {
        const catId = crypto.randomUUID();
        insertCat.run(catId, 'seminars', cat.key, cat.label, catOrder++);
        let itemOrder = 0;
        for (const item of cat.items) {
          insertItem.run(crypto.randomUUID(), catId, item.folder, item.project, item.videoIds, item.title, item.description, item.count, itemOrder++);
        }
      }
      catOrder = 0;
      for (const cat of catalogSeedData.materials) {
        const catId = crypto.randomUUID();
        insertCat.run(catId, 'materials', cat.key, cat.label, catOrder++);
        let itemOrder = 0;
        for (const item of cat.items) {
          insertItem.run(crypto.randomUUID(), catId, item.folder, item.project, item.videoIds, item.title, item.description, item.count, itemOrder++);
        }
      }
    });
    seedTx();
    log.info('[DB] Catalog seeded successfully');
  }
} catch (e) {
  log.error(e, '[DB] Catalog seed error');
}

// Seed seminar slides category — DISABLED (slides are now embedded inside video folders)
try {
  const existing = db.prepare("SELECT id FROM catalog_categories WHERE category_key = ? AND section = ?").get('seminar_slides', 'materials');
  // Delete if still present from old seeding
  if (existing) {
    db.prepare("DELETE FROM catalog_items WHERE category_id = ?").run((existing as any).id);
    db.prepare("DELETE FROM catalog_categories WHERE id = ?").run((existing as any).id);
    log.info('[DB] Removed obsolete seminar_slides category');
  }
  if (false) {
    const catId = crypto.randomUUID();
    const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM catalog_categories WHERE section = ?").get('materials') as any)?.m ?? 0;
    db.prepare("INSERT INTO catalog_categories (id, section, category_key, label, sort_order) VALUES (?, ?, ?, ?, ?)").run(catId, 'materials', 'seminar_slides', 'Слайды семинаров', maxOrder + 1);
    const insertSlide = db.prepare("INSERT INTO catalog_items (id, category_id, title, description, video_count, links_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const slideItems = [
      {
        title: '«Начальная подготовка: шаг за шагом к успеху»',
        description: 'Слайды и материалы лекций. Астана, май 2024.',
        links: [
          { title: 'Лекция №2 — Фундамент будущих результатов. Суша у пловцов 7–10 лет', url: 'https://drive.google.com/file/d/1Nex_LIqkw3fvSJyf39jiM4eMeIye84QU/view?usp=sharing' },
          { title: 'Лекция №3 — Как совмещать учёбу и спорт высших достижений', url: 'https://drive.google.com/file/d/1sYT8KajZQiDV18Ic0uk28yBSr-m7caMY/view?usp=sharing' },
          { title: 'Лекция №4 — Любовь к плаванию. От первой тренировки и на всю жизнь', url: 'https://drive.google.com/file/d/1xjYe-lCMqFl4Ggn7RJoldsCcCEREe3uB/view?usp=sharing' },
          { title: 'Лекция №5 — Питание юных пловцов', url: 'https://drive.google.com/file/d/14VJggx3yB5ofezxOzfBsg6SsCI8ZKE3d/view?usp=sharing' },
          { title: 'Лекция №6 — Педагогика и психология как двигатель тренировочного процесса', url: 'https://drive.google.com/file/d/1uA6XP_i-ykPiewWXNPr-mxi2Wapkd8fE/view?usp=sharing' },
          { title: 'Лекция №7 (ч. 1) — Секреты Чемпионов. Спортивная психология', url: 'https://docs.google.com/presentation/d/1bVZ6FNhe4_Bm9dnjOzs7Mt-TgJHIoIRKehDslv9Cwdg/edit?usp=sharing' },
          { title: 'Лекция №7 (ч. 2) — Секреты Чемпионов. Спортивная психология', url: 'https://docs.google.com/presentation/d/1yyN-e4gbTO9Osq5sf_iKMyiDLynTGgUxchV2Best4MI/edit?usp=sharing' },
          { title: 'Родительский день — Питание в плавании', url: 'https://drive.google.com/file/d/1dhOC_-w0dISNCo_sWhD-WKEewEuHKxmV/view?usp=sharing' },
        ],
      },
      {
        title: '«Плавание для всех: как полюбить воду»',
        description: 'Слайды и материалы лекций. 11–13 апреля 2024.',
        links: [
          { title: 'Лекция №1 — Александр Осипенко. Ассоциации как ключ к улучшению техники', url: 'https://docs.google.com/presentation/d/18B-OKXgezEtx5-ipLa-7T27hS-ToWBz_/edit?usp=sharing' },
          { title: 'Лекция №2 — Сергей Хожемпо. Программно-методическое обеспечение начальной подготовки', url: 'https://docs.google.com/presentation/d/1xoa65R938hXPZaXPS-75OPeYslSstw9K/edit?usp=sharing' },
          { title: 'Лекция №3 — Ольга Яськевич. Начало тренерского пути', url: 'https://drive.google.com/drive/folders/10OMDVWW4rmPuCkfTXARlxCOH2Spez__q?usp=sharing' },
          { title: 'Мастер-класс №2 — Екатерина Мулярчик. Когнитивные тренировки (игра Square)', url: 'https://drive.google.com/drive/folders/1_XageA3WDDmHw9AwzOGd7BFdpHHjiUEx?usp=sharing' },
          { title: 'Лекция №4 — Иван Матюшов. Харизма тренера', url: 'https://drive.google.com/drive/folders/1-9lmbK6vDfXwDFvfOO1OxM46qy7Pz-Lh?usp=sharing' },
          { title: 'Лекция №6 — Александр Брилевский. Обучение плаванию детей с нуля (6–12 лет)', url: 'https://drive.google.com/drive/folders/1-FjL9hIr57FMkg0ipp5w_HSy-RbMyGM0?usp=sharing' },
          { title: 'Лекция №7 — Екатерина Мулярчик. Стресс и тильт во время соревнований', url: 'https://drive.google.com/drive/folders/1-CAfq8AeXR2y0bjyFjMMwlailhEs1z5M?usp=sharing' },
        ],
      },
      {
        title: '«Обратная сторона успеха»',
        description: 'Слайды и материалы лекций. 5–8 сентября 2023.',
        links: [
          { title: 'Лекции Андрея Шишина — С нуля до золотых медалей Олимпийских игр', url: 'https://drive.google.com/drive/u/2/folders/1xp9xLuECc-Jo7C-Pd1FY3YweZeELkMHx' },
          { title: 'Лекция №2 — Александр Мартынов. Тренировки спринтеров', url: 'https://docs.google.com/presentation/d/1KXNtSMjpkuoH-qd2SWKNyTboJmZL4WzU/edit?usp=sharing' },
          { title: 'Лекция №3 — Елена Малюско. Как тренировать брассиста и спиниста', url: 'https://drive.google.com/file/d/1P68O7SL1s_reQgg4fT3f76YRsJwBsBXK/view?usp=sharing' },
          { title: 'Лекции — Доктор Хом Гарави. Питание, восстановление, тренировки элитных пловцов', url: 'https://drive.google.com/file/d/1NRUjHt2rDXzY2zjKQHXMKq4uqssmYxb4/view?usp=sharing' },
          { title: 'Лекция №7 — Дэйв Сало. Философия тренировок. Физиология в спринте', url: 'https://drive.google.com/drive/folders/1tCnhbil9vBZQbbrmjJVw5GWVMdaqY-NM?usp=sharing' },
          { title: 'Лекция №8 — Александр Осипенко. Подводка к старту как искусство', url: 'https://docs.google.com/presentation/d/1Wj3Rzp_fxe9nCHpPDOiK0l09dMVO_V_z/edit?usp=sharing' },
          { title: 'Лекция №9 — Владислав Поляков. Подготовка студентов-пловцов к пику формы', url: 'https://drive.google.com/file/d/1L0STTxWZkr_UAUOEfbs4Fq9zhVgYX4I4/view?usp=share_link' },
          { title: 'Лекция №10 — Илья Гусаков. Аналитика в плавании', url: 'https://docs.google.com/presentation/d/1DjPLXjWqtFarUq4sBo4PaYZttSYNqboj/edit?usp=sharing' },
          { title: 'Лекция №12 — Игорь Макеев. Как спланировать результат', url: 'https://drive.google.com/drive/folders/1x3B_7P5SnxU6scBsOJRyp_si3XbCiUWH?usp=sharing' },
        ],
      },
      {
        title: '«ПЛАВАНИЕ 2.0. Фундамент для будущих чемпионов»',
        description: 'Слайды и материалы лекций семинара.',
        links: [
          { title: 'Лекция №2 — Екатерина Мулярчик. Формирование дисциплины у детей', url: 'https://drive.google.com/file/d/1J7wLO9_LNwHM12Un6vJ-8hGqgqjYG7N5/view?usp=sharing' },
          { title: 'Лекция №4 — Игорь Михута. Координационная тренировка в плавании', url: 'https://docs.google.com/presentation/d/1GvlRnKWI0SVom2QbEDmNxEfZryIS1At3/edit?usp=sharing' },
          { title: 'Лекция №5 — Виталий Гуро. Профилактика травм плечевого пояса', url: 'https://docs.google.com/presentation/d/1qMtRGtPYtAtR26n9rTgma6i33g9ayig2/preview' },
          { title: 'Лекция №10 — Олег Вагизов. Учебная программа для ДЮСШ / СДЮСШОР', url: 'https://docs.google.com/presentation/d/19NZWHmkBTOyuoRrOy3OE4J4sj7T9veZZ/preview' },
          { title: 'Лекция №12 — Ольга Ясенович. Фундамент сильной команды', url: 'https://drive.google.com/file/d/1uzuuwF0fbVn1RIclF9UgxR0kAXfu5FUo/preview' },
        ],
      },
      {
        title: '«Разрыв шаблонов» (семинар для спортсменов)',
        description: 'Слайды и материалы лекций семинара.',
        links: [
          { title: 'Лекция №1 — Софья Сподаренко. Как плавать и жить так, чтобы не жалеть', url: 'https://drive.google.com/file/d/1RLco1ub606WOIMKtoy5SRNU1tI-IJ3G7/preview' },
          { title: 'Лекция №2 — Андрей Минаков. Совмещение спорта и учёбы. Поступление за рубеж', url: 'https://drive.google.com/file/d/1fF_mGplu3kJdMutPGI6rSjJIufOGuWm0/preview' },
          { title: 'Лекция №4 — Иван Кожакин. PRO трудности и мотивацию на пути к чемпионству', url: 'https://drive.google.com/file/d/1tpunSHbyeNFxrh2UeGessXVSpw_Vx5MF/preview' },
        ],
      },
      {
        title: 'Семинар при поддержке НОК Беларуси 2023',
        description: 'Слайды и материалы лекций семинара.',
        links: [
          { title: 'Лекция №2 — Евгений Акимов. БАДы в спорте', url: 'https://docs.google.com/presentation/d/1wThJctjhfGjgb2bdQuuRqD_2eHw5oX4P/edit?usp=sharing' },
          { title: 'Лекция №3 — Евгений Платонов. Планирование подготовки пловцов высокого уровня', url: 'https://drive.google.com/file/d/1-7s_8Ei7h2yru2hb6ox4uER3QKWRE4Qx/view?usp=sharing' },
          { title: 'Лекция №5 — Елена Малюско. Секреты современного брасса', url: 'https://drive.google.com/drive/folders/1za0y4DZB4qwHvIjYgSL4n-wjBJdeoDWF?usp=sharing' },
        ],
      },
      {
        title: '«Aqua Fest»',
        description: 'Материалы для скачивания с семинара Aqua Fest.',
        links: [
          { title: 'Папка с материалами семинара', url: 'https://drive.google.com/drive/folders/1-liAgeLqjillhkEGVSrLBXKXWNRXGmRa?usp=share_link' },
        ],
      },
    ];
    const insertSlidesTx = db.transaction(() => {
      slideItems.forEach((item, i) => {
        insertSlide.run(crypto.randomUUID(), catId, item.title, item.description, item.links.length, JSON.stringify(item.links), i);
      });
    });
    insertSlidesTx();
    log.info('[DB] Seminar slides seeded successfully');
  }
} catch (e) {
  log.error(e, '[DB] Seminar slides seed error');
}

// Promote ADMIN_USERNAME to admin if set
if (process.env.ADMIN_USERNAME) {
  try {
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run(process.env.ADMIN_USERNAME);
  } catch {}
}

// Initialize live_broadcast_active default
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('live_broadcast_active', '0')").run();

// ─── Live broadcast RSA keys (for Kinescope chat JWT) ────────────────────────
let liveRSAPrivateKey: any = null;
let liveRSAKid = '';

async function initLiveRSAKeys() {
  try {
    const privRow = db.prepare("SELECT value FROM settings WHERE key = 'live_rsa_private_key'").get() as any;
    const kidRow  = db.prepare("SELECT value FROM settings WHERE key = 'live_rsa_kid'").get() as any;
    if (privRow?.value && kidRow?.value) {
      liveRSAPrivateKey = await importPKCS8(privRow.value, 'RS256');
      liveRSAKid = kidRow.value;
      log.info({ kid: liveRSAKid }, '[Live] Loaded RSA key');
      return;
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const kid = `sca-${Date.now()}`;
    const jwk = publicKey.export({ format: 'jwk' }) as any;
    jwk.kid = kid; jwk.use = 'sig'; jwk.alg = 'RS256';
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_rsa_private_key', ?)").run(privateKeyPem);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_rsa_public_jwk', ?)").run(JSON.stringify(jwk));
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_rsa_kid', ?)").run(kid);
    liveRSAPrivateKey = await importPKCS8(privateKeyPem, 'RS256');
    liveRSAKid = kid;
    log.info({ kid }, '[Live] Generated RSA key pair');
  } catch (e) {
    log.error(e, '[Live] RSA key init error');
  }
}

function extractKinescopeId(url: string): string | null {
  const m = url.match(/kinescope\.io\/(?:embed\/)?([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function normalizeKinescopeUrl(url: string): string {
  const plain = url.trim().match(/^https?:\/\/kinescope\.io\/([^/\s?#]+)$/);
  return plain ? `https://kinescope.io/embed/${plain[1]}` : url.trim();
}

// Middleware for auth
async function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Admin middleware
async function requireAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.user = payload;
    const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get((payload as any).id) as any;
    if (!row?.is_admin) return res.status(403).json({ error: "Forbidden" });
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Helper for Kinescope API calls with retry on ECONNRESET
async function kinescopeFetch(endpoint: string, options: any = {}, retries = 3): Promise<any> {
  const url = `${KINESCOPE_API_URL}${endpoint}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${process.env.KINESCOPE_TOKEN}`,
          ...options.headers,
        },
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Kinescope API error: ${response.status} - ${err}`);
      }
      return response.json();
    } catch (e: any) {
      const isRetryable = e.code === "ECONNRESET" || e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT";
      if (isRetryable && attempt < retries) {
        const delay = attempt * 500;
        log.warn({ code: e.code, attempt, delay }, `[Kinescope] Retrying request...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTimecodeToSec(tc: any): number {
  if (!tc || typeof tc !== 'string') return 0;
  const parts = tc.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatKinescopeVideo(v: any, overrideId?: string) {
  const durationSec = v.duration ?? 0;
  const chapters = v.chapters?.enabled && v.chapters?.list?.length
    ? v.chapters.list.map((c: any) => ({ title: c.title, timeSec: parseTimecodeToSec(c.time) }))
    : [];
  // Prefer the ID extracted from embed_link over v.id, since Kinescope may return
  // a numeric internal ID (e.g. 31) in v.id while embed_link contains the real video identifier.
  const embedLinkId = typeof v.embed_link === 'string'
    ? v.embed_link.split('/').pop()?.split('?')[0] || null
    : null;
  const id = overrideId || embedLinkId || v.id;
  return {
    id,
    title: v.title || '',
    duration: durationSec ? formatDuration(durationSec) : '—',
    durationSec,
    embedUrl: v.embed_link || `https://kinescope.io/embed/${id}`,
    posterUrl: v.poster?.md ?? v.poster?.original ?? null,
    createdAt: v.created_at || '',
    tags: v.tags ?? [],
    chapters,
    folder_id: v.folder_id ?? null,
    project_id: v.project_id ?? null,
  };
}

// ─── YooKassa ────────────────────────────────────────────────────────────────

const YUKASSA_BASE = 'https://api.yookassa.ru/v2';
const YUKASSA_SHOP_ID = process.env.YUKASSA_SHOP_ID || '';
const YUKASSA_SECRET_KEY = process.env.YUKASSA_SECRET_KEY || '';

/** Subscription plans: id → { label, price (RUB), days } */
const PLANS: Record<string, { label: string; amount: number; days: number }> = {
  '1month':   { label: '1 месяц',   amount: 1200, days: 30  },
  '6months':  { label: '6 месяцев', amount: 5900, days: 180 },
  '1year':    { label: '1 год',     amount: 9900, days: 365 },
};

/** YooKassa IP ranges for webhook verification */
const YUKASSA_IP_CIDRS = [
  '185.71.76.0/27', '185.71.77.0/27',
  '77.75.153.0/25', '77.75.156.11/32',
  '77.75.156.35/32', '54.61.40.217/32',
];

function ipToNum(ip: string): number {
  return ip.split('.').reduce((a, o) => (a << 8) | parseInt(o), 0) >>> 0;
}
function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = (~((1 << (32 - +bits)) - 1)) >>> 0;
  return (ipToNum(ip) & mask) === (ipToNum(range) & mask);
}
function isYooKassaIp(ip: string): boolean {
  if (process.env.NODE_ENV !== 'production') return true; // allow any IP in dev/test
  return YUKASSA_IP_CIDRS.some(c => ipInCidr(ip, c));
}

function yukassaAuth(): string {
  return 'Basic ' + Buffer.from(`${YUKASSA_SHOP_ID}:${YUKASSA_SECRET_KEY}`).toString('base64');
}

async function ykFetch(path: string, method = 'GET', body?: object, idempotencyKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': yukassaAuth(),
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${YUKASSA_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

/** Get real IP from request (handles proxy) */
function getClientIp(req: any): string {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.connection?.remoteAddress || req.ip || '';
}

/** Extend user subscription by N days from now (or from current expiry if still active) */
function extendSubscription(userId: string, days: number, paymentMethodId?: string | null, autoRenew?: boolean): void {
  const row = db.prepare("SELECT subscription_expires_at FROM users WHERE id = ?").get(userId) as any;
  const now = Date.now();
  const base = row?.subscription_expires_at ? Math.max(now, new Date(row.subscription_expires_at).getTime()) : now;
  const newExpiry = new Date(base + days * 86400_000).toISOString();

  const updates: string[] = ["tier = 'premium'", "subscription_expires_at = ?"];
  const params: any[] = [newExpiry];
  if (paymentMethodId !== undefined) { updates.push("payment_method_id = ?"); params.push(paymentMethodId); }
  if (autoRenew !== undefined) { updates.push("auto_renew = ?"); params.push(autoRenew ? 1 : 0); }
  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

/** Verify a payment by re-fetching from YooKassa API (never trust just the webhook body) */
async function verifyAndProcessPayment(paymentId: string): Promise<void> {
  const yk = await ykFetch(`/payments/${paymentId}`);
  if (!yk?.id) return;

  const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as any;
  if (!row) return;
  if (row.status === 'succeeded') return; // already processed

  db.prepare("UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(yk.status, paymentId);

  if (yk.status !== 'succeeded') return;

  const plan = PLANS[row.plan];
  if (!plan) return;

  // Save payment method ID if requested and returned
  const savedMethodId = yk.payment_method?.saved ? yk.payment_method.id : null;

  extendSubscription(
    row.user_id,
    plan.days,
    savedMethodId ?? (row.save_payment_method ? null : undefined),
    savedMethodId ? true : undefined,
  );

  if (savedMethodId) {
    db.prepare("UPDATE payments SET payment_method_id = ? WHERE id = ?").run(savedMethodId, paymentId);
  }

  log.info({ paymentId, userId: row.user_id, plan: row.plan }, '[YK] Payment processed');
}

/** Auto-renew scheduler: runs every hour, charges cards for expiring subscriptions */
function startRenewalScheduler(): void {
  const run = async () => {
    try {
      // Find users with auto_renew=1 and subscription expiring within 3 hours
      const soon = new Date(Date.now() + 3 * 3600_000).toISOString();
      const users = db.prepare(`
        SELECT id, payment_method_id, subscription_expires_at
        FROM users
        WHERE tier = 'premium' AND auto_renew = 1 AND payment_method_id IS NOT NULL
          AND subscription_expires_at <= ?
      `).all(soon) as any[];

      for (const u of users) {
        // Find most recent successful payment to get the plan
        const lastPayment = db.prepare(`
          SELECT plan FROM payments
          WHERE user_id = ? AND status = 'succeeded'
          ORDER BY created_at DESC LIMIT 1
        `).get(u.id) as any;
        if (!lastPayment) continue;

        const plan = PLANS[lastPayment.plan];
        if (!plan) continue;

        const idempotencyKey = `renew-${u.id}-${Date.now()}`;
        const paymentId = crypto.randomUUID();

        const body = {
          amount: { value: plan.amount.toFixed(2), currency: 'RUB' },
          capture: true,
          payment_method_id: u.payment_method_id,
          description: `Продление подписки SCA Premium — ${plan.label}`,
          metadata: { user_id: u.id, plan: lastPayment.plan, type: 'renewal' },
        };

        db.prepare(
          "INSERT INTO payments (id, user_id, plan, amount, status, save_payment_method, idempotency_key) VALUES (?, ?, ?, ?, 'pending', 1, ?)"
        ).run(paymentId, u.id, lastPayment.plan, plan.amount, idempotencyKey);

        const yk = await ykFetch('/payments', 'POST', body, idempotencyKey);
        if (yk?.id) {
          db.prepare("UPDATE payments SET id = ? WHERE idempotency_key = ?").run(yk.id, idempotencyKey);
          if (yk.status === 'succeeded') {
            await verifyAndProcessPayment(yk.id);
          } else {
            // Auto-payment failed: disable auto-renew
            db.prepare("UPDATE users SET auto_renew = 0 WHERE id = ?").run(u.id);
            log.warn({ userId: u.id, status: yk.status }, '[YK] Auto-renewal failed');
          }
        }
      }
    } catch (e: any) {
      log.error({ err: e.message }, '[YK] Renewal scheduler error');
    }
  };
  setInterval(run, 60 * 60_000); // every hour
  log.info('[YK] Renewal scheduler started');
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

function verifyTelegramHash(data: Record<string, string>): boolean {
  if (!TELEGRAM_BOT_TOKEN) {
    log.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — skipping hash verification');
    return true; // allow in dev without token
  }
  const { hash, ...rest } = data;
  if (!hash) return false;
  const authDate = parseInt(rest.auth_date || '0');
  if (Date.now() / 1000 - authDate > 86400) return false; // older than 24h
  const dataCheckString = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return computed === hash;
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Неизвестный браузер';

  let browser = 'Браузер';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/YaBrowser/i.test(ua)) browser = 'Яндекс';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Chromium\//i.test(ua)) browser = 'Chromium';

  let os = '';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return os ? `${browser} · ${os}` : browser;
}

function trackDevice(userId: string, deviceId: string, userAgent: string, isAdmin = false): boolean {
  try {
    const existing = db.prepare("SELECT id FROM user_devices WHERE id = ? AND user_id = ?").get(deviceId, userId);
    if (existing) {
      db.prepare("UPDATE user_devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?").run(deviceId, userId);
      return true;
    }
    if (!isAdmin) {
      const count = (db.prepare("SELECT COUNT(*) as c FROM user_devices WHERE user_id = ?").get(userId) as any).c;
      if (count >= 5) return false;
    }
    const name = parseUserAgent(userAgent);
    db.prepare("INSERT INTO user_devices (id, user_id, name) VALUES (?, ?, ?)").run(deviceId, userId, name);
    return true;
  } catch (e: any) {
    log.warn({ err: e.message }, '[Devices] trackDevice error');
    return true;
  }
}

// Cache for the latest broadcast video — populated at startup and refreshed every 10 min
let latestBroadcastCache: { video: any } | null = null;

async function fetchAndCacheLatestBroadcast(): Promise<void> {
  try {
    const projectId = ALLOWED_PROJECTS.broadcasts[0];
    const data = await kinescopeFetch(`/videos?project_id=${projectId}&per_page=500`);
    const raw: any[] = data.data || [];
    const sorted = [...raw].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    const isValidId = (v: any) => {
      const id = String(v.id ?? '');
      return id.length > 4 && !/^\d+$/.test(id);
    };
    const best = sorted.find(isValidId) ?? sorted[0];
    latestBroadcastCache = { video: best ? formatKinescopeVideo(best) : null };
    log.info({ title: latestBroadcastCache.video?.title ?? 'none' }, '[Cache] Latest broadcast video cached');
  } catch (e: any) {
    log.warn({ err: e.message }, '[Cache] Failed to cache latest broadcast');
  }
}

async function startServer() {
  await initLiveRSAKeys();
  fetchAndCacheLatestBroadcast();
  setInterval(fetchAndCacheLatestBroadcast, 10 * 60 * 1000);
  startRenewalScheduler();

  const app = express();
  app.use(express.json());

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // --- Auth Routes ---

  const registerSchema = z.object({
    username: z.string().min(3, "Минимум 3 символа").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Только латинские буквы, цифры, _ . -"),
    password: z.string()
      .min(8, "Пароль должен содержать минимум 8 символов")
      .max(100)
      .regex(/[A-Z]/, "Пароль должен содержать хотя бы одну заглавную букву")
      .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру"),
    name: z.string().min(2, "Введите имя и фамилию").max(100),
    device_id: z.string().max(64).optional(),
  });

  const loginSchema = z.object({
    username: z.string().min(1, "Введите логин"),
    password: z.string().min(1, "Введите пароль"),
    device_id: z.string().max(64).optional(),
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || "Неверные данные";
        return res.status(400).json({ success: false, message: msg });
      }
      const { username, password, name, device_id } = parsed.data;
      log.info({ username }, '[Auth] Register attempt');

      const id = crypto.randomUUID?.() || Date.now().toString();
      const hash = await bcrypt.hash(password, 10);

      db.prepare("INSERT INTO users (id, username, name, password_hash) VALUES (?, ?, ?, ?)").run(id, username, name || "", hash);

      const deviceId = device_id || crypto.randomUUID();
      trackDevice(id, deviceId, req.headers['user-agent'] || '');

      const user = { id, username, name, tier: "free", progress: 0 };
      const token = await new SignJWT(user)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(JWT_SECRET);

      log.info({ username }, '[Auth] Register success');
      res.json({ success: true, token, user, device_id: deviceId });
    } catch (e: any) {
      log.error(e, '[Auth] Register error');
      if (e.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Неверные данные" });
      }
      const { username, password, device_id } = parsed.data;
      log.info({ username }, '[Auth] Login attempt');

      const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

      if (row && await bcrypt.compare(password, row.password_hash)) {
        const deviceId = device_id || crypto.randomUUID();
        const deviceAllowed = trackDevice(row.id, deviceId, req.headers['user-agent'] || '', !!row.is_admin);
        if (!deviceAllowed) {
          return res.status(403).json({ success: false, message: "Достигнут лимит устройств (5). Удалите одно из устройств в профиле и попробуйте снова." });
        }

        const user = { id: row.id, username: row.username, name: row.name, tier: row.tier, progress: 0 };
        const token = await new SignJWT(user)
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(JWT_SECRET);

        log.info({ username }, '[Auth] Login success');
        res.json({ success: true, token, user, device_id: deviceId });
      } else {
        log.warn({ username }, '[Auth] Login failed: Invalid credentials');
        res.status(401).json({ success: false, message: "Неверный логин или пароль" });
      }
    } catch (e: any) {
      log.error(e, '[Auth] Login error');
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/telegram-login", async (req, res) => {
    try {
      const { telegram, password, username, device_id } = req.body;
      if (!telegram || !password) {
        return res.status(400).json({ success: false, message: "Необходимы данные Telegram и пароль" });
      }

      // Build data map for verification
      const tgFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(telegram)) {
        if (v != null) tgFields[k] = String(v);
      }

      if (!verifyTelegramHash(tgFields)) {
        return res.status(400).json({ success: false, message: "Недействительные данные Telegram" });
      }

      const telegramId = String(telegram.id);

      // Find user: by telegram_id first, then by username
      let row = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as any;
      if (!row && username) {
        row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      }
      if (!row) {
        return res.status(404).json({ success: false, message: "Аккаунт не найден. Введите логин для привязки Telegram." });
      }

      if (!await bcrypt.compare(password, row.password_hash)) {
        return res.status(401).json({ success: false, message: "Неверный пароль" });
      }

      // Save / update telegram data
      db.prepare(`UPDATE users SET
        telegram_id = ?, telegram_username = ?, telegram_first_name = ?,
        telegram_last_name = ?, telegram_photo_url = ?, telegram_auth_date = ?
        WHERE id = ?`).run(
        telegramId,
        telegram.username ?? null,
        telegram.first_name ?? null,
        telegram.last_name ?? null,
        telegram.photo_url ?? null,
        telegram.auth_date ? Number(telegram.auth_date) : null,
        row.id
      );

      const deviceId = device_id || crypto.randomUUID();
      const deviceAllowed = trackDevice(row.id, deviceId, req.headers['user-agent'] || '', !!row.is_admin);
      if (!deviceAllowed) {
        return res.status(403).json({ success: false, message: "Достигнут лимит устройств (5). Удалите одно из устройств в профиле." });
      }

      const user = { id: row.id, username: row.username, name: row.name, tier: row.tier, progress: 0 };
      const token = await new SignJWT(user)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(JWT_SECRET);

      log.info({ username: row.username, telegramId }, '[Auth] Telegram login success');
      res.json({ success: true, token, user, device_id: deviceId });
    } catch (e: any) {
      log.error(e, '[Auth] Telegram login error');
      res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  });

  app.post("/api/auth/telegram-register", async (req, res) => {
    try {
      const { telegram, password, username, name, device_id } = req.body;
      if (!telegram || !password || !username) {
        return res.status(400).json({ success: false, message: "Необходимы данные Telegram, логин и пароль" });
      }

      const tgFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(telegram as Record<string, unknown>)) {
        if (v != null) tgFields[k] = String(v);
      }
      if (!verifyTelegramHash(tgFields)) {
        return res.status(400).json({ success: false, message: "Недействительные данные Telegram" });
      }

      const telegramId = String(telegram.id);
      const existing = db.prepare("SELECT id FROM users WHERE telegram_id = ?").get(telegramId) as any;
      if (existing) {
        return res.status(400).json({ success: false, message: "Этот Telegram аккаунт уже привязан к другому аккаунту" });
      }

      const displayName = name?.trim() ||
        [telegram.first_name, telegram.last_name].filter(Boolean).join(' ') ||
        username;

      const parsed = registerSchema.safeParse({ username, password, name: displayName, device_id });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Неверные данные" });
      }

      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 10);

      db.prepare(`INSERT INTO users
        (id, username, name, password_hash, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_photo_url, telegram_auth_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, username, displayName, hash,
        telegramId,
        telegram.username ?? null,
        telegram.first_name ?? null,
        telegram.last_name ?? null,
        telegram.photo_url ?? null,
        telegram.auth_date ? Number(telegram.auth_date) : null
      );

      const deviceId = device_id || crypto.randomUUID();
      trackDevice(id, deviceId, req.headers['user-agent'] || '');

      const user = { id, username, name: displayName, tier: "free", progress: 0 };
      const token = await new SignJWT(user)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(JWT_SECRET);

      log.info({ username, telegramId }, '[Auth] Telegram register success');
      res.json({ success: true, token, user, device_id: deviceId });
    } catch (e: any) {
      log.error(e, '[Auth] Telegram register error');
      if (e.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ success: false, message: "Логин уже занят" });
      }
      res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    try {
      const row = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at, payment_method_id, trial_used, auto_renew FROM users WHERE id = ?").get(req.user.id) as any;
      if (!row) return res.status(404).json({ error: "User not found" });
      res.json({ user: { ...row, progress: 0 } });
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User settings (theme etc.)
  app.get("/api/settings", authenticate, (req: any, res) => {
    try {
      const row = db.prepare("SELECT settings_json FROM users WHERE id = ?").get(req.user.id) as any;
      const settings = row?.settings_json ? JSON.parse(row.settings_json) : {};
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/settings", authenticate, (req: any, res) => {
    try {
      const row = db.prepare("SELECT settings_json FROM users WHERE id = ?").get(req.user.id) as any;
      const existing = row?.settings_json ? JSON.parse(row.settings_json) : {};
      const merged = { ...existing, ...req.body };
      db.prepare("UPDATE users SET settings_json = ? WHERE id = ?").run(JSON.stringify(merged), req.user.id);
      res.json({ success: true, settings: merged });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/payment/mock-success", authenticate, (req: any, res) => {
    try {
      db.prepare("UPDATE users SET tier = 'premium' WHERE id = ?").run(req.user.id);
      const row = db.prepare("SELECT id, username, name, tier FROM users WHERE id = ?").get(req.user.id) as any;
      res.json({ success: true, user: { ...row, progress: 0 } });
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Change password
  app.post("/api/change-password", authenticate, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Заполните все поля" });
      if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Новый пароль должен содержать минимум 8 символов" });
      if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ success: false, message: "Новый пароль должен содержать хотя бы одну заглавную букву" });
      if (!/[0-9]/.test(newPassword)) return res.status(400).json({ success: false, message: "Новый пароль должен содержать хотя бы одну цифру" });

      const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id) as any;
      if (!row) return res.status(404).json({ success: false, message: "Пользователь не найден" });

      const valid = await bcrypt.compare(currentPassword, row.password_hash);
      if (!valid) return res.status(400).json({ success: false, message: "Неверный текущий пароль" });

      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  });

  // Change name
  app.post("/api/change-name", authenticate, (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: "Введите имя и фамилию" });
      }
      const trimmed = name.trim();
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(trimmed, req.user.id);
      const row = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at FROM users WHERE id = ?").get(req.user.id) as any;
      res.json({ success: true, user: { ...row, progress: 0 } });
    } catch (e: any) {
      res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  });

  // ─── Subscription endpoints ─────────────────────────────────────────────────

  // Get available plans + current subscription info
  app.get("/api/subscription/plans", authenticate, (req: any, res) => {
    try {
      const user = db.prepare("SELECT tier, subscription_expires_at, payment_method_id, trial_used, auto_renew FROM users WHERE id = ?").get(req.user.id) as any;
      res.json({
        plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
        current: {
          tier: user?.tier ?? 'free',
          subscription_expires_at: user?.subscription_expires_at ?? null,
          has_payment_method: !!user?.payment_method_id,
          trial_used: !!user?.trial_used,
          auto_renew: !!user?.auto_renew,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Activate free trial (24 hours, once per user)
  app.post("/api/subscription/trial", authenticate, (req: any, res) => {
    try {
      const user = db.prepare("SELECT trial_used, tier FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });
      if (user.trial_used) return res.status(400).json({ success: false, message: "Пробный период уже был использован" });

      const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
      db.prepare("UPDATE users SET tier = 'premium', subscription_expires_at = ?, trial_used = 1 WHERE id = ?")
        .run(expiresAt, req.user.id);

      const updated = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at FROM users WHERE id = ?").get(req.user.id);
      log.info({ userId: req.user.id }, '[Sub] Trial activated');
      res.json({ success: true, user: { ...(updated as any), progress: 0 } });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Create payment
  app.post("/api/subscription/pay", authenticate, async (req: any, res) => {
    try {
      if (!YUKASSA_SHOP_ID || !YUKASSA_SECRET_KEY) {
        return res.status(503).json({ success: false, message: "Платёжная система не настроена" });
      }

      const { plan: planId, save_card } = req.body;
      const plan = PLANS[planId];
      if (!plan) return res.status(400).json({ success: false, message: "Неверный тариф" });

      const idempotencyKey = crypto.randomUUID();
      const paymentId = crypto.randomUUID(); // local placeholder
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      const body: any = {
        amount: { value: plan.amount.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${appUrl}/subscription/return`,
        },
        description: `Подписка SCA Premium — ${plan.label}`,
        save_payment_method: !!save_card,
        metadata: { user_id: req.user.id, plan: planId },
      };

      // Save pending payment
      db.prepare(
        "INSERT INTO payments (id, user_id, plan, amount, status, save_payment_method, idempotency_key) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
      ).run(paymentId, req.user.id, planId, plan.amount, save_card ? 1 : 0, idempotencyKey);

      const yk = await ykFetch('/payments', 'POST', body, idempotencyKey);

      if (!yk?.id) {
        log.error({ yk }, '[YK] Payment creation failed');
        db.prepare("UPDATE payments SET status = 'cancelled' WHERE idempotency_key = ?").run(idempotencyKey);
        return res.status(502).json({ success: false, message: yk?.description ?? 'Ошибка создания платежа' });
      }

      // Update with real YooKassa payment ID
      db.prepare("UPDATE payments SET id = ?, confirmation_url = ? WHERE idempotency_key = ?")
        .run(yk.id, yk.confirmation?.confirmation_url ?? null, idempotencyKey);

      log.info({ paymentId: yk.id, userId: req.user.id, plan: planId }, '[YK] Payment created');
      res.json({
        success: true,
        payment_id: yk.id,
        confirmation_url: yk.confirmation?.confirmation_url,
      });
    } catch (e: any) {
      log.error(e, '[YK] Pay error');
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Check payment status (called after return from YooKassa)
  app.get("/api/subscription/payment/:id", authenticate, async (req: any, res) => {
    try {
      const yk = await ykFetch(`/payments/${req.params.id}`);
      if (!yk?.id) return res.status(404).json({ success: false, message: "Платёж не найден" });

      // Security: verify the payment belongs to this user
      const row = db.prepare("SELECT user_id FROM payments WHERE id = ?").get(yk.id) as any;
      if (!row || row.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: "Нет доступа" });
      }

      await verifyAndProcessPayment(yk.id);

      const user = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at, payment_method_id, auto_renew FROM users WHERE id = ?").get(req.user.id) as any;
      res.json({ success: true, status: yk.status, user: { ...user, progress: 0 } });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Detach saved card (cancel auto-renewal)
  app.delete("/api/subscription/payment-method", authenticate, (req: any, res) => {
    try {
      db.prepare("UPDATE users SET payment_method_id = NULL, auto_renew = 0 WHERE id = ?").run(req.user.id);
      const user = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at, auto_renew FROM users WHERE id = ?").get(req.user.id) as any;
      log.info({ userId: req.user.id }, '[Sub] Payment method detached');
      res.json({ success: true, user: { ...user, progress: 0 } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get payment history
  app.get("/api/subscription/history", authenticate, (req: any, res) => {
    try {
      const payments = db.prepare(
        "SELECT id, plan, amount, currency, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
      ).all(req.user.id);
      res.json({ payments });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // YooKassa webhook
  app.post("/api/webhook/yookassa", async (req: any, res) => {
    // Always respond 200 immediately so YooKassa doesn't retry
    res.json({ success: true });

    try {
      const ip = getClientIp(req);
      if (!isYooKassaIp(ip)) {
        log.warn({ ip }, '[YK] Webhook from unknown IP — ignoring');
        return;
      }

      const event = req.body;
      if (event?.event !== 'payment.succeeded' && event?.event !== 'payment.canceled') return;

      const paymentId = event?.object?.id;
      if (!paymentId || typeof paymentId !== 'string') return;

      // Verify by re-fetching (never trust webhook body alone)
      await verifyAndProcessPayment(paymentId);
    } catch (e: any) {
      log.error(e, '[YK] Webhook processing error');
    }
  });

  // List user devices
  app.get("/api/devices", authenticate, (req: any, res) => {
    try {
      const devices = db.prepare("SELECT id, name, last_seen, created_at FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC").all(req.user.id);
      res.json({ devices });
    } catch (e: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Remove user device
  app.delete("/api/devices/:deviceId", authenticate, (req: any, res) => {
    try {
      db.prepare("DELETE FROM user_devices WHERE id = ? AND user_id = ?").run(req.params.deviceId, req.user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- API Routes ---

  app.get("/api/projects", async (_req, res) => {
    try {
      const allowedIds = Object.values(ALLOWED_PROJECTS).flat();
      const data = await kinescopeFetch("/projects");
      const filtered = (data.data ?? []).filter((p: any) => allowedIds.includes(p.id));
      res.json({ projects: filtered });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/folders", async (req, res) => {
    try {
      const projectId = req.query.project_id;
      if (!projectId) return res.status(400).json({ error: "project_id required" });
      const data = await kinescopeFetch(`/folders?project_id=${projectId}&per_page=100`);
      res.json({ folders: data.data || [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/folder-videos", async (req, res) => {
    try {
      const folderId = req.query.folder_id;
      const projectId = req.query.project_id;
      const perPage = req.query.per_page || 500;
      const page = req.query.page || 1;
      
      if (!folderId && !projectId) {
        return res.status(400).json({ error: "Either folder_id or project_id is required" });
      }
      
      let url = `/videos?per_page=${perPage}&page=${page}`;
      if (folderId) url += `&folder_id=${folderId}`;
      if (projectId) url += `&project_id=${projectId}`;
      
      const data = await kinescopeFetch(url);
      const videos = (data.data || []).map(formatKinescopeVideo);
      res.json({ videos, meta: data.meta });
    } catch (e: any) {
      log.error({ err: e.message }, 'Error in /api/folder-videos');
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/videos", async (req, res) => {
    try {
      const section = (req.query.section as keyof typeof ALLOWED_PROJECTS) || 'broadcasts';
      const perPage = Number(req.query.per_page || 24);
      const page = Number(req.query.page || 1);

      const projectIds = ALLOWED_PROJECTS[section] || [];
      if (!projectIds.length) return res.json({ videos: [], total: 0 });

      const allVideos: any[] = [];
      for (const projectId of projectIds) {
        const data = await kinescopeFetch(`/videos?project_id=${projectId}&per_page=500`);
        allVideos.push(...(data.data || []).map(formatKinescopeVideo));
      }

      allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const total = allVideos.length;
      const start = (page - 1) * perPage;
      res.json({ videos: allVideos.slice(start, start + perPage), total });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/videos/by-ids", async (req, res) => {
    try {
      const ids = String(req.query.ids || "").split(",").filter(Boolean);
      if (!ids.length) return res.json({ videos: [] });

      const results = await Promise.all(ids.map(async id => {
        // Since we no longer store videos in DB, numeric IDs (if any were used as legacy) 
        // cannot be resolved unless we have a mapping. 
        // For now, we assume all provided IDs are Kinescope UUIDs or valid video IDs.
        try {
          const data = await kinescopeFetch(`/videos/${id}`);
          if (data.data) return formatKinescopeVideo(data.data, id);
        } catch (e) {
          log.warn({ id, err: (e as Error).message }, 'Kinescope API fetch failed for video');
        }
        return null;
      }));

      const filtered = results.filter(Boolean);
      log.info({ requested: ids, resolved: filtered.map(v => v?.id) }, '[API] /api/videos/by-ids');
      res.json({ videos: filtered });
    } catch (e: any) {
      log.error(e, 'Critical error in /api/videos/by-ids');
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/history", authenticate, (req: any, res) => {
    try {
      const rows = db.prepare(`
        SELECT video_id, progress, last_position, last_watched,
               video_title, video_poster, video_duration, video_duration_sec, video_embed_url
        FROM watch_history WHERE user_id = ? ORDER BY last_watched DESC LIMIT 200
      `).all(req.user.id);
      res.json({ history: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/history", authenticate, (req: any, res) => {
    try {
      const { videoId, progress, lastPosition, videoTitle, videoPoster, videoDuration, videoDurationSec, videoEmbedUrl } = req.body;
      if (!videoId) return res.status(400).json({ error: "videoId required" });

      db.prepare(`
        INSERT INTO watch_history (user_id, video_id, progress, last_position, last_watched, video_title, video_poster, video_duration, video_duration_sec, video_embed_url)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, video_id) DO UPDATE SET
          progress = excluded.progress,
          last_position = excluded.last_position,
          last_watched = CURRENT_TIMESTAMP,
          video_title = COALESCE(excluded.video_title, video_title),
          video_poster = COALESCE(excluded.video_poster, video_poster),
          video_duration = COALESCE(excluded.video_duration, video_duration),
          video_duration_sec = COALESCE(excluded.video_duration_sec, video_duration_sec),
          video_embed_url = COALESCE(excluded.video_embed_url, video_embed_url)
      `).run(req.user.id, videoId, progress ?? 0, lastPosition ?? 0,
             videoTitle || null, videoPoster || null,
             videoDuration || null, videoDurationSec || null, videoEmbedUrl || null);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/history", authenticate, (req: any, res) => {
    try {
      const { videoId } = req.body;
      db.prepare("DELETE FROM watch_history WHERE user_id = ? AND video_id = ?").run(req.user.id, videoId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/watch-later", authenticate, (req: any, res) => {
    try {
      const rows = db.prepare(`
        SELECT video_id, added_at, video_title, video_poster, video_duration, video_duration_sec, video_embed_url
        FROM watch_later WHERE user_id = ? ORDER BY added_at DESC
      `).all(req.user.id);
      res.json({ bookmarks: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/watch-later", authenticate, (req: any, res) => {
    try {
      const { videoId, videoTitle, videoPoster, videoDuration, videoDurationSec, videoEmbedUrl } = req.body;
      if (!videoId) return res.status(400).json({ error: "videoId required" });
      db.prepare(`
        INSERT INTO watch_later (user_id, video_id, video_title, video_poster, video_duration, video_duration_sec, video_embed_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, video_id) DO UPDATE SET
          video_title = COALESCE(excluded.video_title, video_title),
          video_poster = COALESCE(excluded.video_poster, video_poster),
          video_duration = COALESCE(excluded.video_duration, video_duration),
          video_duration_sec = COALESCE(excluded.video_duration_sec, video_duration_sec),
          video_embed_url = COALESCE(excluded.video_embed_url, video_embed_url)
      `).run(req.user.id, videoId, videoTitle || null, videoPoster || null,
             videoDuration || null, videoDurationSec || null, videoEmbedUrl || null);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/watch-later", authenticate, (req: any, res) => {
    try {
      const { videoId } = req.body;
      db.prepare("DELETE FROM watch_later WHERE user_id = ? AND video_id = ?").run(req.user.id, videoId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      if (!query) return res.json({ videos: [] });

      const projectIds = Object.values(ALLOWED_PROJECTS).flat();
      
      // Fetch from all projects in parallel
      const projectResults = await Promise.all(
        projectIds.map(projectId => 
          kinescopeFetch(`/videos?project_id=${projectId}&per_page=500`)
            .catch(err => {
              log.error({ projectId, err: err.message }, 'Search fetch error');
              return { data: [] };
            })
        )
      );

      // De-duplicate by video ID using a Map
      const videoMap = new Map<string, any>();
      for (const result of projectResults) {
        if (!result.data) continue;
        for (const v of result.data) {
          if (!videoMap.has(v.id)) {
            videoMap.set(v.id, formatKinescopeVideo(v));
          }
        }
      }

      const q = query.toLowerCase();
      const allVideos = Array.from(videoMap.values());
      const filtered = allVideos.filter(v => 
        (v.title || '').toLowerCase().includes(q) || 
        (v.description || '').toLowerCase().includes(q)
      );
      
      res.json({ videos: filtered.slice(0, 100) });
    } catch (e: any) {
      log.error(e, 'Search API error');
      res.status(500).json({ error: e.message });
    }
  });

  // --- Public Catalog Route ---

  app.get("/api/catalog", (req, res) => {
    try {
      const section = req.query.section as string;
      const where = section ? "WHERE section = ?" : "";
      const params = section ? [section] : [];
      const categories = db.prepare(`SELECT * FROM catalog_categories ${where} ORDER BY sort_order ASC`).all(...params) as any[];
      const result = categories.map(cat => {
        const items = db.prepare("SELECT * FROM catalog_items WHERE category_id = ? ORDER BY sort_order ASC").all(cat.id) as any[];
        return {
          ...cat,
          items: items.map(item => ({
            ...item,
            video_ids: item.video_ids ? item.video_ids.split(',').filter(Boolean) : null,
            links: item.links_json ? JSON.parse(item.links_json) : null,
          })),
        };
      });
      res.json({ categories: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/latest-broadcast-video — returns the single most recent broadcast video (served from cache)
  app.get("/api/latest-broadcast-video", async (req, res) => {
    if (latestBroadcastCache) {
      return res.json(latestBroadcastCache);
    }
    // Cache not yet ready — fetch on demand and store
    try {
      await fetchAndCacheLatestBroadcast();
      res.json(latestBroadcastCache ?? { video: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- JSON Content Routes ---

  // GET /api/broadcasts-json — returns all broadcast videos from content.json
  app.get("/api/broadcasts-json", (req, res) => {
    if (!contentJson) return res.status(503).json({ error: "content.json not loaded" });
    try {
      const videos = (contentJson.live_broadcasts?.videos ?? []).map((v: any) => ({
        video_id: v.video_id,
        video_url: v.video_url,
        title: v.title || '',
        description: v.description || '',
      }));
      res.json({ videos });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/json-search?q= — fast search across content.json (no Kinescope call)
  app.get("/api/json-search", (req, res) => {
    if (!contentJson) return res.status(503).json({ error: "content.json not loaded" });
    const q = String(req.query.q || "").toLowerCase().trim();
    if (!q) return res.json({ videos: [] });

    const results: any[] = [];

    const addVideo = (v: any, context: string) => {
      const title = (v.title || v.video_id || '').toLowerCase();
      const desc = (v.description || '').toLowerCase();
      if (title.includes(q) || desc.includes(q)) {
        results.push({
          id: v.video_id,
          title: v.title || v.video_id,
          description: v.description || '',
          embedUrl: v.video_url || `https://kinescope.io/embed/${v.video_id}`,
          posterUrl: null,
          duration: '—',
          durationSec: 0,
          _context: context,
        });
      }
    };

    // Search broadcasts
    for (const v of contentJson.live_broadcasts?.videos ?? []) {
      addVideo(v, 'Запись эфира');
    }

    // Search seminars
    for (const cat of contentJson.seminars?.categories ?? []) {
      for (const s of cat.seminars ?? []) {
        const stitle = (s.title || '').toLowerCase();
        const sdesc = (s.description || '').toLowerCase();
        for (const v of s.content?.videos ?? []) {
          const context = stitle.includes(q) || sdesc.includes(q)
            ? `Семинар: ${s.title}`
            : `Семинар: ${s.title}`;
          addVideo(v, context);
        }
      }
    }
    for (const s of contentJson.seminars?.orphan_pages ?? []) {
      for (const v of s.content?.videos ?? []) {
        addVideo(v, `Семинар: ${s.title || s.page_alias}`);
      }
    }

    // Search additional materials
    for (const cat of contentJson.additional_materials?.categories ?? []) {
      for (const item of cat.items ?? []) {
        for (const v of item.content?.videos ?? []) {
          addVideo(v, `Материал: ${item.title}`);
        }
      }
    }
    for (const item of contentJson.additional_materials?.orphan_pages ?? []) {
      for (const v of item.content?.videos ?? []) {
        addVideo(v, `Материал: ${item.title || item.page_alias}`);
      }
    }

    res.json({ videos: results.slice(0, 100) });
  });

  // GET /api/seminars-json — returns seminars structure from content.json
  app.get("/api/seminars-json", (req, res) => {
    if (!contentJson) return res.status(503).json({ error: "content.json not loaded" });
    try {
      const sem = contentJson.seminars;
      const categoryKeyMap: Record<string, string> = {
        'Семинары SCA': 'sca',
        'Переведенные иностранные семинары': 'foreign',
        'Семинары других организаций': 'other',
      };

      // Load broadcast URLs from DB
      const broadcastRows = db.prepare("SELECT seminar_id, broadcast_url FROM seminar_broadcasts").all() as any[];
      const broadcastMap: Record<string, string> = {};
      for (const r of broadcastRows) broadcastMap[r.seminar_id] = r.broadcast_url;

      const mapSeminar = (s: any) => ({
        id: s.page_alias,
        title: s.title || s.page_alias,
        description: s.description || '',
        video_count: s.content?.video_count ?? (s.content?.videos ?? []).length,
        videos: (s.content?.videos ?? []).map((v: any) => ({
          video_id: v.video_id,
          video_url: v.video_url,
          title: v.title || '',
          description: v.description || '',
        })),
        downloads: s.content?.downloads ?? [],
        broadcast_url: broadcastMap[s.page_alias] ?? null,
      });

      const categories = (sem.categories || []).map((cat: any) => ({
        key: categoryKeyMap[cat.title] || cat.anchor || cat.title,
        title: cat.title,
        seminars: (cat.seminars || []).map(mapSeminar),
      }));

      // Also expose orphan pages as a flat list (sub-pages like seminars/11_1)
      const orphans = (sem.orphan_pages || []).map(mapSeminar);

      res.json({ categories, orphans });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/video-from-json/:videoId — look up video in content.json + Kinescope metadata
  app.get("/api/video-from-json/:videoId", async (req, res) => {
    if (!contentJson) return res.status(503).json({ error: "content.json not loaded" });
    const { videoId } = req.params;

    // Search all sections for this videoId
    let found: { videoMeta: any; seminar: any } | null = null;

    const searchSection = (section: any, sectionLabel: string) => {
      for (const cat of section.categories || []) {
        for (const s of cat.seminars || cat.items || []) {
          const content = s.content;
          if (!content) continue;
          const video = (content.videos || []).find((v: any) => v.video_id === videoId);
          if (video) {
            found = { videoMeta: video, seminar: s };
            return true;
          }
        }
      }
      for (const s of section.orphan_pages || []) {
        const content = s.content;
        if (!content) continue;
        const video = (content.videos || []).find((v: any) => v.video_id === videoId);
        if (video) {
          found = { videoMeta: video, seminar: s };
          return true;
        }
      }
      return false;
    };

    searchSection(contentJson.seminars, 'seminars') ||
    searchSection(contentJson.additional_materials, 'additional_materials') ||
    (() => {
      const video = (contentJson.live_broadcasts?.videos || []).find((v: any) => v.video_id === videoId);
      if (video) found = { videoMeta: video, seminar: null };
    })();

    // Fetch Kinescope metadata
    let kMeta: any = null;
    try {
      const data = await kinescopeFetch(`/videos/${videoId}`);
      if (data.data) kMeta = formatKinescopeVideo(data.data, videoId);
    } catch (e) {
      log.warn({ videoId }, '[JSON Video] Kinescope fetch failed');
    }

    if (!found && !kMeta) {
      return res.status(404).json({ error: "Video not found" });
    }

    const { videoMeta, seminar } = found ?? { videoMeta: null, seminar: null };

    const result = {
      id: videoId,
      title: videoMeta?.title || kMeta?.title || '',
      description: videoMeta?.description || '',
      embedUrl: videoMeta?.video_url || kMeta?.embedUrl || `https://kinescope.io/embed/${videoId}`,
      posterUrl: kMeta?.posterUrl || null,
      duration: kMeta?.duration || '—',
      durationSec: kMeta?.durationSec || 0,
      chapters: kMeta?.chapters || [],
      seminarTitle: seminar?.title || '',
      downloads: seminar?.content?.downloads ?? seminar?.downloads ?? [],
      allVideoIds: seminar
        ? (seminar.content?.videos ?? seminar.videos ?? []).map((v: any) => v.video_id)
        : (contentJson.live_broadcasts?.videos ?? []).map((v: any) => v.video_id),
    };

    res.json({ video: result });
  });

  // --- Admin Routes ---

  // List all users with stats
  app.get("/api/admin/users", requireAdmin, (req: any, res) => {
    try {
      const search = String(req.query.search || "").toLowerCase();
      const tier = req.query.tier as string;
      let query = `
        SELECT u.id, u.username, u.name, u.tier, u.is_admin, u.subscription_expires_at, u.notes, u.created_at,
          (SELECT COUNT(*) FROM watch_history WHERE user_id = u.id) as watch_count,
          (SELECT COUNT(*) FROM watch_later WHERE user_id = u.id) as bookmark_count
        FROM users u
        WHERE u.tier != 'guest'
      `;
      const conditions: string[] = [];
      const params: any[] = [];
      if (search) { 
        conditions.push("(LOWER(u.username) LIKE ? OR LOWER(u.name) LIKE ?)"); 
        params.push(`%${search}%`, `%${search}%`); 
      }
      if (tier) { 
        conditions.push("u.tier = ?"); 
        params.push(tier); 
      }
      if (conditions.length) query += " AND " + conditions.join(" AND ");
      query += " ORDER BY u.created_at DESC";
      const users = db.prepare(query).all(...params);
      res.json({ users });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get single user detail
  app.get("/api/admin/users/:id", requireAdmin, (req: any, res) => {
    try {
      const user = db.prepare(`
        SELECT u.id, u.username, u.name, u.tier, u.is_admin, u.subscription_expires_at, u.notes, u.created_at,
          (SELECT COUNT(*) FROM watch_history WHERE user_id = u.id) as watch_count,
          (SELECT COUNT(*) FROM watch_later WHERE user_id = u.id) as bookmark_count
        FROM users u WHERE u.id = ?
      `).get(req.params.id) as any;
      if (!user) return res.status(404).json({ error: "User not found" });
      const history = db.prepare("SELECT video_id, video_title, video_poster, progress, last_position, last_watched FROM watch_history WHERE user_id = ? ORDER BY last_watched DESC LIMIT 100").all(req.params.id);
      const bookmarks = db.prepare(`
        SELECT wl.video_id, wl.added_at, wh.video_title, wh.video_poster
        FROM watch_later wl
        LEFT JOIN watch_history wh ON wl.user_id = wh.user_id AND wl.video_id = wh.video_id
        WHERE wl.user_id = ?
        ORDER BY wl.added_at DESC
      `).all(req.params.id);
      res.json({ user, history, bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update user
  app.put("/api/admin/users/:id", requireAdmin, (req: any, res) => {
    try {
      const { tier, is_admin, subscription_expires_at, name, notes } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (tier !== undefined) { updates.push("tier = ?"); params.push(tier); }
      if (is_admin !== undefined) { updates.push("is_admin = ?"); params.push(is_admin ? 1 : 0); }
      if (subscription_expires_at !== undefined) { updates.push("subscription_expires_at = ?"); params.push(subscription_expires_at || null); }
      if (name !== undefined) { updates.push("name = ?"); params.push(name); }
      if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }
      if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
      params.push(req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      const user = db.prepare("SELECT id, username, name, tier, is_admin, subscription_expires_at, notes, created_at FROM users WHERE id = ?").get(req.params.id);
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete user
  app.delete("/api/admin/users/:id", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM watch_history WHERE user_id = ?").run(req.params.id);
      db.prepare("DELETE FROM watch_later WHERE user_id = ?").run(req.params.id);
      db.prepare("DELETE FROM user_devices WHERE user_id = ?").run(req.params.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: list devices for a user
  app.get("/api/admin/users/:id/devices", requireAdmin, (req: any, res) => {
    try {
      const devices = db.prepare("SELECT id, name, last_seen, created_at FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC").all(req.params.id);
      res.json({ devices });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: remove a device for a user
  app.delete("/api/admin/users/:id/devices/:deviceId", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM user_devices WHERE id = ? AND user_id = ?").run(req.params.deviceId, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: list payments for a user
  app.get("/api/admin/users/:id/payments", requireAdmin, (req: any, res) => {
    try {
      const payments = db.prepare("SELECT id, plan, amount, currency, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC").all(req.params.id);
      res.json({ payments });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: chat history for a user
  app.get("/api/admin/users/:id/chat", requireAdmin, (req: any, res) => {
    try {
      const messages = db.prepare("SELECT id, user_message, ai_reply, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.params.id);
      res.json({ messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Reset user password
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req: any, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Password too short" });
      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: get full catalog
  app.get("/api/admin/catalog", requireAdmin, (req: any, res) => {
    try {
      const categories = db.prepare("SELECT * FROM catalog_categories ORDER BY section, sort_order ASC").all() as any[];
      const result = categories.map(cat => {
        const items = db.prepare("SELECT * FROM catalog_items WHERE category_id = ? ORDER BY sort_order ASC").all(cat.id) as any[];
        return { ...cat, items };
      });
      res.json({ categories: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: add catalog category
  app.post("/api/admin/catalog/categories", requireAdmin, (req: any, res) => {
    try {
      const { section, category_key, label, sort_order } = req.body;
      if (!section || !label) return res.status(400).json({ error: "section and label required" });
      const id = crypto.randomUUID();
      const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM catalog_categories WHERE section = ?").get(section) as any)?.m ?? -1;
      db.prepare("INSERT INTO catalog_categories (id, section, category_key, label, sort_order) VALUES (?, ?, ?, ?, ?)").run(id, section, category_key || label.toLowerCase().replace(/\s+/g, '_'), label, sort_order ?? maxOrder + 1);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: update catalog category
  app.put("/api/admin/catalog/categories/:id", requireAdmin, (req: any, res) => {
    try {
      const { label, sort_order, category_key } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (label !== undefined) { updates.push("label = ?"); params.push(label); }
      if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(sort_order); }
      if (category_key !== undefined) { updates.push("category_key = ?"); params.push(category_key); }
      if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
      params.push(req.params.id);
      db.prepare(`UPDATE catalog_categories SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: delete catalog category
  app.delete("/api/admin/catalog/categories/:id", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM catalog_items WHERE category_id = ?").run(req.params.id);
      db.prepare("DELETE FROM catalog_categories WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: add catalog item
  app.post("/api/admin/catalog/items", requireAdmin, (req: any, res) => {
    try {
      const { category_id, kinescope_folder_id, kinescope_project_id, video_ids, title, description, video_count } = req.body;
      if (!category_id || !title) return res.status(400).json({ error: "category_id and title required" });
      const id = crypto.randomUUID();
      const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM catalog_items WHERE category_id = ?").get(category_id) as any)?.m ?? -1;
      const videoIdsStr = Array.isArray(video_ids) ? video_ids.join(',') : (video_ids || null);
      db.prepare("INSERT INTO catalog_items (id, category_id, kinescope_folder_id, kinescope_project_id, video_ids, title, description, video_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, category_id, kinescope_folder_id || null, kinescope_project_id || null, videoIdsStr, title, description || '', video_count || 0, maxOrder + 1);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: update catalog item
  app.put("/api/admin/catalog/items/:id", requireAdmin, (req: any, res) => {
    try {
      const { title, description, kinescope_folder_id, kinescope_project_id, video_ids, video_count, sort_order, category_id } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (title !== undefined) { updates.push("title = ?"); params.push(title); }
      if (description !== undefined) { updates.push("description = ?"); params.push(description); }
      if (kinescope_folder_id !== undefined) { updates.push("kinescope_folder_id = ?"); params.push(kinescope_folder_id || null); }
      if (kinescope_project_id !== undefined) { updates.push("kinescope_project_id = ?"); params.push(kinescope_project_id || null); }
      if (video_ids !== undefined) {
        const str = Array.isArray(video_ids) ? video_ids.join(',') : (video_ids || null);
        updates.push("video_ids = ?"); params.push(str);
      }
      if (video_count !== undefined) { updates.push("video_count = ?"); params.push(video_count); }
      if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(sort_order); }
      if (category_id !== undefined) { updates.push("category_id = ?"); params.push(category_id); }
      if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
      params.push(req.params.id);
      db.prepare(`UPDATE catalog_items SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: delete catalog item
  app.delete("/api/admin/catalog/items/:id", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM catalog_items WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/live-broadcast — public: current live broadcast
  app.get("/api/live-broadcast", (req, res) => {
    try {
      const urlRow    = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_url'").get() as any;
      const activeRow = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_active'").get() as any;
      const eidRow    = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_event_id'").get() as any;
      const isActive  = activeRow?.value === '1' && urlRow?.value;
      if (!isActive) return res.json({ active: false });
      const embedUrl = urlRow.value;
      // Prefer the stored Kinescope event UUID over the extracted video ID
      const eventId = eidRow?.value || extractKinescopeId(embedUrl);
      res.json({ active: true, embed_url: embedUrl, event_id: eventId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/live-chat-token — authenticated: generate JWT for Kinescope chat
  app.get("/api/live-chat-token", authenticate, async (req: any, res) => {
    try {
      const eventId = String(req.query.event_id || '');
      if (!eventId) return res.status(400).json({ error: "event_id required" });
      if (!liveRSAPrivateKey) return res.status(503).json({ error: "RSA keys not ready" });
      const user = db.prepare("SELECT id, name FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: "User not found" });
      const token = await new SignJWT({
        user_id: String(user.id),
        username: String(user.name || 'Пользователь'),
        event_id: eventId,
      })
        .setProtectedHeader({ alg: 'RS256', kid: liveRSAKid })
        .setAudience('chat')
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(liveRSAPrivateKey);
      res.json({ token });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: get live broadcast status (including URL even when inactive)
  app.get("/api/admin/live-broadcast-status", requireAdmin, (req: any, res) => {
    try {
      const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_url'").get() as any;
      const activeRow = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_active'").get() as any;
      const isActive = activeRow?.value === '1' && urlRow?.value;
      res.json({ active: !!isActive, embed_url: urlRow?.value || '' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Helper to read current live state
  function getLiveState() {
    const urlRow    = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_url'").get() as any;
    const activeRow = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_active'").get() as any;
    const eidRow    = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_event_id'").get() as any;
    const embedUrl  = urlRow?.value || '';
    const isActive  = activeRow?.value === '1' && !!embedUrl;
    const eventId   = eidRow?.value || extractKinescopeId(embedUrl);
    return { active: isActive, embed_url: embedUrl, event_id: eventId };
  }

  // Admin: update live broadcast URL (does NOT change active state)
  // Admin: toggle active state (does NOT change URL)
  app.put("/api/admin/live-broadcast", requireAdmin, async (req: any, res) => {
    try {
      const body = req.body ?? {};

      // ── Save URL (if provided) ────────────────────────────────────────────────
      if ('url' in body) {
        const rawUrl = String(body.url ?? '').trim();
        if (!rawUrl) {
          db.prepare("DELETE FROM settings WHERE key = 'live_broadcast_url'").run();
          db.prepare("DELETE FROM settings WHERE key = 'live_broadcast_event_id'").run();
          db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_broadcast_active', '0')").run();
        } else {
          const normalized = normalizeKinescopeUrl(rawUrl);
          db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_broadcast_url', ?)").run(normalized);
          // Auto-fetch the real Kinescope event UUID
          const videoId = extractKinescopeId(normalized);
          if (videoId && process.env.KINESCOPE_TOKEN) {
            try {
              const evRes = await fetch(`https://api.kinescope.io/v2/live/events/${videoId}`, {
                headers: { Authorization: `Bearer ${process.env.KINESCOPE_TOKEN}` },
              });
              if (evRes.ok) {
                const evData = await evRes.json() as any;
                const uuid = evData?.data?.id;
                if (uuid) {
                  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_broadcast_event_id', ?)").run(uuid);
                }
              }
            } catch { /* Kinescope API unavailable — keep existing event_id */ }
          }
        }
      }

      // ── Toggle active (if provided) ───────────────────────────────────────────
      if ('active' in body) {
        const wantActive = !!body.active;
        if (wantActive) {
          const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'live_broadcast_url'").get() as any;
          if (!urlRow?.value) {
            return res.status(400).json({ error: 'Сначала укажите ссылку на трансляцию' });
          }
        }
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_broadcast_active', ?)").run(wantActive ? '1' : '0');
      }

      if (!('url' in body) && !('active' in body)) {
        return res.status(400).json({ error: 'Укажите url или active в теле запроса' });
      }

      return res.json({ success: true, ...getLiveState() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/live-comments — public: last 100 comments newest-first
  app.get("/api/live-comments", (req, res) => {
    try {
      const rows = db.prepare(
        "SELECT id, user_name, message, created_at FROM live_comments ORDER BY created_at DESC LIMIT 100"
      ).all();
      res.json({ comments: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/live-comments — authenticated: post a comment
  app.post("/api/live-comments", authenticate, (req: any, res) => {
    try {
      const message = String(req.body?.message ?? '').trim();
      if (!message) return res.status(400).json({ error: 'Сообщение не может быть пустым' });
      if (message.length > 500) return res.status(400).json({ error: 'Максимум 500 символов' });
      const user = db.prepare("SELECT id, name, username FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      const displayName = (user.name || user.username || 'Пользователь').trim();
      const result = db.prepare(
        "INSERT INTO live_comments (user_id, user_name, message) VALUES (?, ?, ?)"
      ).run(String(user.id), displayName, message);
      const insertedId = Number(result.lastInsertRowid);
      const row = db.prepare("SELECT id, user_name, message, created_at FROM live_comments WHERE id = ?").get(insertedId) as any;
      res.json({ comment: row });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/live-comments/:id — admin only
  app.delete("/api/live-comments/:id", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM live_comments WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: get public JWK for Kinescope registration
  app.get("/api/admin/live-jwk", requireAdmin, (req: any, res) => {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'live_rsa_public_jwk'").get() as any;
      if (!row?.value) return res.status(503).json({ error: "RSA keys not initialized" });
      res.json({ jwk: JSON.parse(row.value) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Notification Admin Routes ---

  // List all notifications with delivery stats
  app.get("/api/admin/notifications", requireAdmin, (req: any, res) => {
    try {
      const notifications = db.prepare(`
        SELECT n.*,
          (SELECT COUNT(*) FROM notification_reads WHERE notification_id = n.id) as read_count
        FROM notifications n
        ORDER BY n.created_at DESC
      `).all();
      res.json({ notifications });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create and send notification
  app.post("/api/admin/notifications", requireAdmin, (req: any, res) => {
    try {
      const { title, message, target, target_user_ids } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ error: "Title and message are required" });
      }
      const validTargets = ['all', 'free', 'premium', 'specific'];
      if (!validTargets.includes(target)) {
        return res.status(400).json({ error: "Invalid target" });
      }
      if (target === 'specific' && (!Array.isArray(target_user_ids) || target_user_ids.length === 0)) {
        return res.status(400).json({ error: "target_user_ids required for specific target" });
      }
      const result = db.prepare(
        "INSERT INTO notifications (title, message, target, target_user_ids, created_by) VALUES (?, ?, ?, ?, ?)"
      ).run(
        title.trim(),
        message.trim(),
        target,
        target === 'specific' ? JSON.stringify(target_user_ids) : null,
        req.user.id
      );

      // Send web push notifications in background
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        const pushPayload = JSON.stringify({
          title: title.trim(),
          body: message.trim(),
          icon: '/icon-192.png',
          url: '/',
        });

        let subscriptions: any[] = [];
        if (target === 'all') {
          subscriptions = db.prepare("SELECT * FROM push_subscriptions").all() as any[];
        } else if (target === 'specific') {
          const placeholders = target_user_ids.map(() => '?').join(',');
          subscriptions = db.prepare(
            `SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`
          ).all(...target_user_ids) as any[];
        } else {
          // target is 'free' or 'premium'
          subscriptions = db.prepare(
            `SELECT ps.* FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id WHERE u.tier = ?`
          ).all(target) as any[];
        }

        let sent = 0;
        for (const sub of subscriptions) {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          };
          webpush.sendNotification(pushSub, pushPayload).then(() => {
            sent++;
          }).catch((err: any) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
            }
            log.warn({ endpoint: sub.endpoint, error: err.message }, "[Push] Failed to send");
          });
        }
        log.info({ target, subscriptionCount: subscriptions.length }, "[Push] Sending notifications");
      }

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete notification
  app.delete("/api/admin/notifications/:id", requireAdmin, (req: any, res) => {
    try {
      db.prepare("DELETE FROM notification_reads WHERE notification_id = ?").run(req.params.id);
      db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- User Notification Routes ---

  // Get notifications for current user
  app.get("/api/notifications", authenticate, (req: any, res) => {
    try {
      const userRow = db.prepare("SELECT tier FROM users WHERE id = ?").get(req.user.id) as any;
      if (!userRow) return res.json({ notifications: [] });
      const tier = userRow.tier;

      const all = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC").all() as any[];
      const filtered = all.filter((n: any) => {
        if (n.target === 'all') return true;
        if (n.target === tier) return true;
        if (n.target === 'specific') {
          try {
            const ids = JSON.parse(n.target_user_ids || '[]');
            return ids.includes(req.user.id);
          } catch { return false; }
        }
        return false;
      });

      const reads = db.prepare(
        "SELECT notification_id FROM notification_reads WHERE user_id = ?"
      ).all(req.user.id) as any[];
      const readSet = new Set(reads.map((r: any) => r.notification_id));

      const result = filtered.map((n: any) => ({ ...n, read: readSet.has(n.id) }));
      res.json({ notifications: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", authenticate, (req: any, res) => {
    try {
      db.prepare(
        "INSERT OR IGNORE INTO notification_reads (user_id, notification_id) VALUES (?, ?)"
      ).run(req.user.id, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Push Subscription Routes ---

  // Get VAPID public key
  app.get("/api/push/vapid-key", (_req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", authenticate, (req: any, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription" });
      }
      db.prepare(
        "INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)"
      ).run(req.user.id, endpoint, keys.p256dh, keys.auth);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", authenticate, (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        db.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").run(req.user.id, endpoint);
      } else {
        db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(req.user.id);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin Analytics ---

  app.get("/api/admin/analytics", requireAdmin, (req: any, res) => {
    try {
      const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE tier != 'guest'").get() as any).c;
      const premiumUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'premium'").get() as any).c;
      const freeUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'free'").get() as any).c;
      const activeToday = (db.prepare(`
        SELECT COUNT(DISTINCT user_id) as c FROM watch_history
        WHERE last_watched >= datetime('now', '-24 hours')
      `).get() as any).c;
      const activeWeek = (db.prepare(`
        SELECT COUNT(DISTINCT user_id) as c FROM watch_history
        WHERE last_watched >= datetime('now', '-7 days')
      `).get() as any).c;
      const newUsersWeek = (db.prepare(`
        SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days') AND tier != 'guest'
      `).get() as any).c;
      const topVideos = db.prepare(`
        SELECT video_id, video_title, COUNT(*) as views, AVG(progress) as avg_progress
        FROM watch_history
        WHERE video_title IS NOT NULL
        GROUP BY video_id
        ORDER BY views DESC
        LIMIT 10
      `).all();
      const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;
      const totalViews = (db.prepare("SELECT COUNT(*) as c FROM watch_history").get() as any).c;
      const expiringSoon = db.prepare(`
        SELECT COUNT(*) as c FROM users
        WHERE tier = 'premium' AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at <= date('now', '+14 days')
        AND subscription_expires_at >= date('now')
      `).get() as any;

      res.json({
        totalUsers, premiumUsers, freeUsers,
        activeToday, activeWeek, newUsersWeek,
        conversionRate, totalViews,
        expiringSoon: expiringSoon.c,
        topVideos,
      });
    } catch (e: any) {
      log.error(e, '[Admin] Analytics error');
      res.status(500).json({ error: e.message });
    }
  });

  // --- YuKassa Payment Integration ---

  app.post("/api/payment/create", authenticate, async (req: any, res) => {
    try {
      const shopId = process.env.YUKASSA_SHOP_ID;
      const secretKey = process.env.YUKASSA_SECRET_KEY;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      if (!shopId || !secretKey) {
        // Fall back to mock if not configured
        return res.json({ confirmation_url: `${appUrl}/api/payment/mock-success-redirect`, mock: true });
      }

      const idempotenceKey = crypto.randomUUID();
      const response = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotence-Key": idempotenceKey,
          "Authorization": "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        },
        body: JSON.stringify({
          amount: { value: "990.00", currency: "RUB" },
          confirmation: { type: "redirect", return_url: `${appUrl}/profile?payment=success` },
          capture: true,
          description: "Premium подписка SCA на 1 год",
          metadata: { user_id: req.user.id },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        log.error({ err }, '[Payment] YuKassa create error');
        return res.status(502).json({ error: "Ошибка платёжного сервиса" });
      }

      const payment = await response.json() as any;
      log.info({ paymentId: payment.id, userId: req.user.id }, '[Payment] Created');
      res.json({ confirmation_url: payment.confirmation?.confirmation_url, paymentId: payment.id });
    } catch (e: any) {
      log.error(e, '[Payment] Create error');
      res.status(500).json({ error: e.message });
    }
  });

  // YuKassa Webhook — called by YuKassa when payment status changes
  app.post("/api/payment/webhook", async (req, res) => {
    try {
      const event = req.body as any;
      log.info({ type: event.type, paymentId: event.object?.id }, '[Payment] Webhook received');

      if (event.type === "payment.succeeded") {
        const payment = event.object;
        const userId = payment?.metadata?.user_id;
        if (userId) {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          db.prepare("UPDATE users SET tier = 'premium', subscription_expires_at = ? WHERE id = ?")
            .run(expiresAt.toISOString().split('T')[0], userId);
          log.info({ userId, expiresAt }, '[Payment] Premium activated via webhook');
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      log.error(e, '[Payment] Webhook error');
      res.status(500).json({ error: e.message });
    }
  });

  // Redirect after mock payment
  app.get("/api/payment/mock-success-redirect", authenticate, (req: any, res) => {
    db.prepare("UPDATE users SET tier = 'premium', subscription_expires_at = ? WHERE id = ?")
      .run(new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0], req.user.id);
    res.redirect('/profile?payment=success');
  });

  // --- Kinescope Webhook ---

  app.post("/api/kinescope/webhook", async (req, res) => {
    try {
      const event = req.body as any;
      const eventType = event.type || event.event;
      log.info({ eventType, videoId: event.data?.id }, '[Kinescope] Webhook received');

      // Update cached broadcast if a new video is published in the broadcasts project
      if (eventType === 'video.published' || eventType === 'video.updated') {
        const projectId = event.data?.project_id;
        if (projectId === 'cc147751-488b-4701-92c0-14f77e068ebe') {
          fetchAndCacheLatestBroadcast();
          log.info('[Kinescope] Broadcast cache refreshed via webhook');
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      log.error(e, '[Kinescope] Webhook error');
      res.status(500).json({ error: e.message });
    }
  });

  // --- Dynamic Meta Tags Helper ---

  async function injectMetaTags(html: string, url: string): Promise<string> {
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const watchMatch = url.match(/^\/watch\/([^/?#]+)/);
    let title = 'SCA — Образовательная платформа';
    let description = 'Лучшие семинары и материалы для тренеров по плаванию';
    let image = `${appUrl}/icon-512.png`;

    if (watchMatch) {
      const videoId = watchMatch[1];
      try {
        const data = await kinescopeFetch(`/videos/${videoId}`);
        if (data?.data) {
          const v = data.data;
          title = `${v.title || 'Видео'} — SCA`;
          description = v.description || description;
          image = v.poster?.md || v.poster?.original || image;
        }
      } catch {}
    }

    const metaTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${appUrl}${url}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${image}" />
    <title>${title}</title>`;

    return html
      .replace(/<title>.*?<\/title>/s, '')
      .replace('</head>', `${metaTags}\n  </head>`);
  }

  // --- Vite Integration ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    const fs = await import("fs");
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        const transformed = await vite.transformIndexHtml(url, template);
        const html = await injectMetaTags(transformed, url);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }));
    app.use(express.static(distPath, {
      maxAge: "1h",
    }));
    app.get("*", async (req, res) => {
      try {
        const template = readFileSync(path.join(distPath, "index.html"), "utf-8");
        const html = await injectMetaTags(template, req.originalUrl);
        res.set("Content-Type", "text/html").send(html);
      } catch {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    log.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
  });
}

startServer();
