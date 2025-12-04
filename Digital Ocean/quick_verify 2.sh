#!/bin/bash
################################################################################
# Quick Funding WebSocket Verification
################################################################################
# This script runs all verification checks to validate WebSocket funding data
# before switching from REST API to WebSocket-only mode.
#
# Usage:
#   ./quick_verify.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "  Funding Rate WebSocket Verification"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Check WebSocket daemon status
echo -e "${BLUE}[1/5] Checking WebSocket daemon status...${NC}"
if systemctl is-active --quiet binance-funding-ws 2>/dev/null; then
    echo -e "${GREEN}✓ WebSocket daemon is running${NC}"
else
    echo -e "${RED}✗ WebSocket daemon is NOT running${NC}"
    echo "  Start it with: sudo systemctl start binance-funding-ws"
    exit 1
fi
echo ""

# Step 2: Check API server status
echo -e "${BLUE}[2/5] Checking API server status...${NC}"
if systemctl is-active --quiet binance-funding-api 2>/dev/null; then
    echo -e "${GREEN}✓ API server is running${NC}"
else
    echo -e "${RED}✗ API server is NOT running${NC}"
    echo "  Start it with: sudo systemctl start binance-funding-api"
    exit 1
fi
echo ""

# Step 3: Check health endpoint
echo -e "${BLUE}[3/5] Checking WebSocket health endpoint...${NC}"
HEALTH=$(curl -s http://localhost:8888/funding/health)

if [ -z "$HEALTH" ]; then
    echo -e "${RED}✗ Cannot reach health endpoint${NC}"
    echo "  Check if API server is running on port 8888"
    exit 1
fi

# Parse health response
STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null)
WS_CONNECTED=$(echo "$HEALTH" | jq -r '.websocketConnected' 2>/dev/null)
SYMBOL_COUNT=$(echo "$HEALTH" | jq -r '.symbolCount' 2>/dev/null)
OLDEST_AGE=$(echo "$HEALTH" | jq -r '.oldestDataAgeSeconds' 2>/dev/null)

echo "  Status: $STATUS"
echo "  WebSocket Connected: $WS_CONNECTED"
echo "  Symbol Count: $SYMBOL_COUNT"
echo "  Oldest Data Age: ${OLDEST_AGE}s"

if [ "$STATUS" = "healthy" ] && [ "$WS_CONNECTED" = "true" ]; then
    echo -e "${GREEN}✓ WebSocket service is healthy${NC}"
else
    echo -e "${RED}✗ WebSocket service is unhealthy${NC}"
    echo "  Check logs with: sudo journalctl -u binance-funding-ws -n 50"
    exit 1
fi
echo ""

# Step 4: Quick manual comparison
echo -e "${BLUE}[4/5] Comparing REST vs WebSocket for BTCUSDT...${NC}"

# Get REST data
REST_FUNDING=$(curl -s 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT' | jq -r '.lastFundingRate')
REST_MARK=$(curl -s 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT' | jq -r '.markPrice')

# Get WebSocket data
WS_FUNDING=$(curl -s 'http://localhost:8888/funding/BTCUSDT' | jq -r '.fundingRate')
WS_MARK=$(curl -s 'http://localhost:8888/funding/BTCUSDT' | jq -r '.markPrice')
WS_AGE=$(curl -s 'http://localhost:8888/funding/BTCUSDT' | jq -r '.ageSeconds')

echo "  REST API Funding:    $REST_FUNDING"
echo "  WebSocket Funding:   $WS_FUNDING"
echo "  WebSocket Data Age:  ${WS_AGE}s"

# Calculate difference (basic bash arithmetic - limited precision)
if [ "$REST_FUNDING" != "null" ] && [ "$WS_FUNDING" != "null" ]; then
    echo -e "${GREEN}✓ Both sources returned data${NC}"

    # Simple comparison (for exact match only - Python script does precise calculation)
    if [ "$REST_FUNDING" = "$WS_FUNDING" ]; then
        echo -e "${GREEN}✓ Funding rates are IDENTICAL${NC}"
    else
        echo -e "${YELLOW}⚠ Funding rates differ slightly (this is normal)${NC}"
        echo "  Run verification scripts for detailed comparison"
    fi
else
    echo -e "${RED}✗ One or both sources returned null${NC}"
    exit 1
fi
echo ""

# Step 5: Recommendations
echo -e "${BLUE}[5/5] Verification Summary${NC}"
echo "════════════════════════════════════════════════════════════════════════════"

if [ "$SYMBOL_COUNT" -gt 200 ] && [ "$STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Basic health checks PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run detailed verification:"
    echo -e "     ${YELLOW}python3 verify_funding_data.py${NC}"
    echo ""
    echo "  2. Run alert simulation:"
    echo -e "     ${YELLOW}python3 simulate_dual_alerts.py${NC}"
    echo ""
    echo "  3. Monitor comparison logs:"
    echo -e "     ${YELLOW}sudo journalctl -u your-volume-alert-service -f | grep 'Funding Comparison'${NC}"
    echo ""
    echo "  4. After 24-48 hours of monitoring, review:"
    echo -e "     ${YELLOW}cat VERIFY_FUNDING_WEBSOCKET.md${NC}"
else
    echo -e "${RED}✗ Health checks FAILED${NC}"
    echo ""
    echo "Issues found:"
    if [ "$SYMBOL_COUNT" -lt 200 ]; then
        echo -e "  ${RED}• Symbol count too low ($SYMBOL_COUNT < 200)${NC}"
        echo "    Restart WebSocket daemon: sudo systemctl restart binance-funding-ws"
    fi
    if [ "$STATUS" != "healthy" ]; then
        echo -e "  ${RED}• Service status: $STATUS${NC}"
        echo "    Check logs: sudo journalctl -u binance-funding-ws -n 100"
    fi
fi

echo "════════════════════════════════════════════════════════════════════════════"
echo ""
