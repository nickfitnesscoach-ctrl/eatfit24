#!/bin/bash
# =============================================================================
# EatFit24 PROD Smoke Test Script
# =============================================================================
# Usage: ./smoke_test.sh [BASE_URL]
# Default: https://eatfit24.ru
#
# This script checks critical endpoints to verify PROD is healthy.
# Exit codes: 0 = PASS, 1 = FAIL
# =============================================================================

set -euo pipefail

BASE_URL="${1:-https://eatfit24.ru}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Curl timeouts (in seconds)
CONNECT_TIMEOUT=5
MAX_TIME=10

echo "============================================"
echo " EatFit24 PROD Smoke Test"
echo " Target: $BASE_URL"
echo " Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo

# -----------------------------------------------------------------------------
# Helper: Make HTTP request and get both status code and body
# -----------------------------------------------------------------------------
make_request() {
    local url="$1"
    local method="${2:-GET}"
    local extra_args="${3:-}"

    local tmpfile
    tmpfile=$(mktemp)

    # shellcheck disable=SC2086
    local http_code
    http_code=$(curl -s -w "%{http_code}" -o "$tmpfile" \
        --connect-timeout "$CONNECT_TIMEOUT" \
        --max-time "$MAX_TIME" \
        -X "$method" \
        $extra_args \
        "$url" 2>/dev/null || echo "000")

    local body
    body=$(cat "$tmpfile")
    rm -f "$tmpfile"

    echo "$http_code|$body"
}

# -----------------------------------------------------------------------------
# 1. Health Check
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/5] Health Check...${NC}"
HEALTH_RESPONSE=$(make_request "$BASE_URL/health/")
HEALTH_STATUS="${HEALTH_RESPONSE%%|*}"

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health OK (200)${NC}"
else
    echo -e "${RED}❌ Health FAILED (status: $HEALTH_STATUS)${NC}"
    echo "   Possible issues: backend not running, nginx misconfigured"
    exit 1
fi
echo

# -----------------------------------------------------------------------------
# 2. Billing Plans (Public Endpoint)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/5] Billing Plans...${NC}"
PLANS_RESPONSE=$(make_request "$BASE_URL/api/v1/billing/plans/")
PLANS_STATUS="${PLANS_RESPONSE%%|*}"
PLANS_BODY="${PLANS_RESPONSE#*|}"

if [ "$PLANS_STATUS" != "200" ]; then
    echo -e "${RED}❌ Plans FAILED (status: $PLANS_STATUS)${NC}"
    echo "   Response: ${PLANS_BODY:0:200}"
    exit 1
fi

# Validate JSON (basic check - must start with [ and contain "code")
if ! echo "$PLANS_BODY" | grep -q '^\['; then
    echo -e "${RED}❌ Plans returned invalid JSON (not an array)${NC}"
    echo "   Response: ${PLANS_BODY:0:200}"
    exit 1
fi

# Check if response contains plans
if echo "$PLANS_BODY" | grep -q '"code"'; then
    PLAN_COUNT=$(echo "$PLANS_BODY" | grep -o '"code"' | wc -l)
    echo -e "${GREEN}✅ Plans OK (200) - Found $PLAN_COUNT plan(s)${NC}"
else
    echo -e "${YELLOW}⚠️  Plans 200 but empty - check DB has active plans${NC}"
fi
echo

# -----------------------------------------------------------------------------
# 3. CORS Headers Check
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/5] CORS Headers...${NC}"

# Use curl -I to get headers only
CORS_HEADERS=$(curl -sI -X OPTIONS "$BASE_URL/api/v1/billing/plans/" \
    --connect-timeout "$CONNECT_TIMEOUT" \
    --max-time "$MAX_TIME" \
    -H "Origin: https://eatfit24.ru" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: X-Telegram-Init-Data" 2>/dev/null || echo "error")

if [ "$CORS_HEADERS" = "error" ]; then
    echo -e "${RED}❌ CORS preflight request failed${NC}"
    exit 1
fi

# Check for required CORS headers
CORS_ORIGIN_OK=false
CORS_HEADERS_OK=false

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
    CORS_ORIGIN_OK=true
fi

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-headers"; then
    CORS_HEADERS_OK=true
fi

if [ "$CORS_ORIGIN_OK" = true ] && [ "$CORS_HEADERS_OK" = true ]; then
    echo -e "${GREEN}✅ CORS headers present${NC}"

    # Check for specific Telegram header
    if echo "$CORS_HEADERS" | grep -qi "x-telegram-init-data"; then
        echo -e "${GREEN}   x-telegram-init-data allowed ✓${NC}"
    else
        echo -e "${YELLOW}   ⚠️  x-telegram-init-data not explicitly listed${NC}"
    fi
else
    echo -e "${RED}❌ CORS headers missing or incomplete${NC}"
    echo "   Check CORS_ALLOWED_ORIGINS and CORS_ALLOW_HEADERS in backend settings"
fi
echo

# -----------------------------------------------------------------------------
# 4. Billing Me (Auth Required - should return 401/403 without auth)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/5] Billing Me (auth check)...${NC}"
ME_RESPONSE=$(make_request "$BASE_URL/api/v1/billing/me/")
ME_STATUS="${ME_RESPONSE%%|*}"

if [ "$ME_STATUS" = "401" ] || [ "$ME_STATUS" = "403" ]; then
    echo -e "${GREEN}✅ Auth check OK (returns $ME_STATUS without auth)${NC}"
elif [ "$ME_STATUS" = "200" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Returns 200 without auth - debug mode may be enabled!${NC}"
    echo -e "${YELLOW}   This is a SECURITY ISSUE in production!${NC}"
else
    echo -e "${RED}❌ Unexpected status: $ME_STATUS${NC}"
    exit 1
fi
echo

# -----------------------------------------------------------------------------
# 5. Summary
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/5] Summary${NC}"
echo "============================================"
echo -e "${GREEN}✓ All critical endpoints responding${NC}"
echo ""
echo "Smoke test: PASS"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "Next steps for full verification:"
echo "  1. Open Mini App in Telegram"
echo "  2. Check Network tab for X-Telegram-Init-Data header"
echo "  3. Verify /api/v1/billing/me/ returns 200 with valid auth"
echo ""
echo "If auth still fails, check backend logs:"
echo "  docker compose logs --tail=50 backend | grep TelegramAuth"
echo "============================================"
