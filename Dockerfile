# =============================================================================
# Kaka Malem - Production Dockerfile
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Build arguments for public environment variables
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_UPLOADS_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=BETTER_AUTH_SECRET \
    BETTER_AUTH_SECRET=$(cat /run/secrets/BETTER_AUTH_SECRET) \
    pnpm build

# Bundle the migration runner into a single self-contained CJS file so the
# slim runtime image can apply migrations without drizzle-kit / full deps.
RUN pnpm exec esbuild scripts/db-migrate-deploy.ts \
    --bundle --platform=node --target=node22 --format=cjs \
    --outfile=db-migrate-deploy.cjs

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration runner: the bundled script + the migration SQL it applies on boot.
COPY --from=builder --chown=nextjs:nodejs /app/db-migrate-deploy.cjs ./db-migrate-deploy.cjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /var/www/kakamalem-uploads && chown nextjs:nodejs /var/www/kakamalem-uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Apply migrations, then start the server (see docker-entrypoint.sh).
ENTRYPOINT ["./docker-entrypoint.sh"]
