# ── Stage 1: Build client ────────────────────────────────────────
FROM node:20-alpine AS build-client
WORKDIR /build/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Build server ────────────────────────────────────────
FROM node:20-alpine AS build-server
WORKDIR /build/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy compiled server
COPY --from=build-server /build/server/dist ./dist
COPY --from=build-server /build/server/node_modules ./node_modules
# Copy static assets that tsc doesn't emit
COPY server/src/crawl-monitor.html ./dist/crawl-monitor.html

# Copy built client into ./public so Express can serve it
COPY --from=build-client /build/client/dist ./public

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
