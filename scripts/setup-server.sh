#!/bin/bash

# =============================================================================
# Kaka Malem - Complete VPS Setup Script
# =============================================================================
# Run this on a fresh Ubuntu 22.04+ VPS to set up everything.
# This script installs and configures ALL infrastructure components.
#
# Usage:
#   sudo ./scripts/setup-server.sh
#
# What this script does:
#   1. Installs Nginx, Caddy, Docker
#   2. Copies all config files to their system locations
#   3. Generates SSL fallback certs and secrets
#   4. Creates required directories
#   5. Sets up cron jobs
#
# What this script does NOT do:
#   - Database setup (run scripts/setup-postgres.sh separately)
#   - Application deployment (run scripts/docker-deploy.sh after)
#   - DNS configuration (do this manually at your registrar)
#
# Prerequisites:
#   - Ubuntu 22.04+ or Debian 12+
#   - Root or sudo access
#   - Domain pointed to this server (kakamalem.com → VPS IP)
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}[STEP]${NC} $1"; }

# =============================================================================
# CONFIGURATION
# =============================================================================
APP_DIR="/var/www/kakamalem"
UPLOADS_DIR="/var/www/kakamalem-uploads"
TEMP_UPLOADS_DIR="/tmp/kakamalem-uploads"
BACKUP_DIR="/var/backups/postgresql"
LOG_DIR="/var/log/caddy"
DOMAIN="kakamalem.com"

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root: sudo $0"
    exit 1
fi

# Detect script directory (repo root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "=============================================="
echo "  Kaka Malem - VPS Setup"
echo "=============================================="
echo "  App directory:  $APP_DIR"
echo "  Uploads:        $UPLOADS_DIR"
echo "  Domain:         $DOMAIN"
echo "=============================================="
echo ""

# =============================================================================
# 1. SYSTEM PACKAGES
# =============================================================================
log_step "1/8 - Installing system packages..."

apt update
apt install -y \
    curl \
    wget \
    git \
    unzip \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx

log_info "System packages installed"

# =============================================================================
# 2. DOCKER
# =============================================================================
log_step "2/8 - Installing Docker..."

if command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log_info "Docker installed: $(docker --version)"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

log_info "Docker Compose: $(docker compose version)"

# =============================================================================
# 3. NGINX
# =============================================================================
log_step "3/8 - Configuring Nginx..."

if ! command -v nginx &> /dev/null; then
    apt install -y nginx
fi

# Copy main nginx config
cp "$REPO_DIR/nginx.conf" /etc/nginx/sites-available/kakamalem
ln -sf /etc/nginx/sites-available/kakamalem /etc/nginx/sites-enabled/kakamalem

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Copy rate limiting config
cp "$REPO_DIR/database/nginx-rate-limits.conf" /etc/nginx/conf.d/rate-limits.conf

# Copy custom domains catch-all
cp "$REPO_DIR/database/nginx-custom-domains.conf" /etc/nginx/sites-available/kakamalem-custom
ln -sf /etc/nginx/sites-available/kakamalem-custom /etc/nginx/sites-enabled/kakamalem-custom

# Generate self-signed fallback cert for custom domain catch-all
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/fallback.pem ]; then
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/fallback-key.pem \
        -out /etc/nginx/ssl/fallback.pem \
        -subj "/CN=fallback" 2>/dev/null
    log_info "Generated fallback self-signed cert"
else
    log_info "Fallback cert already exists"
fi

# Create initial upstream config for blue-green deployment
if [ ! -f /etc/nginx/conf.d/kakamalem-upstream.conf ]; then
    cat > /etc/nginx/conf.d/kakamalem-upstream.conf <<'EOF'
upstream kakamalem_app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001 backup;
}
EOF
    log_info "Created initial upstream config"
fi

systemctl enable nginx

# Don't start nginx yet - SSL certs needed first
log_info "Nginx configured (will start after SSL cert setup)"

# =============================================================================
# 4. CADDY (for custom domain TLS)
# =============================================================================
log_step "4/8 - Installing Caddy..."

if command -v caddy &> /dev/null; then
    log_info "Caddy already installed: $(caddy version)"
else
    apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudflare.com/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudflare.com/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt update
    apt install -y caddy
    log_info "Caddy installed: $(caddy version)"
fi

# Copy Caddyfile
cp "$REPO_DIR/Caddyfile" /etc/caddy/Caddyfile

# Create log directory
mkdir -p "$LOG_DIR"
chown caddy:caddy "$LOG_DIR"

systemctl enable caddy
log_info "Caddy configured"

# =============================================================================
# 5. DIRECTORIES
# =============================================================================
log_step "5/8 - Creating directories..."

mkdir -p "$APP_DIR"
mkdir -p "$UPLOADS_DIR"
mkdir -p "$TEMP_UPLOADS_DIR"
mkdir -p "$BACKUP_DIR"

# Set ownership for uploads (Docker container runs as nextjs:nodejs uid 1001)
chown -R 1001:1001 "$UPLOADS_DIR"
chown -R 1001:1001 "$TEMP_UPLOADS_DIR"

log_info "Directories created"

# =============================================================================
# 6. ENVIRONMENT FILE
# =============================================================================
log_step "6/8 - Setting up environment..."

if [ ! -f "$APP_DIR/.env" ]; then
    # Copy .env.example as starting point
    cp "$REPO_DIR/.env.example" "$APP_DIR/.env"

    # Generate secrets
    CRON_SECRET=$(openssl rand -hex 32)
    AUTH_SECRET=$(openssl rand -base64 32)

    # Replace placeholders
    sed -i "s|CRON_SECRET=\"your-cron-secret-at-least-32-characters\"|CRON_SECRET=\"$CRON_SECRET\"|" "$APP_DIR/.env"
    sed -i "s|BETTER_AUTH_SECRET=\"your-super-secret-key-at-least-32-characters-long\"|BETTER_AUTH_SECRET=\"$AUTH_SECRET\"|" "$APP_DIR/.env"
    sed -i "s|NODE_ENV=\"development\"|NODE_ENV=\"production\"|" "$APP_DIR/.env"

    log_info ".env created from template with generated secrets"
    log_warn "IMPORTANT: Edit $APP_DIR/.env to fill in remaining values (database, SMTP, OAuth)"
else
    # .env already exists - just ensure CRON_SECRET is set
    if ! grep -q "CRON_SECRET" "$APP_DIR/.env"; then
        CRON_SECRET=$(openssl rand -hex 32)
        echo "" >> "$APP_DIR/.env"
        echo "# Cron Jobs" >> "$APP_DIR/.env"
        echo "CRON_SECRET=\"$CRON_SECRET\"" >> "$APP_DIR/.env"
        log_info "Added CRON_SECRET to existing .env"
    fi

    if ! grep -q "DOMAIN_PROXY_TARGET" "$APP_DIR/.env"; then
        echo "DOMAIN_PROXY_TARGET=\"proxy.kakamalem.com\"" >> "$APP_DIR/.env"
        log_info "Added DOMAIN_PROXY_TARGET to existing .env"
    fi

    log_info ".env already exists, checked for missing vars"
fi

# Secure .env
chmod 600 "$APP_DIR/.env"

# =============================================================================
# 7. CRON JOBS
# =============================================================================
log_step "7/8 - Setting up cron jobs..."

CRON_SECRET=$(grep "CRON_SECRET=" "$APP_DIR/.env" | cut -d'"' -f2)

# Build crontab entries
CRON_ENTRIES="# Kaka Malem cron jobs
0 3 * * * $APP_DIR/scripts/backup-database.sh --cleanup >> /var/log/kakamalem-backup.log 2>&1
*/5 * * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" https://$DOMAIN/api/cron/domain-health > /dev/null 2>&1
0 4 * * * find /tmp/kakamalem-uploads -type f -mmin +60 -delete 2>/dev/null"

# Check if cron jobs already installed
if crontab -l 2>/dev/null | grep -q "kakamalem"; then
    log_info "Cron jobs already configured"
else
    # Append to existing crontab (preserve any existing entries)
    (crontab -l 2>/dev/null; echo ""; echo "$CRON_ENTRIES") | crontab -
    log_info "Cron jobs installed"
fi

# =============================================================================
# 8. SSL CERTIFICATE
# =============================================================================
log_step "8/8 - SSL certificate..."

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_info "SSL cert already exists for $DOMAIN"
else
    log_warn "SSL certificate not found for $DOMAIN"
    echo ""
    echo "  Run this after DNS is pointed to this server:"
    echo "  sudo certbot certonly --nginx -d $DOMAIN -d www.$DOMAIN"
    echo ""
fi

# =============================================================================
# START SERVICES
# =============================================================================
log_step "Starting services..."

# Validate nginx config before starting
if nginx -t 2>/dev/null; then
    systemctl restart nginx
    log_info "Nginx started"
else
    log_warn "Nginx config has errors - fix before starting"
fi

# Validate and start Caddy
if caddy validate --config /etc/caddy/Caddyfile 2>/dev/null; then
    systemctl restart caddy
    log_info "Caddy started"
else
    log_warn "Caddyfile has errors - fix before starting"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=============================================="
echo "  SETUP COMPLETE"
echo "=============================================="
echo ""
echo "  What was configured:"
echo "    [x] Docker"
echo "    [x] Nginx (main site + custom domain catch-all)"
echo "    [x] Caddy (on-demand TLS for custom domains)"
echo "    [x] Directories (uploads, backups, logs)"
echo "    [x] Environment variables (.env)"
echo "    [x] Cron jobs (backups, domain health, cleanup)"
echo ""
echo "  Still needed:"
echo "    1. Database: sudo $REPO_DIR/scripts/setup-postgres.sh"
echo "    2. Edit .env: nano $APP_DIR/.env"
echo "       - Fill in DATABASE_URL, SMTP, OAuth credentials"
echo "    3. SSL cert: sudo certbot certonly --nginx -d $DOMAIN -d www.$DOMAIN"
echo "    4. DNS records:"
echo "       - A record: $DOMAIN → this server's IP"
echo "       - A record: proxy.$DOMAIN → this server's IP (DNS only, no proxy)"
echo "    5. Deploy app: cd $APP_DIR && ./scripts/docker-deploy.sh"
echo ""

# Print generated CRON_SECRET for reference
CRON_SECRET=$(grep "CRON_SECRET=" "$APP_DIR/.env" | cut -d'"' -f2)
echo "  Generated CRON_SECRET: $CRON_SECRET"
echo ""
echo "=============================================="
echo ""
