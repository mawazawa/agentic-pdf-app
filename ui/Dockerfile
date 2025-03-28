# Stage 1: Base with pnpm
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Stage 2: Dev dependencies
FROM base AS dev
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "dev", "-p", "8080"]

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm build

# Stage 4: Production
FROM base AS prod
WORKDIR /app
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
CMD ["node", "server.js"]