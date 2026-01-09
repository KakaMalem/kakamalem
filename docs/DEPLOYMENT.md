# Deployment Guide

Complete guide for deploying Kaka Malem to a VPS with Docker + native PostgreSQL.

## Architecture

```
                        INTERNET
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│                 NGINX (Native)                    │
│                 Port 80/443                       │
│                 SSL via Certbot                   │
└──────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│              DOCKER CONTAINER                     │
│  ┌────────────────────────────────────────────┐  │
│  │         Next.js App (Port 3000)            │  │
│  │         Node.js 22 Alpine                  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│               PGBOUNCER (Native)                  │
│               Port 6543                           │
│               Connection Pooling                  │
└──────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│              POSTGRESQL 18 (Native)               │
│              Port 5432 (localhost only)           │
└──────────────────────────────────────────────────┘
```

**Why hybrid?**

- **Docker for app**: Easy rollbacks, reproducible builds, no Node.js version conflicts
- **Native PostgreSQL**: Better performance, direct filesystem access, tuned configs
- **Native Nginx**: SSL termination, static file caching, no container overhead

## Quick Deploy

Already set up? Just push to `main`:

```bash
git push origin main
```

GitHub Actions builds the Docker image and deploys automatically.

Manual deploy on VPS:

```bash
cd /var/www/kakamalem
./scripts/docker-deploy.sh
```

---

## Fresh Server Setup

### Prerequisites

- Ubuntu 22.04+ or Debian 12+
- At least 2GB RAM (4GB recommended)
- Root or sudo access
- Domain pointing to server IP

### Step 1: Install Base Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Log out and back in for docker group
```

### Step 2: Install PostgreSQL 18

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null

# Install
sudo apt update
sudo apt install -y postgresql-18 postgresql-contrib-18 pgbouncer

# Verify
psql --version  # Should show 18.x
```

### Step 3: Configure PostgreSQL

```bash
# Create database and users
sudo -u postgres psql << 'EOF'
-- Create database
CREATE DATABASE kakamalem;

-- App user (limited permissions for runtime)
CREATE USER kakamalem_app WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';

-- Migration user (full DDL for schema changes)
CREATE USER kakamalem_migrations WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';

-- Grant permissions
\c kakamalem

-- App user: CRUD only
GRANT CONNECT ON DATABASE kakamalem TO kakamalem_app;
GRANT USAGE ON SCHEMA public TO kakamalem_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kakamalem_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kakamalem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kakamalem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kakamalem_app;

-- Migration user: Full DDL
GRANT ALL PRIVILEGES ON DATABASE kakamalem TO kakamalem_migrations;
GRANT ALL PRIVILEGES ON SCHEMA public TO kakamalem_migrations;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOF
```

### Step 4: Configure PgBouncer

```bash
# Create userlist (get password hashes from PostgreSQL)
sudo -u postgres psql -t -c "SELECT '\"' || usename || '\" \"' || passwd || '\"' FROM pg_shadow WHERE usename IN ('kakamalem_app', 'kakamalem_migrations')" | sudo tee /etc/pgbouncer/userlist.txt

# Set permissions
sudo chown postgres:postgres /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt
```

Edit `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
kakamalem = host=127.0.0.1 port=5432 dbname=kakamalem

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6543
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
admin_users = postgres
```

```bash
# Restart PgBouncer
sudo systemctl restart pgbouncer
sudo systemctl enable pgbouncer
```

### Step 5: Set Up Application

```bash
# Create directories
sudo mkdir -p /var/www/kakamalem
sudo mkdir -p /var/www/kakamalem-uploads
sudo mkdir -p /var/backups/postgresql
sudo chown -R $USER:$USER /var/www/kakamalem
sudo chown -R 1001:1001 /var/www/kakamalem-uploads  # Node.js user in container

# Clone repository
cd /var/www
git clone https://github.com/KakaMalem/kakamalem.git
cd kakamalem

# Create .env file
cat > .env << 'EOF'
# Database (via PgBouncer for app, direct for migrations)
DATABASE_URL=postgresql://kakamalem_app:YOUR_PASSWORD@127.0.0.1:6543/kakamalem
DATABASE_URL_UNPOOLED=postgresql://kakamalem_migrations:YOUR_PASSWORD@127.0.0.1:5432/kakamalem

# Auth
BETTER_AUTH_SECRET=your-32-character-secret-here
NEXT_PUBLIC_APP_URL=https://kakamalem.com

# Storage
STORAGE_PATH=/app/uploads
EOF

# Run migrations (uses unpooled connection)
docker run --rm --network host \
  -v $(pwd):/app -w /app \
  -e DATABASE_URL_UNPOOLED="postgresql://kakamalem_migrations:PASSWORD@127.0.0.1:5432/kakamalem" \
  node:22-alpine sh -c "npm install -g pnpm && pnpm install && pnpm db:migrate"
```

### Step 6: Configure Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/kakamalem
sudo ln -sf /etc/nginx/sites-available/kakamalem /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d kakamalem.com -d www.kakamalem.com
```

### Step 7: Start the Application

```bash
# Pull and start
docker compose pull
docker compose up -d

# Check logs
docker compose logs -f app
```

### Step 8: Set Up GitHub Actions

Add these secrets in GitHub (Settings > Secrets > Actions):

| Secret         | Value                              |
| -------------- | ---------------------------------- |
| `VPS_HOST`     | Your server IP or domain           |
| `VPS_USERNAME` | SSH username (e.g., `root`)        |
| `VPS_SSH_KEY`  | Private SSH key content            |
| `VPS_PORT`     | SSH port (default: 22)             |
| `GHCR_TOKEN`   | GitHub token with `packages:write` |

Generate SSH key:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions
ssh-copy-id -i ~/.ssh/github-actions.pub user@your-vps-ip
cat ~/.ssh/github-actions  # Copy this to VPS_SSH_KEY secret
```

---

## Daily Operations

### Deploy Latest Version

```bash
cd /var/www/kakamalem
./scripts/docker-deploy.sh
```

### Rollback

```bash
./scripts/docker-deploy.sh --rollback
```

### View Logs

```bash
# App logs
docker compose logs -f app

# Nginx logs
tail -f /var/log/nginx/kakamalem_*.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-18-main.log
```

### Database Backup

```bash
# Manual backup
./scripts/backup-database.sh

# With cleanup (removes backups older than 14 days)
./scripts/backup-database.sh --cleanup
```

Add to crontab for daily backups:

```bash
0 3 * * * /var/www/kakamalem/scripts/backup-database.sh --cleanup
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

---

## Troubleshooting

### App won't start

```bash
# Check container logs
docker compose logs app

# Check if port is in use
sudo lsof -i :3000

# Restart
docker compose restart app
```

### Database connection errors

```bash
# Test direct PostgreSQL connection
psql -h 127.0.0.1 -p 5432 -U kakamalem_app -d kakamalem

# Test PgBouncer connection
psql -h 127.0.0.1 -p 6543 -U kakamalem_app -d kakamalem

# Check PgBouncer status
sudo -u postgres psql -p 6543 pgbouncer -c "SHOW POOLS"
```

### SSL certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Renew
sudo certbot renew --dry-run
sudo certbot renew
```

### Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -af

# Clean old backups
find /var/backups/postgresql -name "*.dump" -mtime +14 -delete
```

---

## Environment Variables

| Variable                | Description                        | Example                                                 |
| ----------------------- | ---------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`          | Pooled connection (via PgBouncer)  | `postgresql://app:pass@127.0.0.1:6543/kakamalem`        |
| `DATABASE_URL_UNPOOLED` | Direct connection (for migrations) | `postgresql://migrations:pass@127.0.0.1:5432/kakamalem` |
| `BETTER_AUTH_SECRET`    | Auth secret (32+ chars)            | `openssl rand -base64 32`                               |
| `NEXT_PUBLIC_APP_URL`   | Public URL                         | `https://kakamalem.com`                                 |
| `STORAGE_PATH`          | Upload storage path                | `/app/uploads`                                          |

---

## File Structure

```
/var/www/kakamalem/           # Application code
/var/www/kakamalem-uploads/   # User uploads (bind-mounted to container)
/var/backups/postgresql/      # Database backups
/etc/nginx/sites-available/   # Nginx config
/etc/pgbouncer/               # PgBouncer config
/etc/postgresql/18/main/      # PostgreSQL config
```
