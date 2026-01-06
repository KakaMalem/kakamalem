# Pre-Deployment Checklist

Use this checklist before setting up automated deployment for the first time.

## VPS Requirements

### System Requirements

- [ ] Ubuntu 20.04+ or Debian 11+ (recommended)
- [ ] At least 2GB RAM (4GB+ recommended)
- [ ] At least 20GB disk space
- [ ] Root or sudo access
- [ ] SSH access enabled (port 22 or custom)

### Software Installation

- [ ] **Node.js v20+** installed

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node -v  # Should show v20.x or higher
  ```

- [ ] **pnpm** installed globally

  ```bash
  npm install -g pnpm
  pnpm -v  # Should show version number
  ```

- [ ] **PM2** installed globally

  ```bash
  npm install -g pm2
  pm2 -v  # Should show version number
  ```

- [ ] **Git** installed

  ```bash
  sudo apt-get install git
  git --version
  ```

- [ ] **PostgreSQL client** (optional, for database checks)

  ```bash
  sudo apt-get install postgresql-client
  psql --version
  ```

- [ ] **curl** installed (for health checks)
  ```bash
  sudo apt-get install curl
  curl --version
  ```

## VPS Configuration

### Directory Setup

- [ ] Application directory created at `/var/www/kakamalem`

  ```bash
  sudo mkdir -p /var/www/kakamalem
  sudo chown -R $USER:$USER /var/www/kakamalem
  ```

- [ ] Repository cloned
  ```bash
  cd /var/www
  git clone https://github.com/KakaMalem/kakamalem.git
  ```

### Environment Configuration

- [ ] `.env` file created in `/var/www/kakamalem`
- [ ] `DATABASE_URL` set (pooled connection for app)
- [ ] `DATABASE_URL_UNPOOLED` set (for migrations)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] All other required environment variables set

### Initial Build

- [ ] Dependencies installed

  ```bash
  cd /var/www/kakamalem
  pnpm install
  ```

- [ ] Database migrations run

  ```bash
  pnpm db:migrate
  ```

- [ ] Application built successfully

  ```bash
  pnpm build
  ```

- [ ] Application started with PM2

  ```bash
  pm2 start pnpm --name "kakamalem" -- start
  pm2 save
  pm2 startup  # Follow the command it outputs
  ```

- [ ] Application is accessible at `http://localhost:3000`

### Firewall Configuration

- [ ] Firewall configured (UFW recommended)

  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  ```

- [ ] Fail2ban installed (optional but recommended)
  ```bash
  sudo apt-get install fail2ban
  sudo systemctl enable fail2ban
  sudo systemctl start fail2ban
  ```

## GitHub Configuration

### Repository Access

- [ ] Repository is accessible (public or deploy key added)
- [ ] If private repo, deploy key configured:

  ```bash
  # On VPS
  ssh-keygen -t ed25519 -C "vps-deploy"
  cat ~/.ssh/id_ed25519.pub
  # Add this to GitHub: Settings → Deploy keys → Add deploy key
  ```

- [ ] SSH connection to GitHub works
  ```bash
  ssh -T git@github.com
  # Should show: "Hi KakaMalem/kakamalem! You've successfully authenticated..."
  ```

### SSH Key for GitHub Actions

- [ ] SSH key pair generated for GitHub Actions

  ```bash
  # On local machine
  ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions
  ```

- [ ] Public key added to VPS authorized_keys

  ```bash
  ssh-copy-id -i ~/.ssh/github-actions.pub your-user@your-vps-ip
  ```

- [ ] SSH connection test successful
  ```bash
  ssh -i ~/.ssh/github-actions your-user@your-vps-ip
  ```

### GitHub Secrets

- [ ] `VPS_HOST` secret added (VPS IP or domain)
- [ ] `VPS_USERNAME` secret added (SSH username)
- [ ] `VPS_SSH_KEY` secret added (entire private key)
- [ ] `VPS_PORT` secret added (if not default 22)

To add secrets:

1. Go to repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with exact name and value

## Database

### Supabase Production

- [ ] Supabase project created (if not using existing)
- [ ] Database accessible from VPS
- [ ] Database credentials added to VPS `.env`
- [ ] Connection pooling configured (pooled URL for app)
- [ ] Direct connection available (unpooled URL for migrations)

### Database Test

- [ ] Can connect from VPS

  ```bash
  psql "$DATABASE_URL" -c "SELECT 1"
  ```

- [ ] Tables exist (migrations run successfully)
  ```bash
  psql "$DATABASE_URL" -c "\dt"
  ```

## Security Checklist

- [ ] SSH password authentication disabled (key-only)

  ```bash
  sudo nano /etc/ssh/sshd_config
  # Set: PasswordAuthentication no
  sudo systemctl restart sshd
  ```

- [ ] Root login disabled over SSH

  ```bash
  # In /etc/ssh/sshd_config
  # Set: PermitRootLogin no
  ```

- [ ] Non-root user created with sudo access

  ```bash
  sudo adduser deployuser
  sudo usermod -aG sudo deployuser
  ```

- [ ] Firewall configured and enabled
- [ ] SSL certificate configured (if applicable)
- [ ] Environment variables secured (not in version control)
- [ ] Database uses strong password
- [ ] Supabase RLS policies enabled and tested

## DNS & Domain (If Applicable)

- [ ] Domain pointed to VPS IP
- [ ] A record configured
- [ ] AAAA record configured (if using IPv6)
- [ ] SSL certificate obtained (Let's Encrypt via certbot)
  ```bash
  sudo apt-get install certbot python3-certbot-nginx
  sudo certbot --nginx -d kakamalem.com -d www.kakamalem.com
  ```

## Nginx Configuration (If Using)

- [ ] Nginx installed

  ```bash
  sudo apt-get install nginx
  ```

- [ ] Nginx configured as reverse proxy

  ```nginx
  server {
      listen 80;
      server_name kakamalem.com www.kakamalem.com;

      location / {
          proxy_pass http://localhost:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```

- [ ] Nginx restarted
  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

## Testing

### Manual Tests

- [ ] Application accessible via browser
- [ ] Can create account
- [ ] Can log in
- [ ] Database writes working
- [ ] File uploads working (if applicable)
- [ ] All critical features tested

### Health Check

- [ ] Run health check script

  ```bash
  cd /var/www/kakamalem
  bash scripts/health-check.sh
  ```

- [ ] All checks passing or warnings acceptable

### Deployment Test

- [ ] Manual deployment works

  ```bash
  cd /var/www/kakamalem
  bash scripts/deploy.sh
  ```

- [ ] Application restarts successfully
- [ ] No errors in deployment output

## GitHub Actions Test

### First Deployment

- [ ] Make a small change (e.g., update CLAUDE.md)
- [ ] Commit and push to main branch

  ```bash
  git add .
  git commit -m "Test automated deployment"
  git push origin main
  ```

- [ ] GitHub Actions workflow triggered
- [ ] Check Actions tab in GitHub for progress
- [ ] Deployment completes successfully
- [ ] Application updated on VPS
- [ ] No errors in GitHub Actions logs

### Verify Deployment

- [ ] Application running on VPS

  ```bash
  pm2 status kakamalem
  ```

- [ ] Changes reflected in production
- [ ] No errors in PM2 logs

  ```bash
  pm2 logs kakamalem --lines 50
  ```

- [ ] Health check passing
  ```bash
  bash scripts/health-check.sh
  ```

## Monitoring Setup

- [ ] PM2 logs accessible

  ```bash
  pm2 logs kakamalem
  ```

- [ ] Deployment logs directory exists: `/var/www/kakamalem/.logs`
- [ ] Backup directory exists: `/var/www/kakamalem/.backups`
- [ ] GitHub Actions health check scheduled (every 6 hours)
- [ ] Consider setting up email notifications for failed deployments

## Rollback Plan

- [ ] Know how to trigger manual rollback

  ```bash
  # View available backups
  ls -la /var/www/kakamalem/.backups

  # Restore specific backup
  cd /var/www/kakamalem
  BACKUP_DATE="20260106_143022"
  rm -rf .next
  cp -r .backups/backup_$BACKUP_DATE/.next .
  git reset --hard $(cat .backups/backup_$BACKUP_DATE/commit.txt)
  pm2 restart kakamalem
  ```

- [ ] Automatic rollback tested (cause a failed deployment)

## Documentation

- [ ] Team knows how deployment works
- [ ] Emergency contacts documented
- [ ] VPS access credentials secured (password manager)
- [ ] GitHub secrets documented (who has access)

## Post-Deployment

After first successful automated deployment:

- [ ] Monitor application for 24 hours
- [ ] Check error logs daily for first week
- [ ] Verify backups are being created
- [ ] Verify old backups are being cleaned up
- [ ] Test health check workflow runs successfully
- [ ] Document any issues encountered
- [ ] Update team on deployment process

## Optional Enhancements

- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure email notifications for deployments
- [ ] Set up database backups
- [ ] Configure CDN (Cloudflare, etc.)
- [ ] Set up staging environment
- [ ] Configure branch protection rules
- [ ] Add deployment status badge to README

---

## Quick Validation Command

Run this on your VPS to validate most requirements:

```bash
#!/bin/bash
echo "=== System Check ==="
echo "Node: $(node -v 2>/dev/null || echo 'Not installed')"
echo "pnpm: $(pnpm -v 2>/dev/null || echo 'Not installed')"
echo "PM2: $(pm2 -v 2>/dev/null || echo 'Not installed')"
echo "Git: $(git --version 2>/dev/null || echo 'Not installed')"
echo "PostgreSQL: $(psql --version 2>/dev/null || echo 'Not installed')"
echo ""
echo "=== Directory Check ==="
echo "App dir exists: $([ -d /var/www/kakamalem ] && echo 'Yes' || echo 'No')"
echo ".env exists: $([ -f /var/www/kakamalem/.env ] && echo 'Yes' || echo 'No')"
echo ""
echo "=== PM2 Status ==="
pm2 describe kakamalem 2>/dev/null || echo "Application not running"
```

Save this as `check.sh` and run: `bash check.sh`
