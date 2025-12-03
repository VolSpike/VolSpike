#!/bin/bash
################################################################################
# WebSocket Daemon Diagnostic Script
################################################################################
# This script diagnoses the critical issue causing the daemon to stop
# after ~18 minutes and show no data in the API server.
#
# Run as: sudo ./diagnose_websocket_issue.sh
################################################################################

echo "════════════════════════════════════════════════════════════════════════════"
echo "  WebSocket Daemon Diagnostic"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root: sudo ./diagnose_websocket_issue.sh"
   exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "[1/8] Checking systemd service configuration..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl cat binance-funding-ws.service 2>/dev/null || echo "Service file not found"
echo ""

echo "[2/8] Checking systemd service configuration for API server..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl cat binance-funding-api.service 2>/dev/null || echo "Service file not found"
echo ""

echo "[3/8] Finding actual Python script locations..."
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Searching for binance_funding_ws_daemon.py:"
find /home -name "binance_funding_ws_daemon.py" 2>/dev/null
echo ""
echo "Searching for funding_api_server.py:"
find /home -name "funding_api_server.py" 2>/dev/null
echo ""

echo "[4/8] Finding state files (.funding_state.json)..."
echo "─────────────────────────────────────────────────────────────────────────────"
find /home -name ".funding_state.json" 2>/dev/null
echo ""

echo "[5/8] Checking state file paths used by scripts..."
echo "─────────────────────────────────────────────────────────────────────────────"

# Extract WorkingDirectory from daemon service
WS_DAEMON_WORK_DIR=$(systemctl cat binance-funding-ws.service 2>/dev/null | grep "^WorkingDirectory=" | cut -d'=' -f2)
API_WORK_DIR=$(systemctl cat binance-funding-api.service 2>/dev/null | grep "^WorkingDirectory=" | cut -d'=' -f2)

echo "WebSocket Daemon WorkingDirectory: ${WS_DAEMON_WORK_DIR:-NOT SET}"
echo "API Server WorkingDirectory: ${API_WORK_DIR:-NOT SET}"
echo ""

if [ -n "$WS_DAEMON_WORK_DIR" ]; then
    echo "Expected daemon state file: ${WS_DAEMON_WORK_DIR}/.funding_state.json"
    if [ -f "${WS_DAEMON_WORK_DIR}/.funding_state.json" ]; then
        echo -e "${GREEN}✓ Daemon state file exists${NC}"
        ls -lh "${WS_DAEMON_WORK_DIR}/.funding_state.json"
        echo ""
        echo "Last 5 lines of daemon state file:"
        tail -5 "${WS_DAEMON_WORK_DIR}/.funding_state.json" 2>/dev/null | head -5
    else
        echo -e "${RED}✗ Daemon state file NOT FOUND${NC}"
    fi
    echo ""
fi

if [ -n "$API_WORK_DIR" ]; then
    echo "Expected API server state file: ${API_WORK_DIR}/.funding_state.json"
    if [ -f "${API_WORK_DIR}/.funding_state.json" ]; then
        echo -e "${GREEN}✓ API server state file exists${NC}"
        ls -lh "${API_WORK_DIR}/.funding_state.json"
        echo ""
        echo "Last 5 lines of API state file:"
        tail -5 "${API_WORK_DIR}/.funding_state.json" 2>/dev/null | head -5
    else
        echo -e "${RED}✗ API server state file NOT FOUND${NC}"
    fi
    echo ""
fi

echo "[6/8] Checking if paths match..."
echo "─────────────────────────────────────────────────────────────────────────────"
if [ "$WS_DAEMON_WORK_DIR" = "$API_WORK_DIR" ]; then
    echo -e "${GREEN}✓ PATHS MATCH - Services using same directory${NC}"
    echo "  Both services will read/write to: ${WS_DAEMON_WORK_DIR}/.funding_state.json"
else
    echo -e "${RED}✗ PATH MISMATCH DETECTED!${NC}"
    echo "  Daemon writes to: ${WS_DAEMON_WORK_DIR}/.funding_state.json"
    echo "  API reads from:   ${API_WORK_DIR}/.funding_state.json"
    echo ""
    echo -e "${YELLOW}⚠ CRITICAL ISSUE: This is likely why the API shows no data!${NC}"
    echo "  The daemon writes state to one location, but the API reads from another."
fi
echo ""

echo "[7/8] Checking disk space..."
echo "─────────────────────────────────────────────────────────────────────────────"
df -h /home
echo ""

echo "[8/8] Checking daemon process and resource usage..."
echo "─────────────────────────────────────────────────────────────────────────────"
if pgrep -f "binance_funding_ws_daemon.py" > /dev/null; then
    echo -e "${GREEN}✓ Daemon process is running${NC}"
    ps aux | grep "binance_funding_ws_daemon.py" | grep -v grep
    echo ""
    echo "Process details:"
    pgrep -f "binance_funding_ws_daemon.py" | xargs ps -o pid,ppid,user,%cpu,%mem,vsz,rss,etime,cmd
else
    echo -e "${RED}✗ Daemon process is NOT running${NC}"
fi
echo ""

echo "════════════════════════════════════════════════════════════════════════════"
echo "  Diagnostic Complete"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next Steps:"
echo ""
if [ "$WS_DAEMON_WORK_DIR" != "$API_WORK_DIR" ]; then
    echo -e "${YELLOW}1. FIX PATH MISMATCH:${NC}"
    echo "   Edit both service files to use the SAME WorkingDirectory"
    echo "   "
    echo "   Recommended: /home/trader/volume-spike-bot"
    echo "   "
    echo "   sudo nano /etc/systemd/system/binance-funding-ws.service"
    echo "   sudo nano /etc/systemd/system/binance-funding-api.service"
    echo "   "
    echo "   Set WorkingDirectory=/home/trader/volume-spike-bot in BOTH"
    echo "   "
    echo "   Then reload and restart:"
    echo "   sudo systemctl daemon-reload"
    echo "   sudo systemctl restart binance-funding-ws"
    echo "   sudo systemctl restart binance-funding-api"
    echo ""
fi

echo "2. MONITOR LOGS:"
echo "   journalctl -u binance-funding-ws -f"
echo ""

echo "3. CHECK STATE FILE:"
echo "   watch -n 1 'ls -lh /home/trader/volume-spike-bot/.funding_state.json && echo "" && tail -20 /home/trader/volume-spike-bot/.funding_state.json | python3 -m json.tool 2>/dev/null | head -30'"
echo ""

echo "4. TEST HEALTH ENDPOINT:"
echo "   watch -n 2 'curl -s http://localhost:8888/funding/health | python3 -m json.tool'"
echo ""
