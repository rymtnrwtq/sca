# EduPlatform — образовательная платформа SCA

## Структура проекта

Весь код находится в `eduplatform/`. Корень репозитория — пустая обёртка.

```
eduplatform/
├── server.ts              # Express + Vite SSR сервер (точка входа: npm run dev)
├── data.db                # SQLite база данных (better-sqlite3)
├── .env                   # Секреты (KINESCOPE_TOKEN и др.) — не коммитить
├── src/
│   ├── App.tsx            # Роутинг React-приложения
│   ├── main.tsx           # React entry point
│   ├── types.ts           # Общие типы: User, Lesson, UserTier и др.
│   ├── lib/utils.ts       # cn() — утилита для classnames
│   ├── constants/
│   │   └── index.tsx      # Табы, каталоги семинаров и материалов (CatalogItem[])
│   ├── contexts/
│   │   └── AuthContext.tsx # AuthProvider + useAuth hook
│   ├── utils/
│   │   └── localStorage.ts # Утилиты для прогресса, избранного, скрытых видео
│   ├── pages/
│   │   ├── Learn.tsx      # Страница /learn: Эфиры / Семинары / Материалы
│   │   ├── WatchVideo.tsx # Страница /watch/:id — плеер + главы
│   │   ├── Dashboard.tsx  # Главная /
│   │   ├── Auth.tsx       # /auth — логин и регистрация
│   │   ├── Profile.tsx    # /profile
│   │   ├── Chat.tsx       # /chat
│   │   ├── HistoryPage.tsx
│   │   ├── BookmarksPage.tsx
│   │   └── Offline.tsx
│   └── components/
│       ├── layout/        # Навигация, шапка
│       ├── ui/            # Переиспользуемые UI: BottomSheet, Pagination и др.
│       └── video/         # VideoGrid, CatalogGrid, FolderViewer, VideoPlaylistViewer
├── public/
│   ├── prep.png
│   ├── success.png
│   └── swimming2.png
├── package.json
└── vite.config.ts
```

## Стек

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, motion/react, react-router-dom 7, lucide-react
- **Backend**: Express 4 (в том же процессе, `server.ts`)
- **БД**: SQLite через `better-sqlite3` (файл `data.db`)
- **Видео**: Kinescope (iframe-плеер, REST API для списка видео)
- **Dev**: `tsx server.ts` запускает Express + Vite middleware вместе на порту 3000

## Запуск

```bash
cd eduplatform
npm run dev   # dev-сервер на http://localhost:3000
npm run build # production сборка
```

## Архитектура

### Auth (логин + пароль)
- `POST /api/auth/register` — регистрация: `{ username, password, name }` → `{ token, user }`
- `POST /api/auth/login` — вход: `{ username, password }` → `{ token, user }`
- `GET /api/me` — получить текущего пользователя по токену
- Пароли хэшируются через `bcryptjs`
- JWT-токены через `jose`, срок — 30 дней
- Клиент хранит токен в `localStorage('auth_token')`

### База данных (SQLite)
Таблицы в `data.db`:
```sql
users (id, username, name, password_hash, tier, created_at)
watch_history (user_id, video_id, progress, last_position, last_watched)
watch_later (user_id, video_id, added_at)
allowed_projects (id, section)  -- разрешённые проекты Kinescope
```

`allowed_projects.section` — одно из: `broadcasts` | `seminars` | `materials`

Сидирование проектов (idempotent, `INSERT OR IGNORE` при каждом старте):

| ID | Название | Section |
|----|---------|---------|
| cc147751-488b-4701-92c0-14f77e068ebe | SCA LIVE | broadcasts |
| 75a3101e-c447-40bf-9dac-6ab66d06cfe9 | Сторонние материалы | seminars |
| 998ad1d1-b0a1-47e1-aa40-58a295fb142e | Дополнительные материалы | seminars |
| 75a3101e-c447-40bf-9dac-62c5cd40fcab | Материалы | materials |

### Тиры доступа
```ts
type UserTier = 'guest' | 'free' | 'premium';
```

### Kinescope (видео)
- Токен: `KINESCOPE_TOKEN` в `.env`
- API base: `https://api.kinescope.io/v1`
- `GET /api/videos?section=X&per_page=N&page=N` — видео по секции (мёрж из всех проектов секции)
- `GET /api/folder-videos?folder_id=X&project_id=Y&per_page=N&page=N` — видео из конкретной папки
- `GET /api/videos/by-ids?ids=id1,id2,...` — видео по конкретным ID (для playlist-режима)
- `GET /api/folders?project_id=X` — список папок проекта
- `GET /api/search?q=...` — поиск по title во всех allowed_projects
- Ответ видео включает: `{ id, title, duration, durationSec, embedUrl, posterUrl, createdAt, tags, chapters[] }`

### Форматы
- `formatDuration(seconds)` → `"1:20:36"` или `"45:00"` (часы только если ≥3600 сек)
- Главы (`chapters`) включаются только если у видео `chapters.enabled === true`

## Страница Learn (`/learn`)

Три таба: **Эфиры** / **Семинары** / **Материалы**

- **Эфиры** — загружает все видео из проекта SCA LIVE через `/api/videos?section=broadcasts&per_page=500`. Поддерживает: поиск, фильтрацию по статусу (все / в процессе / завершённые / избранное / скрытые), сортировку (дата / длительность / название), пагинацию (24 шт на страницу).
- **Семинары** — каталог папок из `constants/index.tsx` (SCA_SEMINARS, FOREIGN_SEMINARS, OTHER_SEMINARS). Каждая папка открывается через `FolderViewer` (папка Kinescope) или `VideoPlaylistViewer` (фиксированный список videoIds).
- **Материалы** — аналогично, каталог `MATERIALS_CATALOG` с подкатегориями.

Каталог — статические данные в `constants/index.tsx`, видео по папкам — динамически с Kinescope API.

## Соглашения

- Стили через Tailwind + `cn()` из `lib/utils.ts`
- Анимации через `motion` (motion/react, не framer-motion)
- API-запросы напрямую через `fetch`, без axios на клиенте
- Прогресс просмотра, избранное, скрытые видео — в localStorage (utils/localStorage.ts)
- Типы `Lesson`, `Chapter`, `UserTier` — в `types.ts`
