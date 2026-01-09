# =============================================================================
# Kaka Malem - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal image size (~150MB vs ~1GB)
# Uses Next.js standalone output for optimal production deployment
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for public environment variables (these are safe to expose)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_UPLOADS_URL

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
# BETTER_AUTH_SECRET is passed via --mount=type=secret to avoid baking into image layers
RUN --mount=type=secret,id=BETTER_AUTH_SECRET \
    BETTER_AUTH_SECRET=$(cat /run/secrets/BETTER_AUTH_SECRET) \
    pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies
# Note: sharp is already bundled in Next.js standalone output with precompiled binaries
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application
# Next.js standalone output includes only necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create uploads directory (will be mounted as volume)
# Uses /var/www/kakamalem-uploads to match VPS STORAGE_PATH env var
RUN mkdir -p /var/www/kakamalem-uploads && chown nextjs:nodejs /var/www/kakamalem-uploads

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
