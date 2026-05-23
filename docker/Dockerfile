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

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure optional directories that the runtime stage copies always exist,
# even if a developer hasn't populated them yet.
RUN mkdir -p public prisma scripts

# Generate Prisma client (no-op if prisma/schema.prisma is absent during
# very early bootstrap) and build the Next.js application.
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

# Copy build artifacts and runtime files.
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node ./scripts/check-env.js && npx prisma migrate deploy && npm run start -- -p ${PORT:-3000} -H ${HOSTNAME:-0.0.0.0}"]
