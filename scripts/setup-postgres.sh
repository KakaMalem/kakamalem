#!/bin/bash

# =============================================================================
# PostgreSQL 18 + PgBouncer Setup Script for Kaka Malem
# =============================================================================
# Run this on your VPS to set up the database infrastructure
# Optimized for: 2 dedicated + 2 shared cores, 16GB RAM, 75GB NVMe
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# CONFIGURATION
# =============================================================================
PG_VERSION="18"
APP_USER="kakamalem_app"
MIGRATIONS_USER="kakamalem_migrations"
READONLY_USER="kakamalem_readonly"
DB_NAME="kakamalem"
PGBOUNCER_PORT="6543"
POSTGRES_PORT="5432"

# Generate random passwords (replace these in production!)
APP_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
MIGRATIONS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
READONLY_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
PGBOUNCER_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
REPLICATION_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================
log_info "Running pre-flight checks..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

# Check Ubuntu version
if ! grep -q "Ubuntu" /etc/os-release; then
    log_warn "This script is optimized for Ubuntu. Proceed with caution on other distros."
fi

# =============================================================================
# INSTALL POSTGRESQL 18
# =============================================================================
log_info "Installing PostgreSQL $PG_VERSION..."

# Add PostgreSQL APT repository
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
    apt-get update
    apt-get install -y curl ca-certificates gnupg
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
fi

apt-get update
apt-get install -y postgresql-$PG_VERSION postgresql-contrib-$PG_VERSION

# =============================================================================
# INSTALL PGBOUNCER
# =============================================================================
log_info "Installing PgBouncer..."
apt-get install -y pgbouncer

# =============================================================================
# CONFIGURE HUGE PAGES (Optional but recommended)
# =============================================================================
log_info "Configuring huge pages..."

# Calculate huge pages needed (shared_buffers / 2MB per huge page)
# 4GB shared_buffers = ~2048 huge pages, add some buffer
HUGE_PAGES=2200

# Set huge pages
echo "vm.nr_hugepages = $HUGE_PAGES" >> /etc/sysctl.conf
sysctl -w vm.nr_hugepages=$HUGE_PAGES

# =============================================================================
# CONFIGURE POSTGRESQL
# =============================================================================
log_info "Configuring PostgreSQL..."

PG_DATA="/var/lib/postgresql/$PG_VERSION/main"
PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"

# Stop PostgreSQL for configuration
systemctl stop postgresql

# Backup original configs
cp "$PG_CONF_DIR/postgresql.conf" "$PG_CONF_DIR/postgresql.conf.bak"
cp "$PG_CONF_DIR/pg_hba.conf" "$PG_CONF_DIR/pg_hba.conf.bak"

# Copy our optimized config
# NOTE: In production, copy from your repo's database/ folder
cat > "$PG_CONF_DIR/postgresql.conf" << 'EOF'
# Include the optimized config from your repo
# This is a minimal config - replace with database/postgresql.conf

listen_addresses = '127.0.0.1'
port = 5432
max_connections = 100
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 128MB
maintenance_work_mem = 1GB
huge_pages = try
wal_buffers = 64MB
checkpoint_completion_target = 0.9
wal_compression = zstd
max_wal_size = 4GB
min_wal_size = 1GB
effective_io_concurrency = 200
random_page_cost = 1.1
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
jit = on
autovacuum = on
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_min_duration_statement = 1000
password_encryption = scram-sha-256
ssl = off
timezone = 'UTC'
shared_preload_libraries = 'pg_stat_statements'
EOF

# Configure pg_hba.conf
cat > "$PG_CONF_DIR/pg_hba.conf" << EOF
# PostgreSQL Client Authentication Configuration
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    $DB_NAME        $APP_USER       127.0.0.1/32            scram-sha-256
host    $DB_NAME        $MIGRATIONS_USER 127.0.0.1/32           scram-sha-256
host    $DB_NAME        $READONLY_USER  127.0.0.1/32            scram-sha-256
host    all             pgbouncer       127.0.0.1/32            scram-sha-256
host    replication     replication     127.0.0.1/32            scram-sha-256
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
EOF

# Set correct ownership
chown postgres:postgres "$PG_CONF_DIR/postgresql.conf"
chown postgres:postgres "$PG_CONF_DIR/pg_hba.conf"

# =============================================================================
# START POSTGRESQL AND CREATE DATABASE
# =============================================================================
log_info "Starting PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to be ready
sleep 5

# Create database and users
log_info "Creating database and users..."

sudo -u postgres psql << EOF
-- Create database
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME WITH ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8' TEMPLATE = template0;

-- Create users
DROP ROLE IF EXISTS $APP_USER;
DROP ROLE IF EXISTS $MIGRATIONS_USER;
DROP ROLE IF EXISTS $READONLY_USER;
DROP ROLE IF EXISTS pgbouncer;
DROP ROLE IF EXISTS replication;

CREATE ROLE $APP_USER WITH LOGIN PASSWORD '$APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 50;
CREATE ROLE $MIGRATIONS_USER WITH LOGIN PASSWORD '$MIGRATIONS_PASSWORD' NOSUPERUSER CREATEDB NOCREATEROLE CONNECTION LIMIT 5;
CREATE ROLE $READONLY_USER WITH LOGIN PASSWORD '$READONLY_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10;
CREATE ROLE pgbouncer WITH LOGIN PASSWORD '$PGBOUNCER_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 2;
CREATE ROLE replication WITH LOGIN PASSWORD '$REPLICATION_PASSWORD' REPLICATION CONNECTION LIMIT 5;

-- Grant connect
GRANT CONNECT ON DATABASE $DB_NAME TO $APP_USER;
GRANT CONNECT ON DATABASE $DB_NAME TO $MIGRATIONS_USER;
GRANT CONNECT ON DATABASE $DB_NAME TO $READONLY_USER;
GRANT CONNECT ON DATABASE $DB_NAME TO pgbouncer;

-- Connect to app database
\c $DB_NAME

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO $APP_USER;
GRANT ALL ON SCHEMA public TO $MIGRATIONS_USER;
GRANT USAGE ON SCHEMA public TO $READONLY_USER;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $MIGRATIONS_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $READONLY_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $MIGRATIONS_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO $READONLY_USER;

-- PgBouncer auth function
CREATE SCHEMA IF NOT EXISTS pgbouncer;
GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer;

CREATE OR REPLACE FUNCTION pgbouncer.user_lookup(in_username TEXT)
RETURNS TABLE(username TEXT, password TEXT) AS
\$\$
BEGIN
    RETURN QUERY
    SELECT rolname::TEXT, rolpassword::TEXT
    FROM pg_authid
    WHERE rolname = in_username
    AND rolcanlogin = true;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION pgbouncer.user_lookup(TEXT) TO pgbouncer;

-- Utility functions
CREATE OR REPLACE FUNCTION generate_short_id(prefix TEXT DEFAULT '', length INT DEFAULT 8)
RETURNS TEXT AS \$\$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := prefix;
    i INT;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN result;
END;
\$\$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS \$\$
BEGIN
    RETURN 'KM-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
\$\$ LANGUAGE plpgsql;
EOF

# =============================================================================
# CONFIGURE PGBOUNCER
# =============================================================================
log_info "Configuring PgBouncer..."

# Create PgBouncer directory
mkdir -p /etc/pgbouncer
mkdir -p /var/log/pgbouncer
mkdir -p /var/run/pgbouncer

# Create PgBouncer userlist
cat > /etc/pgbouncer/userlist.txt << EOF
"$APP_USER" "$(sudo -u postgres psql -t -c "SELECT rolpassword FROM pg_authid WHERE rolname='$APP_USER'")"
"$MIGRATIONS_USER" "$(sudo -u postgres psql -t -c "SELECT rolpassword FROM pg_authid WHERE rolname='$MIGRATIONS_USER'")"
"$READONLY_USER" "$(sudo -u postgres psql -t -c "SELECT rolpassword FROM pg_authid WHERE rolname='$READONLY_USER'")"
"pgbouncer" "$(sudo -u postgres psql -t -c "SELECT rolpassword FROM pg_authid WHERE rolname='pgbouncer'")"
EOF

# Create PgBouncer config
cat > /etc/pgbouncer/pgbouncer.ini << EOF
[databases]
$DB_NAME = host=127.0.0.1 port=$POSTGRES_PORT dbname=$DB_NAME

[pgbouncer]
listen_addr = *
listen_port = $PGBOUNCER_PORT
unix_socket_dir = /var/run/pgbouncer
auth_file = /etc/pgbouncer/userlist.txt
auth_type = scram-sha-256
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 10
max_db_connections = 50
server_idle_timeout = 300
client_idle_timeout = 0
query_timeout = 300
logfile = /var/log/pgbouncer/pgbouncer.log
log_connections = 1
log_disconnections = 1
stats_period = 60
admin_users = pgbouncer
ignore_startup_parameters = extra_float_digits, search_path
EOF

# Set permissions
chown -R postgres:postgres /etc/pgbouncer
chown -R postgres:postgres /var/log/pgbouncer
chown -R postgres:postgres /var/run/pgbouncer
chmod 600 /etc/pgbouncer/userlist.txt

# Create systemd service override for PgBouncer
mkdir -p /etc/systemd/system/pgbouncer.service.d
cat > /etc/systemd/system/pgbouncer.service.d/override.conf << EOF
[Service]
User=postgres
Group=postgres
EOF

# Reload systemd and start PgBouncer
systemctl daemon-reload
systemctl restart pgbouncer
systemctl enable pgbouncer

# =============================================================================
# CONFIGURE FIREWALL
# =============================================================================
log_info "Configuring firewall..."

# Allow PgBouncer port (if using UFW)
if command -v ufw &> /dev/null; then
    ufw allow $PGBOUNCER_PORT/tcp comment 'PgBouncer'
    log_info "UFW rule added for port $PGBOUNCER_PORT"
fi

# =============================================================================
# OUTPUT CONNECTION STRINGS
# =============================================================================
log_info "Setup complete!"
echo ""
echo "=============================================="
echo "DATABASE CREDENTIALS"
echo "=============================================="
echo ""
echo "Add these to your .env file:"
echo ""
echo "# Application connection (via PgBouncer)"
echo "DATABASE_URL=\"postgresql://$APP_USER:$APP_PASSWORD@localhost:$PGBOUNCER_PORT/$DB_NAME\""
echo ""
echo "# Migration connection (direct to PostgreSQL)"
echo "DATABASE_URL_UNPOOLED=\"postgresql://$MIGRATIONS_USER:$MIGRATIONS_PASSWORD@localhost:$POSTGRES_PORT/$DB_NAME\""
echo ""
echo "# Read-only connection"
echo "DATABASE_READONLY_URL=\"postgresql://$READONLY_USER:$READONLY_PASSWORD@localhost:$PGBOUNCER_PORT/$DB_NAME\""
echo ""
echo "=============================================="
echo "PASSWORDS (SAVE THESE SECURELY!)"
echo "=============================================="
echo "App User: $APP_PASSWORD"
echo "Migrations User: $MIGRATIONS_PASSWORD"
echo "Readonly User: $READONLY_PASSWORD"
echo "PgBouncer User: $PGBOUNCER_PASSWORD"
echo "Replication User: $REPLICATION_PASSWORD"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Save the credentials above in a secure location"
echo "2. Update your .env file with the DATABASE_URL values"
echo "3. Run Drizzle migrations: pnpm db:migrate"
echo "4. Deploy your application"
echo ""
