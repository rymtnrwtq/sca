FROM node:22-alpine AS builder

# Native modules (better-sqlite3) need build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production image ---
FROM node:22-alpine AS production

WORKDIR /app

# Copy compiled node_modules (incl. native better-sqlite3)
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server and config files
COPY server.ts tsconfig.json ./
COPY public ./public

# content.json is optional but needed if exists
COPY --from=builder /app/content.json* ./

# Directories for SQLite DB and logs
RUN mkdir -p /app/logs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "server.ts"]
