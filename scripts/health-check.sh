#!/bin/bash

# Health Check Script for Kaka Malem
# Verifies that all critical services are running correctly

# Don't exit on error for health checks - we want to run all checks
set +e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="kakamalem"
APP_DIR="/var/www/kakamalem"
HEALTH_CHECK_URL="http://localhost:3000"
FAILED_CHECKS=0
WARNING_CHECKS=0

echo "🏥 Running health checks for Kaka Malem..."
echo "⏰ Check time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Check 1: PM2 Process
echo -n "Checking PM2 process... "
if pm2 describe "$APP_NAME" 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    pm2 describe "$APP_NAME" 2>/dev/null || true
fi

# Check 2: Process Memory
echo -n "Checking memory usage... "
MEMORY=$(pm2 describe "$APP_NAME" | grep "memory" | head -1 | awk '{print $4}')
echo -e "${BLUE}$MEMORY${NC}"

# Check 3: Process Uptime
echo -n "Checking uptime... "
UPTIME=$(pm2 describe "$APP_NAME" | grep "uptime" | head -1 | awk '{print $4 " " $5}')
echo -e "${BLUE}$UPTIME${NC}"

# Check 4: Disk Space
echo -n "Checking disk space... "
DISK_USAGE=$(df -h "$APP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ ${DISK_USAGE}% used${NC}"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠ ${DISK_USAGE}% used (warning)${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
    echo -e "${RED}✗ ${DISK_USAGE}% used (critical)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 5: Node.js version
echo -n "Checking Node.js version... "
NODE_VERSION=$(node -v)
if [[ "$NODE_VERSION" =~ ^v(2[0-9]|[3-9][0-9]) ]]; then
    echo -e "${GREEN}✓ $NODE_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ $NODE_VERSION (consider upgrading)${NC}"
fi

# Check 6: pnpm version
echo -n "Checking pnpm... "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}✓ v$PNPM_VERSION${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
fi

# Check 7: Git status
echo -n "Checking Git status... "
cd "$APP_DIR"
if git status &> /dev/null; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    COMMIT=$(git rev-parse --short HEAD)
    echo -e "${GREEN}✓ $BRANCH ($COMMIT)${NC}"
else
    echo -e "${RED}✗ Not a git repository${NC}"
fi

# Check 8: Environment file
echo -n "Checking .env file... "
if [ -f "$APP_DIR/.env" ]; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
fi

# Check 9: Build directory
echo -n "Checking build directory... "
if [ -d "$APP_DIR/.next" ]; then
    BUILD_SIZE=$(du -sh "$APP_DIR/.next" | awk '{print $1}')
    echo -e "${GREEN}✓ Exists ($BUILD_SIZE)${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
fi

# Check 10: HTTP Response
echo -n "Checking HTTP response... "
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" --max-time 10 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 308 ] || [ "$HTTP_CODE" -eq 301 ]; then
        echo -e "${GREEN}✓ HTTP $HTTP_CODE${NC}"
    else
        echo -e "${RED}✗ HTTP $HTTP_CODE${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}⚠ curl not installed${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi

# Check 11: Database connectivity
echo -n "Checking database connection... "
if [ -f "$APP_DIR/.env" ]; then
    source "$APP_DIR/.env"
    if [ -n "$DATABASE_URL" ]; then
        if command -v psql &> /dev/null; then
            if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
                echo -e "${GREEN}✓ Connected${NC}"
            else
                echo -e "${RED}✗ Cannot connect${NC}"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
            fi
        else
            echo -e "${YELLOW}⚠ psql not installed (skipping)${NC}"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
        fi
    else
        echo -e "${YELLOW}⚠ DATABASE_URL not set${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}⚠ .env not found${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi

# Check 12: Recent errors in logs
echo -n "Checking recent errors... "
ERROR_COUNT=$(pm2 logs "$APP_NAME" --lines 100 --nostream --err 2>/dev/null | grep -i "error" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No recent errors${NC}"
elif [ "$ERROR_COUNT" -lt 5 ]; then
    echo -e "${YELLOW}⚠ $ERROR_COUNT errors found${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
    echo -e "${RED}✗ $ERROR_COUNT errors found${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 13: CPU Usage
echo -n "Checking CPU usage... "
CPU_USAGE=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "cpu" | head -1 | awk '{print $4}' | sed 's/%//')
if [ -n "$CPU_USAGE" ]; then
    if [ "${CPU_USAGE%.*}" -lt 80 ]; then
        echo -e "${GREEN}✓ ${CPU_USAGE}%${NC}"
    elif [ "${CPU_USAGE%.*}" -lt 95 ]; then
        echo -e "${YELLOW}⚠ ${CPU_USAGE}% (high)${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        echo -e "${RED}✗ ${CPU_USAGE}% (critical)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${BLUE}N/A${NC}"
fi

# Check 14: Restarts count
echo -n "Checking restart count... "
RESTART_COUNT=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "restarts" | head -1 | awk '{print $4}')
if [ -n "$RESTART_COUNT" ]; then
    if [ "$RESTART_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ $RESTART_COUNT${NC}"
    elif [ "$RESTART_COUNT" -lt 5 ]; then
        echo -e "${YELLOW}⚠ $RESTART_COUNT restarts${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        echo -e "${RED}✗ $RESTART_COUNT restarts (investigate)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${BLUE}N/A${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNING_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
    EXIT_CODE=0
elif [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Health check completed with $WARNING_CHECKS warnings${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}❌ Health check failed: $FAILED_CHECKS critical issues, $WARNING_CHECKS warnings${NC}"
    EXIT_CODE=1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Detailed PM2 status:"
pm2 status "$APP_NAME"

exit $EXIT_CODE
