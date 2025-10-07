# Multi-stage Dockerfile for Cocoon Hub backend (NestJS)

FROM node:20-alpine AS builder
WORKDIR /app

# Enable corepack and install deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ---- Runtime image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and production deps
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
