#!/bin/bash

# =============================================================================
# Kaka Malem - Server Setup Script
# =============================================================================
# This script sets up a fresh Ubuntu 22.04/24.04 server with:
# - Docker (for the Next.js app)
# - PostgreSQL 18 (native, for performance)
# - PgBouncer (native, connection pooling)
# - Nginx (native, reverse proxy + SSL)
# - Certbot (Let's Encrypt SSL)
# - UFW (firewall)
#
# Usage:
#   chmod +x install.sh
#   sudo ./install.sh
#
# After running, you'll need to:
# 1. Create database users (see end of script output)
# 2. Configure .env file
# 3. Deploy with docker-compose
# =============================================================================

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"; exit 1; }

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
DOMAIN="kakamalem.com"
APP_DIR="/var/www/kakamalem"
UPLOADS_DIR="/var/www/kakamalem-uploads"
TEMP_UPLOADS_DIR="/tmp/kakamalem-uploads"
DB_NAME="kakamalem"
DB_APP_USER="kakamalem_app"
DB_MIGRATION_USER="kakamalem_migrations"
PG_VERSION="18"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo ./install.sh)"
fi

log "Starting Kaka Malem server setup..."

# -----------------------------------------------------------------------------
# 1. System Update
# -----------------------------------------------------------------------------
log "Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release

# -----------------------------------------------------------------------------
# 2. Docker Installation
# -----------------------------------------------------------------------------
log "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    log "Docker installed successfully"
else
    log "Docker already installed"
fi

# -----------------------------------------------------------------------------
# 3. PostgreSQL 18 Installation
# -----------------------------------------------------------------------------
log "Installing PostgreSQL $PG_VERSION..."
if ! command -v psql &> /dev/null; then
    # Add PostgreSQL APT repository
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null

    # Install PostgreSQL
    apt update
    apt install -y postgresql-$PG_VERSION postgresql-contrib-$PG_VERSION

    log "PostgreSQL $PG_VERSION installed successfully"
else
    log "PostgreSQL already installed"
fi

# Enable and start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# -----------------------------------------------------------------------------
# 4. PgBouncer Installation
# -----------------------------------------------------------------------------
log "Installing PgBouncer..."
apt install -y pgbouncer

# Create PgBouncer directories
mkdir -p /var/run/pgbouncer
mkdir -p /var/log/pgbouncer
chown postgres:postgres /var/run/pgbouncer
chown postgres:postgres /var/log/pgbouncer

log "PgBouncer installed successfully"

# -----------------------------------------------------------------------------
# 5. Nginx Installation
# -----------------------------------------------------------------------------
log "Installing Nginx..."
apt install -y nginx

systemctl enable nginx
systemctl start nginx

log "Nginx installed successfully"

# -----------------------------------------------------------------------------
# 6. Certbot (Let's Encrypt) Installation
# -----------------------------------------------------------------------------
log "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

log "Certbot installed successfully"

# -----------------------------------------------------------------------------
# 7. UFW Firewall Configuration
# -----------------------------------------------------------------------------
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow PostgreSQL from localhost only (already restricted by pg_hba.conf)
# ufw allow from 127.0.0.1 to any port 5432 comment 'PostgreSQL'

# Enable firewall
ufw --force enable

log "Firewall configured successfully"

# -----------------------------------------------------------------------------
# 8. Create Application Directories
# -----------------------------------------------------------------------------
log "Creating application directories..."
mkdir -p $APP_DIR
mkdir -p $UPLOADS_DIR
mkdir -p $TEMP_UPLOADS_DIR
mkdir -p $APP_DIR/.backups
mkdir -p $APP_DIR/.logs

# Set permissions (Docker runs as uid 1001)
chown -R 1001:1001 $UPLOADS_DIR
chown -R 1001:1001 $TEMP_UPLOADS_DIR
chmod 755 $UPLOADS_DIR
chmod 755 $TEMP_UPLOADS_DIR

log "Directories created successfully"

# -----------------------------------------------------------------------------
# 9. Create Database Backup Directory
# -----------------------------------------------------------------------------
mkdir -p /var/backups/postgresql
chown postgres:postgres /var/backups/postgresql

# -----------------------------------------------------------------------------
# 10. Setup Log Rotation
# -----------------------------------------------------------------------------
log "Configuring log rotation..."
cat > /etc/logrotate.d/kakamalem << 'EOF'
/var/log/nginx/kakamalem_*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/var/log/pgbouncer/pgbouncer.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 postgres postgres
}
EOF

log "Log rotation configured"

# -----------------------------------------------------------------------------
# 11. Install fail2ban for SSH protection
# -----------------------------------------------------------------------------
log "Installing fail2ban..."
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

log "fail2ban configured"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "============================================================================="
echo -e "${GREEN}Server setup complete!${NC}"
echo "============================================================================="
echo ""
echo "Installed components:"
echo "  - Docker:      $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  - PostgreSQL:  $PG_VERSION"
echo "  - PgBouncer:   $(pgbouncer --version 2>&1 | head -1)"
echo "  - Nginx:       $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "  - Certbot:     $(certbot --version 2>&1 | cut -d' ' -f2)"
echo ""
echo "============================================================================="
echo -e "${YELLOW}Next steps:${NC}"
echo "============================================================================="
echo ""
echo "1. Create database and users:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE $DB_NAME;"
echo "   CREATE USER $DB_APP_USER WITH PASSWORD 'your_secure_password';"
echo "   CREATE USER $DB_MIGRATION_USER WITH PASSWORD 'your_secure_password';"
echo "   GRANT CONNECT ON DATABASE $DB_NAME TO $DB_APP_USER;"
echo "   GRANT CONNECT ON DATABASE $DB_NAME TO $DB_MIGRATION_USER;"
echo "   \\c $DB_NAME"
echo "   GRANT USAGE ON SCHEMA public TO $DB_APP_USER;"
echo "   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $DB_APP_USER;"
echo "   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_APP_USER;"
echo "   GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_MIGRATION_USER;"
echo "   \\q"
echo ""
echo "2. Copy configuration files:"
echo "   cp database/postgresql.conf /etc/postgresql/$PG_VERSION/main/postgresql.conf"
echo "   cp database/pg_hba.conf /etc/postgresql/$PG_VERSION/main/pg_hba.conf"
echo "   cp database/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini"
echo "   cp nginx.conf /etc/nginx/sites-available/kakamalem"
echo "   ln -s /etc/nginx/sites-available/kakamalem /etc/nginx/sites-enabled/"
echo "   rm /etc/nginx/sites-enabled/default"
echo ""
echo "3. Create PgBouncer userlist:"
echo "   echo '\"$DB_APP_USER\" \"md5\$(echo -n \"password$DB_APP_USER\" | md5sum | cut -d\" \" -f1)\"' >> /etc/pgbouncer/userlist.txt"
echo ""
echo "4. Restart services:"
echo "   systemctl restart postgresql"
echo "   systemctl restart pgbouncer"
echo "   systemctl restart nginx"
echo ""
echo "5. Get SSL certificate:"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "6. Create .env file in $APP_DIR and deploy:"
echo "   cd $APP_DIR"
echo "   docker compose pull"
echo "   docker compose up -d"
echo ""
echo "============================================================================="
