#!/bin/bash

# Verification Script for OI Realtime Poller Setup
# Run this script to verify everything is configured correctly

set -e

echo "=========================================="
echo "OI Realtime Poller - Verification Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (update these)
API_URL="${VOLSPIKE_API_URL:-https://volspike-production.up.railway.app}"
API_KEY="${VOLSPIKE_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ VOLSPIKE_API_KEY not set${NC}"
    echo "Please set: export VOLSPIKE_API_KEY=your-key"
    exit 1
fi

echo "Testing against: $API_URL"
echo ""

# Test 1: Backend Health
echo "Test 1: Backend Health Check"
echo "---------------------------"
if curl -s -f "$API_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend is reachable${NC}"
else
    echo -e "${RED}❌ Backend is not reachable${NC}"
    exit 1
fi
echo ""

# Test 2: Liquid Universe Endpoint
echo "Test 2: Liquid Universe Endpoint"
echo "---------------------------------"
LIQUID_RESPONSE=$(curl -s "$API_URL/api/market/open-interest/liquid-universe")
LIQUID_COUNT=$(echo "$LIQUID_RESPONSE" | grep -o '"totalSymbols":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$LIQUID_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Liquid universe has $LIQUID_COUNT symbols${NC}"
else
    echo -e "${YELLOW}⚠️  Liquid universe is empty (may need to wait for job to run)${NC}"
fi
echo ""

# Test 3: OI Samples Endpoint
echo "Test 3: OI Samples Endpoint"
echo "---------------------------"
SAMPLES_RESPONSE=$(curl -s "$API_URL/api/market/open-interest/samples?limit=5")
SAMPLES_COUNT=$(echo "$SAMPLES_RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$SAMPLES_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $SAMPLES_COUNT OI samples${NC}"
    
    # Check for realtime samples
    REALTIME_COUNT=$(echo "$SAMPLES_RESPONSE" | grep -c '"source":"realtime"' || echo "0")
    if [ "$REALTIME_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Found realtime OI samples${NC}"
    else
        echo -e "${YELLOW}⚠️  No realtime samples yet (poller may not have run)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No OI samples found (may need to wait for data)${NC}"
fi
echo ""

# Test 4: OI Alerts Endpoint
echo "Test 4: OI Alerts Endpoint"
echo "--------------------------"
ALERTS_RESPONSE=$(curl -s "$API_URL/api/open-interest-alerts?limit=5")
ALERTS_COUNT=$(echo "$ALERTS_RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$ALERTS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $ALERTS_COUNT OI alerts${NC}"
else
    echo -e "${YELLOW}ℹ️  No OI alerts yet (normal - alerts only fire when thresholds met)${NC}"
fi
echo ""

# Test 5: API Key Authentication
echo "Test 5: API Key Authentication"
echo "------------------------------"
AUTH_TEST=$(curl -s -w "%{http_code}" -o /dev/null \
    -X POST "$API_URL/api/market/open-interest/ingest" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"data":[{"symbol":"TESTUSDT","openInterest":1000}],"source":"test"}')

if [ "$AUTH_TEST" = "200" ] || [ "$AUTH_TEST" = "201" ]; then
    echo -e "${GREEN}✅ API key is valid${NC}"
else
    echo -e "${RED}❌ API key authentication failed (HTTP $AUTH_TEST)${NC}"
    echo "   Check that API key matches backend ALERT_INGEST_API_KEY"
fi
echo ""

# Test 6: Python Script Syntax
echo "Test 6: Python Script Syntax"
echo "----------------------------"
if [ -f "oi_realtime_poller.py" ]; then
    if python3 -m py_compile oi_realtime_poller.py 2>/dev/null; then
        echo -e "${GREEN}✅ Python script syntax is valid${NC}"
    else
        echo -e "${RED}❌ Python script has syntax errors${NC}"
        python3 -m py_compile oi_realtime_poller.py
    fi
else
    echo -e "${YELLOW}⚠️  oi_realtime_poller.py not found in current directory${NC}"
fi
echo ""

# Test 7: Python Dependencies
echo "Test 7: Python Dependencies"
echo "---------------------------"
if python3 -c "import requests" 2>/dev/null; then
    echo -e "${GREEN}✅ requests library is installed${NC}"
else
    echo -e "${RED}❌ requests library is missing${NC}"
    echo "   Install with: pip3 install requests"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo "Backend URL: $API_URL"
echo "Liquid Universe: $LIQUID_COUNT symbols"
echo "OI Samples: $SAMPLES_COUNT found"
echo "OI Alerts: $ALERTS_COUNT found"
echo ""
echo "Next Steps:"
echo "1. If liquid universe is empty, wait 5 minutes for job to run"
echo "2. If no OI samples, check poller is running and posting data"
echo "3. Test debug UI at: https://your-frontend-domain.com/debug/open-interest"
echo ""

