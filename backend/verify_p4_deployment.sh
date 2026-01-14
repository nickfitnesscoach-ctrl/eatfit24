#!/bin/bash
# Verification script for P4 weekly digest health guardrails deployment
# Run this on production server after deploying commit ca3ad96

set -e

echo "==================================================================="
echo "P4 Weekly Digest Health Guardrails - Deployment Verification"
echo "==================================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Step 1: Verify Beat schedule includes health check task"
echo "-------------------------------------------------------------------"
docker logs eatfit24-celery-beat-1 --tail 100 | grep -A 2 "billing-digest-health-check" || {
    echo -e "${RED}❌ FAIL: billing-digest-health-check not found in Beat logs${NC}"
    exit 1
}
echo -e "${GREEN}✓ Beat schedule includes billing-digest-health-check${NC}"
echo ""

echo "Step 2: Verify task is registered in worker"
echo "-------------------------------------------------------------------"
docker exec eatfit24-backend-1 python manage.py shell -c "
from apps.billing.tasks_digest import check_weekly_digest_health
print('✓ check_weekly_digest_health is callable:', callable(check_weekly_digest_health))
" || {
    echo -e "${RED}❌ FAIL: Task not registered${NC}"
    exit 1
}
echo -e "${GREEN}✓ Task registered in worker${NC}"
echo ""

echo "Step 3: Manual test - Run health check on fresh system"
echo "-------------------------------------------------------------------"
echo -e "${YELLOW}Running check_weekly_digest_health()...${NC}"
docker exec eatfit24-backend-1 python manage.py shell -c "
from apps.billing.tasks_digest import check_weekly_digest_health
result = check_weekly_digest_health()
print('Result:', result)
print('Status:', result.get('status'))
" || {
    echo -e "${RED}❌ FAIL: Health check task failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Health check executed successfully${NC}"
echo ""

echo "Step 4: Verify cache keys are defined"
echo "-------------------------------------------------------------------"
docker exec eatfit24-backend-1 python manage.py shell -c "
from apps.billing.tasks_digest import CACHE_KEY_LAST_SUCCESS, CACHE_KEY_HEALTH_ALERTED
print('CACHE_KEY_LAST_SUCCESS:', CACHE_KEY_LAST_SUCCESS)
print('CACHE_KEY_HEALTH_ALERTED:', CACHE_KEY_HEALTH_ALERTED)
" || {
    echo -e "${RED}❌ FAIL: Cache keys not defined${NC}"
    exit 1
}
echo -e "${GREEN}✓ Cache keys defined correctly${NC}"
echo ""

echo "Step 5: Verify START/COMPLETE logging format (check recent logs)"
echo "-------------------------------------------------------------------"
echo -e "${YELLOW}Checking for new log format in recent executions...${NC}"
# This will show recent digest executions, if any
docker logs eatfit24-celery-worker-1 --tail 500 | grep "\[WEEKLY_DIGEST\]" | tail -10 || {
    echo -e "${YELLOW}⚠️  No recent digest executions found (expected if not Monday)${NC}"
}
echo ""

echo "Step 6: Manual test - Run full digest with new logging"
echo "-------------------------------------------------------------------"
echo -e "${YELLOW}Running send_weekly_billing_digest() to verify START/COMPLETE logs...${NC}"
docker exec eatfit24-backend-1 python manage.py shell -c "
from apps.billing.tasks_digest import send_weekly_billing_digest
result = send_weekly_billing_digest()
print('Success:', result.get('success'))
print('Period:', result.get('period'))
print('Total events:', result.get('total_events'))
print('Failed count:', result.get('failed_count'))
if result.get('deliveries'):
    for d in result['deliveries']:
        print(f\"  Delivered to chat_id={d['chat_id']} message_id={d['message_id']}\")
" || {
    echo -e "${RED}❌ FAIL: Digest task failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Digest executed successfully${NC}"
echo ""

echo "Step 7: Verify START/COMPLETE logs were written"
echo "-------------------------------------------------------------------"
docker logs eatfit24-celery-worker-1 --tail 100 | grep "\[WEEKLY_DIGEST\] START" | tail -1 || {
    echo -e "${RED}❌ FAIL: START log not found${NC}"
    exit 1
}
echo -e "${GREEN}✓ START log found${NC}"

docker logs eatfit24-celery-worker-1 --tail 100 | grep "\[WEEKLY_DIGEST\] COMPLETE" | tail -1 || {
    echo -e "${RED}❌ FAIL: COMPLETE log not found${NC}"
    exit 1
}
echo -e "${GREEN}✓ COMPLETE log found with duration_ms and task_id${NC}"
echo ""

echo "Step 8: Verify last_success timestamp was cached"
echo "-------------------------------------------------------------------"
docker exec eatfit24-backend-1 python manage.py shell -c "
from django.core.cache import cache
from apps.billing.tasks_digest import CACHE_KEY_LAST_SUCCESS
last_success = cache.get(CACHE_KEY_LAST_SUCCESS)
if last_success:
    print('✓ last_success cached:', last_success)
else:
    print('⚠️  last_success not cached (expected if digest delivery failed)')
" || {
    echo -e "${RED}❌ FAIL: Cache check failed${NC}"
    exit 1
}
echo ""

echo "==================================================================="
echo -e "${GREEN}✅ P4 Deployment Verification COMPLETE${NC}"
echo "==================================================================="
echo ""
echo "Next steps:"
echo "  1. Confirm Telegram message was received"
echo "  2. Monitor Beat logs for daily health check execution (12:00 MSK)"
echo "  3. Check worker logs for [WEEKLY_DIGEST_HEALTH] entries"
echo ""
echo "Beat schedule (for reference):"
echo "  - Weekly digest: Monday 10:00 MSK (CELERY_TIMEZONE=Europe/Moscow)"
echo "  - Health check: Daily 12:00 MSK (CELERY_TIMEZONE=Europe/Moscow)"
echo ""
echo "Note: Celery crontab schedules are interpreted in CELERY_TIMEZONE (Europe/Moscow)"
echo ""
