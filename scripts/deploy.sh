#!/bin/bash

# Kaka Malem Deployment Script
# Run this script on your VPS to deploy updates

set -e  # Exit on error

echo "🚀 Starting deployment for Kaka Malem..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/kakamalem"
APP_NAME="kakamalem"

# Check if running from correct directory
if [ "$PWD" != "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠️  Changing to application directory: $APP_DIR${NC}"
    cd "$APP_DIR"
fi

# Step 1: Pull latest changes
echo -e "${GREEN}📥 Pulling latest changes from Git...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull failed. Aborting deployment.${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
pnpm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Dependency installation failed. Aborting deployment.${NC}"
    exit 1
fi

# Step 3: Run database migrations
echo -e "${GREEN}🗄️  Running database migrations...${NC}"
pnpm db:migrate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database migration failed. Aborting deployment.${NC}"
    exit 1
fi

# Step 4: Build application
echo -e "${GREEN}🔨 Building application...${NC}"
pnpm build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Aborting deployment.${NC}"
    exit 1
fi

# Step 5: Restart PM2
echo -e "${GREEN}🔄 Restarting application with PM2...${NC}"
pm2 restart "$APP_NAME"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ PM2 restart failed. Aborting deployment.${NC}"
    exit 1
fi

# Step 6: Save PM2 configuration
pm2 save

# Step 7: Show status
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Application status:"
pm2 status "$APP_NAME"
echo ""
echo "Recent logs:"
pm2 logs "$APP_NAME" --lines 20 --nostream

echo ""
echo -e "${GREEN}🎉 Deployment finished! Your application is now live.${NC}"
echo "Monitor logs with: pm2 logs $APP_NAME"
