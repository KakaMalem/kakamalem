#!/bin/bash

# Kaka Malem Deployment Script
# Run this script on your VPS to deploy updates

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

echo "🚀 Starting deployment for Kaka Malem..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/kakamalem"
APP_NAME="kakamalem"
BACKUP_DIR="$APP_DIR/.backups"
LOG_DIR="$APP_DIR/.logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_LOG="$LOG_DIR/deploy_$TIMESTAMP.log"

# Ensure directories exist
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log() {
    echo -e "$1" | tee -a "$DEPLOY_LOG"
}

# Error handler
error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

# Function to create backup
create_backup() {
    log "${BLUE}📦 Creating backup...${NC}"
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
    mkdir -p "$BACKUP_PATH"

    # Backup current build
    if [ -d ".next" ]; then
        cp -r .next "$BACKUP_PATH/" || error_exit "Failed to backup build"
        log "${GREEN}✓ Build backed up${NC}"
    fi

    # Store current git commit
    git rev-parse HEAD > "$BACKUP_PATH/commit.txt" || error_exit "Failed to save commit hash"
    log "${GREEN}✓ Commit hash saved${NC}"

    # Backup package.json and pnpm-lock.yaml
    cp package.json "$BACKUP_PATH/" 2>/dev/null || true
    cp pnpm-lock.yaml "$BACKUP_PATH/" 2>/dev/null || true
}

# Function to rollback on failure
rollback() {
    log "${RED}⚠️  Deployment failed. Initiating rollback...${NC}"

    # Disable exit on error during rollback
    set +e

    if [ -d "$BACKUP_PATH/.next" ]; then
        rm -rf .next
        cp -r "$BACKUP_PATH/.next" .
        log "${YELLOW}✓ Build restored from backup${NC}"
    fi

    if [ -f "$BACKUP_PATH/commit.txt" ]; then
        PREVIOUS_COMMIT=$(cat "$BACKUP_PATH/commit.txt")
        git reset --hard "$PREVIOUS_COMMIT"
        log "${YELLOW}✓ Git reset to previous commit${NC}"

        # Restore dependencies if package.json changed
        if [ -f "$BACKUP_PATH/package.json" ]; then
            pnpm install --frozen-lockfile 2>&1 | tee -a "$DEPLOY_LOG"
            log "${YELLOW}✓ Dependencies restored${NC}"
        fi
    fi

    pm2 restart "$APP_NAME" 2>&1 | tee -a "$DEPLOY_LOG"
    log "${YELLOW}✓ Application restarted${NC}"

    # Check if rollback was successful
    if pm2 describe "$APP_NAME" | grep -q "online"; then
        log "${YELLOW}✅ Rollback successful - application is running${NC}"
    else
        log "${RED}⚠️  Rollback completed but application may not be running properly${NC}"
    fi

    log "${RED}❌ Deployment failed and rolled back${NC}"
    log "${BLUE}📋 Deployment log saved at: $DEPLOY_LOG${NC}"
    exit 1
}

# Trap errors and trigger rollback
trap rollback ERR

log "${BLUE}Deployment started at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"

# Check if running from correct directory
if [ "$PWD" != "$APP_DIR" ]; then
    log "${YELLOW}⚠️  Changing to application directory: $APP_DIR${NC}"
    cd "$APP_DIR" || error_exit "Failed to change to application directory"
fi

# Verify required commands exist
for cmd in git pnpm pm2; do
    if ! command -v "$cmd" &> /dev/null; then
        error_exit "$cmd is not installed"
    fi
done

# Verify .env file exists
if [ ! -f ".env" ]; then
    error_exit ".env file not found in $APP_DIR"
fi

# Create backup before deployment
create_backup

# Step 1: Pull latest changes
log "${GREEN}📥 Pulling latest changes from Git...${NC}"
BEFORE_COMMIT=$(git rev-parse HEAD)
git fetch origin main || error_exit "Failed to fetch from Git"
git pull origin main || error_exit "Failed to pull from Git"
AFTER_COMMIT=$(git rev-parse HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    log "${YELLOW}⚠️  No new changes detected. Skipping deployment.${NC}"
    log "${BLUE}📋 Deployment log saved at: $DEPLOY_LOG${NC}"
    exit 0
fi

log "${BLUE}Updated from $BEFORE_COMMIT to $AFTER_COMMIT${NC}"

# Step 2: Install dependencies
log "${GREEN}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile 2>&1 | tee -a "$DEPLOY_LOG" || error_exit "Failed to install dependencies"

# Step 3: Sync database schema
log "${GREEN}🗄️  Syncing database schema...${NC}"
# Check if schema changes are needed
if git diff --name-only "$BEFORE_COMMIT" "$AFTER_COMMIT" | grep -q "lib/db/schema.ts"; then
  log "${BLUE}📝 Schema changes detected${NC}"
  # Use db:push for now (schema already in prod, migrations not tracked yet)
  # TODO: Switch to db:migrate once migration tracking is set up properly
  pnpm db:push 2>&1 | tee -a "$DEPLOY_LOG" || {
    log "${YELLOW}⚠️  Schema sync had warnings, but continuing...${NC}"
  }
else
  log "${BLUE}ℹ️  No schema changes detected${NC}"
fi

# Step 4: Build application
log "${GREEN}🔨 Building application...${NC}"
NODE_ENV=production pnpm build 2>&1 | tee -a "$DEPLOY_LOG" || error_exit "Failed to build application"

# Step 5: Restart PM2
log "${GREEN}🔄 Restarting application with PM2...${NC}"
pm2 restart "$APP_NAME" --update-env 2>&1 | tee -a "$DEPLOY_LOG" || error_exit "Failed to restart PM2"

# Step 6: Wait for application to be healthy
log "${BLUE}⏳ Waiting for application to start...${NC}"
sleep 5

# Step 7: Check if application is running
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if pm2 describe "$APP_NAME" | grep -q "online"; then
        log "${GREEN}✅ Application is running${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            log "${YELLOW}⏳ Retry $RETRY_COUNT/$MAX_RETRIES...${NC}"
            sleep 3
        else
            log "${RED}❌ Application failed to start after $MAX_RETRIES attempts${NC}"
            rollback
        fi
    fi
done

# Step 8: Save PM2 configuration
pm2 save 2>&1 | tee -a "$DEPLOY_LOG"

# Step 9: Cleanup old backups (keep last 5)
log "${BLUE}🧹 Cleaning up old backups...${NC}"
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf
log "${GREEN}✓ Old backups cleaned${NC}"
cd "$APP_DIR"

# Step 10: Cleanup old logs (keep last 10)
cd "$LOG_DIR"
ls -t deploy_*.log | tail -n +11 | xargs -r rm -f
cd "$APP_DIR"

# Step 11: Show status
log "${GREEN}✅ Deployment completed successfully!${NC}"
log ""
log "Application status:"
pm2 status "$APP_NAME" | tee -a "$DEPLOY_LOG"
log ""
log "Recent logs:"
pm2 logs "$APP_NAME" --lines 20 --nostream | tee -a "$DEPLOY_LOG"

log ""
log "${GREEN}🎉 Deployment finished! Your application is now live.${NC}"
log "${BLUE}Monitor logs with: pm2 logs $APP_NAME${NC}"
log "${BLUE}Backup stored at: $BACKUP_PATH${NC}"
log "${BLUE}Deployment log: $DEPLOY_LOG${NC}"
log "${BLUE}Deployment completed at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
