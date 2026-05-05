# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Repository layout

The repo root contains a Next.js 16.2.2 skeleton that is **not the active app**. All real development happens in `eduplatform/`.

```
eduplatform/   ← the actual application (React + Vite + Express + SQLite)
src/           ← unused Next.js scaffold
```

## Development (eduplatform)

```bash
cd eduplatform
npm run dev     # Express + Vite SSR dev server on http://localhost:3000
npm run build   # Production build
```

## Architecture overview

`server.ts` is the single entry point — it runs an Express server that mounts the Vite middleware in dev mode (same process, port 3000). There is no separate frontend server.

**Frontend** (React 19, Vite 6, Tailwind CSS 4, react-router-dom 7):
- `src/App.tsx` — client-side router
- `src/contexts/AuthContext.tsx` — global auth state, reads JWT from `localStorage('auth_token')`
- `src/pages/` — one file per route
- `src/components/video/` — VideoGrid, CatalogGrid, FolderViewer, VideoPlaylistViewer
- `src/constants/index.tsx` — static catalog data (seminar/material folder lists)
- `src/utils/localStorage.ts` — watch progress, bookmarks, hidden videos (all client-side)
- Animations via `motion/react` (not `framer-motion`)

**Backend** (Express in `server.ts`):
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me` — bcryptjs + jose JWT (30-day tokens)
- Videos: proxied from Kinescope API (`KINESCOPE_TOKEN` in `.env`): `/api/videos`, `/api/folder-videos`, `/api/videos/by-ids`, `/api/folders`, `/api/search`
- DB: SQLite via `better-sqlite3` (`data.db`) — tables: `users`, `watch_history`, `watch_later`, `allowed_projects`

**Access tiers**: `guest` | `free` | `premium` — stored in `users.tier`

**Kinescope sections** map to `allowed_projects.section`: `broadcasts` | `seminars` | `materials`. Project IDs are seeded at startup with `INSERT OR IGNORE`.

## Production server

| | |
|---|---|
| **IP** | `5.42.116.97` |
| **User** | `root` |
| **Password** | `yi*hwM7#6untBK` |

The app runs inside a Docker container on this server. To deploy:

```bash
ssh root@5.42.116.97
# inside the server:
cd /path/to/app          # find with: docker ps, then docker inspect <container>
git pull
docker compose build && docker compose up -d
# or if using a single container:
docker build -t eduplatform . && docker run -d --restart=always -p 3000:3000 eduplatform
```

Check running containers: `docker ps`  
View logs: `docker logs <container_name> -f`

## Conventions

- Styles: Tailwind + `cn()` from `src/lib/utils.ts`
- API calls: plain `fetch` on the client (no axios)
- Shared types: `src/types.ts` (`User`, `Lesson`, `Chapter`, `UserTier`, etc.)
