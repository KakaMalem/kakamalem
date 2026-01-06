# Quick Start: Automated Deployment

## Step 1: Generate SSH Key

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions
ssh-copy-id -i ~/.ssh/github-actions.pub your-user@your-vps-ip
```

## Step 2: Add GitHub Secrets

Go to: **Repository Settings → Secrets and variables → Actions**

Add these secrets:

- `VPS_HOST`: Your VPS IP or domain
- `VPS_USERNAME`: SSH username (e.g., `root`)
- `VPS_SSH_KEY`: Content of `~/.ssh/github-actions` (entire private key)
- `VPS_PORT`: SSH port (default: 22)

## Step 3: Setup VPS (One-Time)

```bash
# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
npm install -g pnpm pm2

# Clone and setup
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/kakamalem.git
sudo chown -R $USER:$USER /var/www/kakamalem
cd kakamalem

# Configure
pnpm install
nano .env  # Add production environment variables (see note below)
pnpm db:migrate
pnpm build

# IMPORTANT .env Configuration
# Use SESSION POOLER (port 5432), NOT transaction pooler (port 6543)
# DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
# DATABASE_URL_UNPOOLED=postgresql://...pooler.supabase.com:5432/postgres

# Start with PM2
pm2 start pnpm --name "kakamalem" -- start
pm2 save
pm2 startup
```

## Step 4: Deploy

Just push to `main`:

```bash
git push origin main
```

GitHub Actions will automatically deploy!

## Monitor

```bash
# View logs
pm2 logs kakamalem

# View status
pm2 status

# Restart manually if needed
pm2 restart kakamalem
```

## Manual Deployment

On VPS:

```bash
cd /var/www/kakamalem
bash scripts/deploy.sh
```

For detailed instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md)
