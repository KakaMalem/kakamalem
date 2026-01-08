#!/bin/bash

# =============================================================================
# Kaka Malem - Database Backup Script
# =============================================================================
# Creates compressed PostgreSQL backups with rotation
#
# Usage:
#   ./backup-database.sh              # Manual backup
#   ./backup-database.sh --cleanup    # Backup + cleanup old backups
#
# Cron example (daily at 3 AM):
#   0 3 * * * /var/www/kakamalem/scripts/backup-database.sh --cleanup >> /var/log/kakamalem-backup.log 2>&1
# =============================================================================

set -e

# Configuration
DB_NAME="kakamalem"
BACKUP_DIR="/var/backups/postgresql"
UPLOADS_DIR="/var/www/kakamalem-uploads"
BACKUP_RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"; exit 1; }

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# -----------------------------------------------------------------------------
# Database Backup
# -----------------------------------------------------------------------------
log "Starting database backup..."

DB_BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

# Use custom format (-Fc) for compression and flexibility
if sudo -u postgres pg_dump -Fc -d "$DB_NAME" > "$DB_BACKUP_FILE"; then
    DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    log "Database backup completed: $DB_BACKUP_FILE ($DB_SIZE)"
else
    error "Database backup failed!"
fi

# -----------------------------------------------------------------------------
# Uploads Backup (Optional - only if uploads exist and have changed)
# -----------------------------------------------------------------------------
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"

    log "Starting uploads backup..."

    # Use incremental-like behavior by checking if anything changed
    LAST_UPLOADS_BACKUP=$(ls -t "$BACKUP_DIR"/uploads_*.tar.gz 2>/dev/null | head -1)

    if [ -n "$LAST_UPLOADS_BACKUP" ]; then
        # Check if any files are newer than last backup
        NEWER_FILES=$(find "$UPLOADS_DIR" -newer "$LAST_UPLOADS_BACKUP" -type f 2>/dev/null | wc -l)
        if [ "$NEWER_FILES" -eq 0 ]; then
            log "No new uploads since last backup, skipping uploads backup"
        else
            tar -czf "$UPLOADS_BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)"
            UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
            log "Uploads backup completed: $UPLOADS_BACKUP_FILE ($UPLOADS_SIZE)"
        fi
    else
        # First backup, create it
        tar -czf "$UPLOADS_BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)"
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
        log "Uploads backup completed: $UPLOADS_BACKUP_FILE ($UPLOADS_SIZE)"
    fi
else
    log "No uploads directory or empty, skipping uploads backup"
fi

# -----------------------------------------------------------------------------
# Cleanup Old Backups
# -----------------------------------------------------------------------------
if [ "$1" = "--cleanup" ]; then
    log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."

    # Remove old database backups
    OLD_DB_BACKUPS=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -mtime +$BACKUP_RETENTION_DAYS -type f)
    if [ -n "$OLD_DB_BACKUPS" ]; then
        echo "$OLD_DB_BACKUPS" | xargs rm -f
        log "Removed old database backups"
    fi

    # Remove old uploads backups
    OLD_UPLOADS_BACKUPS=$(find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$BACKUP_RETENTION_DAYS -type f)
    if [ -n "$OLD_UPLOADS_BACKUPS" ]; then
        echo "$OLD_UPLOADS_BACKUPS" | xargs rm -f
        log "Removed old uploads backups"
    fi

    log "Cleanup completed"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
log "Backup completed successfully!"
log "Database: $DB_BACKUP_FILE"

# Show backup directory status
echo ""
log "Backup directory status:"
du -sh "$BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -5

# -----------------------------------------------------------------------------
# Restore Instructions (printed as reference)
# -----------------------------------------------------------------------------
echo ""
echo "============================================================================="
echo "To restore this backup:"
echo "============================================================================="
echo ""
echo "Database:"
echo "  sudo -u postgres pg_restore -d $DB_NAME --clean --if-exists $DB_BACKUP_FILE"
echo ""
echo "Uploads (if backed up):"
echo "  tar -xzf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz -C /var/www/"
echo ""
