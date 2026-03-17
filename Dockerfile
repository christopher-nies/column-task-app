# ── Stage 1: build the Vite frontend ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# better-sqlite3 is a native addon — needs build tools to compile on Alpine
RUN apk add --no-cache python3 make g++

# Copy only what the server needs
COPY package*.json ./
RUN npm ci --omit=dev

# Remove build tools after compilation to keep the image lean
RUN apk del python3 make g++

# Copy compiled frontend and server source
COPY --from=builder /app/dist ./dist
COPY server ./server

# SQLite data lives here — mount a volume to persist it
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
