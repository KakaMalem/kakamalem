#!/bin/bash

# =============================================================================
# Health Check Script for Kaka Malem (Docker Version)
# =============================================================================
# Verifies that all critical services are running correctly
# Compatible with Docker-based deployment (not PM2)
# =============================================================================

# Don't exit on error for health checks - we want to run all checks
set +e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER_NAME="kakamalem-app"
APP_DIR="/var/www/kakamalem"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
FAILED_CHECKS=0
WARNING_CHECKS=0

echo "🏥 Running health checks for Kaka Malem..."
echo "⏰ Check time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# =============================================================================
# Check 1: Docker Container Status
# =============================================================================
echo -n "Checking Docker container... "
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null)
if [ "$CONTAINER_STATUS" = "running" ]; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running (status: ${CONTAINER_STATUS:-not found})${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 2: Container Health Status
# =============================================================================
echo -n "Checking container health... "
HEALTH_STATUS=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null)
if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
elif [ "$HEALTH_STATUS" = "starting" ]; then
    echo -e "${YELLOW}⚠ Starting up...${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
    echo -e "${RED}✗ Unhealthy (status: ${HEALTH_STATUS:-unknown})${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 3: Container Uptime
# =============================================================================
echo -n "Checking container uptime... "
STARTED_AT=$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER_NAME" 2>/dev/null)
if [ -n "$STARTED_AT" ]; then
    # Calculate uptime
    START_EPOCH=$(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${STARTED_AT%%.*}" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    UPTIME_SECONDS=$((NOW_EPOCH - START_EPOCH))
    UPTIME_DAYS=$((UPTIME_SECONDS / 86400))
    UPTIME_HOURS=$(((UPTIME_SECONDS % 86400) / 3600))
    UPTIME_MINS=$(((UPTIME_SECONDS % 3600) / 60))
    echo -e "${BLUE}${UPTIME_DAYS}d ${UPTIME_HOURS}h ${UPTIME_MINS}m${NC}"
else
    echo -e "${BLUE}N/A${NC}"
fi

# =============================================================================
# Check 4: Container Memory Usage
# =============================================================================
echo -n "Checking memory usage... "
MEMORY_STATS=$(docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_NAME" 2>/dev/null)
if [ -n "$MEMORY_STATS" ]; then
    echo -e "${BLUE}$MEMORY_STATS${NC}"
else
    echo -e "${BLUE}N/A${NC}"
fi

# =============================================================================
# Check 5: Container CPU Usage
# =============================================================================
echo -n "Checking CPU usage... "
CPU_STATS=$(docker stats --no-stream --format "{{.CPUPerc}}" "$CONTAINER_NAME" 2>/dev/null)
if [ -n "$CPU_STATS" ]; then
    CPU_VALUE=$(echo "$CPU_STATS" | sed 's/%//')
    if [ "${CPU_VALUE%.*}" -lt 80 ]; then
        echo -e "${GREEN}✓ $CPU_STATS${NC}"
    elif [ "${CPU_VALUE%.*}" -lt 95 ]; then
        echo -e "${YELLOW}⚠ $CPU_STATS (high)${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        echo -e "${RED}✗ $CPU_STATS (critical)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${BLUE}N/A${NC}"
fi

# =============================================================================
# Check 6: Container Restart Count
# =============================================================================
echo -n "Checking restart count... "
RESTART_COUNT=$(docker inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null)
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

# =============================================================================
# Check 7: Disk Space
# =============================================================================
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

# =============================================================================
# Check 8: Git Status
# =============================================================================
echo -n "Checking Git status... "
cd "$APP_DIR"
if git status &> /dev/null; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    COMMIT=$(git rev-parse --short HEAD)
    echo -e "${GREEN}✓ $BRANCH ($COMMIT)${NC}"
else
    echo -e "${RED}✗ Not a git repository${NC}"
fi

# =============================================================================
# Check 9: Environment File
# =============================================================================
echo -n "Checking .env file... "
if [ -f "$APP_DIR/.env" ]; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 10: HTTP Health Endpoint
# =============================================================================
echo -n "Checking health endpoint... "
if command -v curl &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s "$HEALTH_CHECK_URL" --max-time 10 2>/dev/null)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" --max-time 10 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" -eq 200 ]; then
        # Parse JSON response if jq is available
        if command -v jq &> /dev/null; then
            STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null)
            DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.checks.database.status' 2>/dev/null)
            echo -e "${GREEN}✓ HTTP $HTTP_CODE (status: $STATUS, db: $DB_STATUS)${NC}"
        else
            echo -e "${GREEN}✓ HTTP $HTTP_CODE${NC}"
        fi
    else
        echo -e "${RED}✗ HTTP $HTTP_CODE${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}⚠ curl not installed${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi

# =============================================================================
# Check 11: Database Connectivity (via PgBouncer)
# =============================================================================
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

# =============================================================================
# Check 12: PostgreSQL Service
# =============================================================================
echo -n "Checking PostgreSQL... "
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 13: PgBouncer Service
# =============================================================================
echo -n "Checking PgBouncer... "
if systemctl is-active --quiet pgbouncer; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 14: Nginx Service
# =============================================================================
echo -n "Checking Nginx... "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 15: Recent Container Logs (Errors)
# =============================================================================
echo -n "Checking recent errors... "
ERROR_COUNT=$(docker logs "$CONTAINER_NAME" --since 1h 2>&1 | grep -i "error" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No recent errors${NC}"
elif [ "$ERROR_COUNT" -lt 5 ]; then
    echo -e "${YELLOW}⚠ $ERROR_COUNT errors in last hour${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
    echo -e "${RED}✗ $ERROR_COUNT errors in last hour${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 16: SSL Certificate
# =============================================================================
echo -n "Checking SSL certificate... "
if [ -f "/etc/letsencrypt/live/kakamalem.com/fullchain.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/kakamalem.com/fullchain.pem 2>/dev/null | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

    if [ "$DAYS_LEFT" -gt 30 ]; then
        echo -e "${GREEN}✓ Valid ($DAYS_LEFT days left)${NC}"
    elif [ "$DAYS_LEFT" -gt 7 ]; then
        echo -e "${YELLOW}⚠ Expiring soon ($DAYS_LEFT days left)${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        echo -e "${RED}✗ Expires in $DAYS_LEFT days!${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}⚠ Certificate not found${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi

# =============================================================================
# Summary
# =============================================================================
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

# Show Docker container status
echo ""
echo "Docker container status:"
docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

exit $EXIT_CODE
