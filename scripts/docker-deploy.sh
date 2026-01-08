#!/bin/bash

# =============================================================================
# Kaka Malem - Docker Deployment Script
# =============================================================================
# Deploys the application using Docker with zero-downtime updates
#
# Usage:
#   ./docker-deploy.sh              # Pull and deploy latest
#   ./docker-deploy.sh --build      # Build locally and deploy
#   ./docker-deploy.sh --rollback   # Rollback to previous image
# =============================================================================

set -e

# Configuration
APP_DIR="/var/www/kakamalem"
APP_NAME="kakamalem-app"
IMAGE_NAME="ghcr.io/KakaMalem/kakamalem"  # Change this to your registry
BACKUP_DIR="$APP_DIR/.backups"
LOG_FILE="$APP_DIR/.logs/docker-deploy_$(date +%Y%m%d_%H%M%S).log"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

# Ensure directories exist
mkdir -p "$BACKUP_DIR" "$(dirname $LOG_FILE)"

# Change to app directory
cd "$APP_DIR" || error "Failed to change to $APP_DIR"

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
log "Running pre-flight checks..."

# Check Docker is running
if ! docker info &> /dev/null; then
    error "Docker is not running"
fi

# Check docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml not found in $APP_DIR"
fi

# Check .env exists
if [ ! -f ".env" ]; then
    error ".env file not found in $APP_DIR"
fi

log "Pre-flight checks passed"

# -----------------------------------------------------------------------------
# Save current image ID for rollback
# -----------------------------------------------------------------------------
CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' "$APP_NAME" 2>/dev/null || echo "none")
if [ "$CURRENT_IMAGE" != "none" ]; then
    echo "$CURRENT_IMAGE" > "$BACKUP_DIR/previous_image_id"
    log "Saved current image ID for rollback: ${CURRENT_IMAGE:0:12}"
fi

# -----------------------------------------------------------------------------
# Deployment
# -----------------------------------------------------------------------------
case "$1" in
    --build)
        log "Building Docker image locally..."

        # Build with build args from .env
        docker compose build --no-cache app 2>&1 | tee -a "$LOG_FILE"

        log "Starting new container..."
        docker compose up -d app 2>&1 | tee -a "$LOG_FILE"
        ;;

    --rollback)
        log "Rolling back to previous image..."

        if [ ! -f "$BACKUP_DIR/previous_image_id" ]; then
            error "No previous image ID found for rollback"
        fi

        PREVIOUS_IMAGE=$(cat "$BACKUP_DIR/previous_image_id")
        log "Rolling back to: ${PREVIOUS_IMAGE:0:12}"

        # Tag previous image as latest for docker-compose
        docker tag "$PREVIOUS_IMAGE" "$IMAGE_NAME:latest"

        # Restart with previous image
        docker compose up -d app 2>&1 | tee -a "$LOG_FILE"
        ;;

    *)
        log "Pulling latest image..."
        docker compose pull app 2>&1 | tee -a "$LOG_FILE"

        log "Starting new container..."
        docker compose up -d app 2>&1 | tee -a "$LOG_FILE"
        ;;
esac

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
log "Waiting for application to be healthy..."

MAX_RETRIES=30
RETRY_COUNT=0
HEALTH_URL="http://localhost:3000/api/health"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

    if [ "$HEALTH_RESPONSE" = "200" ]; then
        log "Application is healthy!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo -n "."
        sleep 2
    else
        warn "Health check failed after $MAX_RETRIES attempts"

        # Show container logs for debugging
        log "Container logs:"
        docker compose logs --tail=50 app 2>&1 | tee -a "$LOG_FILE"

        # Ask if user wants to rollback
        if [ "$1" != "--rollback" ] && [ -f "$BACKUP_DIR/previous_image_id" ]; then
            warn "Deployment may have failed. Consider running: $0 --rollback"
        fi

        exit 1
    fi
done

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
log "Cleaning up old images..."
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "" | tee -a "$LOG_FILE"
log "============================================================================="
log "Deployment completed successfully!"
log "============================================================================="
echo "" | tee -a "$LOG_FILE"

# Show container status
docker compose ps | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
log "Health check: $HEALTH_URL"
curl -s "$HEALTH_URL" | jq . 2>/dev/null || curl -s "$HEALTH_URL" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
log "View logs: docker compose logs -f app"
log "Rollback:  $0 --rollback"
log "Log file:  $LOG_FILE"
