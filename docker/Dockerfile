# syntax=docker/dockerfile:1.6
#
# Privello platform Dockerfile (multi-stage)
#
# Stages:
#   1. deps    - install all Node dependencies (incl. devDependencies)
#   2. build   - generate Prisma client and run `next build`
#   3. runtime - minimal image that boots the Next.js server
#
# Runtime contract (Requirements 7.1, 7.5, 7.6):
#   * `node ./scripts/check-env.js` aborts before HTTP traffic when
#     required env vars are missing (exit code != 0).
#   * `prisma migrate deploy` applies pending migrations on start.
#   * `next start` listens on the port given by $PORT (default 3000).
#
# The same image is used locally (via docker-compose) and on Railway;
# only env var values change between environments.

# ============================================================
# Stage 1: deps
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on the lockfile only, for cache friendliness.
COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# Stage 2: build
# ============================================================
FROM node:20-alpine AS build
WORKDIR /app

# SKIP_ENV_VALIDATION=1 evita que next.config.ts chame validateEnv() durante
# o `next build` no Railway, onde as variáveis de runtime ainda não existem.
ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure optional directories that the runtime stage copies always exist,
# even if a developer hasn't populated them yet.
RUN mkdir -p public prisma scripts

# Generate Prisma client and build the Next.js application.
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi \
 && npm run build

# ============================================================
# Stage 3: runtime
# ============================================================
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install a tiny init so signals are forwarded properly to the Node process.
RUN apk add --no-cache tini

# Standalone Next.js server — auto-gerado pelo `next build` com output:"standalone".
# Contém server.js + node_modules trimados. Não precisa do src/ em runtime.
COPY --from=build /app/.next/standalone ./

# Assets estáticos e pasta public (o server.js os serve de caminhos relativos).
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Schema + migrations do Prisma (necessários para `prisma migrate deploy`).
COPY --from=build /app/prisma ./prisma

# Script de validação de env que roda antes do servidor subir.
COPY --from=build /app/scripts ./scripts

# CLI do Prisma (devDependency — não está no standalone node_modules).
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node ./scripts/check-env.js && node ./node_modules/.bin/prisma migrate deploy && node server.js"]
