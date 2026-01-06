# Deployment Guide

This document explains how to set up automated deployment for Kaka Malem using GitHub Actions.

## Overview

After pushing to the `main` branch, GitHub Actions automatically:

1. Connects to your VPS via SSH
2. Pulls the latest code
3. Installs dependencies
4. Runs database migrations
5. Builds the application
6. Restarts the application with PM2
7. Creates automatic backups and rollbacks on failure

## One-Time Setup

### 1. VPS Prerequisites

Ensure your VPS has the following installed:

```bash
# Node.js (v20 or higher)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# PM2 (Process Manager)
npm install -g pm2

# Git
sudo apt-get install git
```

### 2. Application Setup on VPS

```bash
# Clone the repository
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/KakaMalem/kakamalem.git
sudo chown -R $USER:$USER /var/www/kakamalem
cd kakamalem

# Install dependencies
pnpm install

# Create .env file with production credentials
nano .env

# Add:
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Run initial migration
pnpm db:migrate

# Build the application
pnpm build

# Start with PM2
pm2 start pnpm --name "kakamalem" -- start

# Save PM2 configuration to restart on reboot
pm2 save
pm2 startup
```

### 3. GitHub Secrets Configuration

Add the following secrets to your GitHub repository:

**Go to**: Repository Settings → Secrets and variables → Actions → New repository secret

| Secret Name    | Description                         | Example                           |
| -------------- | ----------------------------------- | --------------------------------- |
| `VPS_HOST`     | Your VPS IP address or domain       | `123.45.67.89` or `kakamalem.com` |
| `VPS_USERNAME` | SSH username                        | `ubuntu` or `root`                |
| `VPS_SSH_KEY`  | Private SSH key for authentication  | See below                         |
| `VPS_PORT`     | SSH port (optional, defaults to 22) | `22`                              |

#### Generating SSH Key

On your **local machine**:

```bash
# Generate new SSH key pair
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions

# Copy the public key to your VPS
ssh-copy-id -i ~/.ssh/github-actions.pub your-user@your-vps-ip

# Display private key (copy this to GitHub secret VPS_SSH_KEY)
cat ~/.ssh/github-actions
```

Copy the **entire private key** output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and paste it into the `VPS_SSH_KEY` secret in GitHub.

#### Test SSH Connection

```bash
ssh -i ~/.ssh/github-actions your-user@your-vps-ip
```

If successful, GitHub Actions will be able to connect.

### 4. Configure Git on VPS

```bash
# On your VPS
cd /var/www/kakamalem

# Set up Git credentials (if using private repo)
git config --global credential.helper store

# Or use SSH (recommended)
# Add deploy key to GitHub: Settings → Deploy keys
ssh-keygen -t ed25519 -C "vps-deploy"
cat ~/.ssh/id_ed25519.pub  # Add this to GitHub Deploy Keys

# Test connection
ssh -T git@github.com
```

## Workflows

### 1. Deploy Workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))

**Triggers**: Push to `main` branch or manual trigger

**Actions**:

- Connects to VPS via SSH
- Executes [scripts/deploy.sh](scripts/deploy.sh)
- Handles deployment with automatic rollback on failure

### 2. CI Workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml))

**Triggers**: Push or PR to `main`/`develop` branches

**Actions**:

- Lints code with ESLint
- Runs TypeScript type checking
- Verifies build succeeds

## Deployment Process

### Automatic Deployment

Simply push to `main`:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions will automatically deploy to your VPS.

### Manual Deployment

Trigger manually from GitHub:

1. Go to Actions tab
2. Select "Deploy to VPS" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

### Deployment Script Features

The [scripts/deploy.sh](scripts/deploy.sh) script includes:

**Safety Features**:

- Creates backup before deployment
- Automatic rollback on any failure
- Verifies application health after restart
- Keeps last 5 backups automatically

**Deployment Steps**:

1. Creates backup of current build and commit
2. Pulls latest code from Git
3. Skips deployment if no changes detected
4. Installs dependencies with frozen lockfile
5. Runs database migrations
6. Builds application
7. Restarts PM2 with updated environment
8. Waits and verifies application is online
9. Cleans up old backups

**Rollback Process**:
If any step fails:

1. Restores previous build from backup
2. Resets Git to previous commit
3. Restarts application
4. Exits with error status

## Monitoring

### View Deployment Status

**GitHub**: Actions tab → Latest workflow run

**VPS Logs**:

```bash
# PM2 logs
pm2 logs kakamalem

# PM2 status
pm2 status

# View specific number of lines
pm2 logs kakamalem --lines 100

# Follow logs in real-time
pm2 logs kakamalem -f
```

### Deployment History

GitHub Actions keeps logs of all deployments:

- Go to Actions tab
- Click on any workflow run to see detailed logs

## Troubleshooting

### Deployment Fails with SSH Connection Error

**Problem**: Cannot connect to VPS

**Solution**:

1. Verify `VPS_HOST` and `VPS_USERNAME` secrets are correct
2. Test SSH connection locally: `ssh -i ~/.ssh/github-actions user@host`
3. Ensure SSH key doesn't have passphrase
4. Check VPS firewall allows connections from GitHub IPs

### Build Fails on VPS

**Problem**: `pnpm build` fails

**Solution**:

1. Check `.env` file exists on VPS with correct values
2. Verify Node.js version: `node -v` (should be v20+)
3. Check disk space: `df -h`
4. View detailed logs in GitHub Actions workflow

### Migration Fails

**Problem**: `pnpm db:migrate` fails

**Solution**:

1. Verify `DATABASE_URL_UNPOOLED` in VPS `.env`
2. Check database connectivity: `psql $DATABASE_URL_UNPOOLED`
3. Review migration files for errors
4. Check database permissions

### PM2 Restart Fails

**Problem**: Application doesn't restart

**Solution**:

```bash
# On VPS
pm2 delete kakamalem
pm2 start pnpm --name "kakamalem" -- start
pm2 save
```

### Rollback Manually

If automatic rollback didn't work:

```bash
# On VPS
cd /var/www/kakamalem

# List backups
ls -la .backups/

# Restore from backup
BACKUP_DATE="20260106_143022"  # Use actual backup timestamp
rm -rf .next
cp -r .backups/backup_$BACKUP_DATE/.next .

# Reset git to backup commit
git reset --hard $(cat .backups/backup_$BACKUP_DATE/commit.txt)

# Restart
pm2 restart kakamalem
```

## Security Best Practices

1. **SSH Keys**: Never commit SSH keys to repository
2. **Environment Variables**: Keep `.env` only on VPS, never commit
3. **GitHub Secrets**: Use secrets for all sensitive data
4. **Firewall**: Configure VPS firewall to only allow necessary ports
5. **SSH Port**: Consider changing default SSH port (22) to custom port
6. **Fail2ban**: Install fail2ban to prevent brute force attacks
7. **Updates**: Keep VPS system and packages updated

```bash
# Install fail2ban
sudo apt-get install fail2ban

# Configure firewall (UFW)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Performance Optimization

### Enable PM2 Clustering

For better performance under load:

```bash
# Stop current instance
pm2 delete kakamalem

# Start with cluster mode (uses all CPU cores)
pm2 start pnpm --name "kakamalem" -i max -- start

# Save configuration
pm2 save
```

### Enable Caching

Add build cache to speed up deployments:

```bash
# On VPS, create cache directory
mkdir -p /var/www/kakamalem/.next/cache
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)

## Support

If you encounter issues:

1. Check GitHub Actions logs
2. Check PM2 logs on VPS: `pm2 logs kakamalem`
3. Review deployment script output
4. Verify all prerequisites are installed
5. Test deployment script manually: `cd /var/www/kakamalem && bash scripts/deploy.sh`
