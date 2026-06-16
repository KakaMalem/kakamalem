#!/bin/sh
# Container entrypoint: apply DB migrations, then start the Next.js server.
# A migration failure aborts startup (non-zero exit) so a broken migration
# never serves traffic.
set -e

echo "[entrypoint] Applying database migrations..."
node db-migrate-deploy.cjs

echo "[entrypoint] Starting Next.js server..."
exec node server.js
