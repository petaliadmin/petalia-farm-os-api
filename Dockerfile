# syntax=docker/dockerfile:1.7

# ─── Stage 1: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps from a clean lockfile state for reproducible builds
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Produces dist/main.js (HTTP) + dist/worker.js (Bull processors)
RUN npm run build

# Drop devDependencies before copying node_modules to the runtime stage
RUN npm prune --omit=dev

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# dumb-init = proper PID 1 (signals + zombie reaping)
# wget = healthcheck without curl bloat
RUN apk add --no-cache dumb-init wget \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001 -G nodejs

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    PORT=3000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

USER nestjs

EXPOSE 3000

# Health check used by docker-compose `condition: service_healthy`
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- --tries=1 --timeout=4 http://localhost:3000/api/health || exit 1

# Default command runs the HTTP server. The worker container overrides with
# `command: node dist/worker.js` in docker-compose.deploy.yml.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
