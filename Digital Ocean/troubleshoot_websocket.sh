#!/bin/bash
################################################################################
# WebSocket Troubleshooting Script
################################################################################
# This script helps diagnose WebSocket funding rate service issues
################################################################################

echo "════════════════════════════════════════════════════════════════════════════"
echo "  WebSocket Funding Service Troubleshooting"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root: sudo ./troubleshoot_websocket.sh"
   exit 1
fi

# 1. Check service status
echo "[1/6] Checking service status..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl status binance-funding-ws --no-pager -l
echo ""

# 2. Check recent logs
echo "[2/6] Recent logs (last 50 lines)..."
echo "─────────────────────────────────────────────────────────────────────────────"
journalctl -u binance-funding-ws -n 50 --no-pager
echo ""

# 3. Check API server status
echo "[3/6] Checking API server status..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl status binance-funding-api --no-pager -l
echo ""

# 4. Test health endpoint
echo "[4/6] Testing health endpoint..."
echo "─────────────────────────────────────────────────────────────────────────────"
curl -s http://localhost:8888/funding/health | python3 -m json.tool || echo "Health endpoint not responding"
echo ""

# 5. Check if state file exists
echo "[5/6] Checking state file..."
echo "─────────────────────────────────────────────────────────────────────────────"
if [ -f "/home/trader/volume-spike-bot/.funding_state.json" ]; then
    echo "✓ State file exists"
    echo "  Location: /home/trader/volume-spike-bot/.funding_state.json"
    echo "  Size: $(du -h /home/trader/volume-spike-bot/.funding_state.json | cut -f1)"
    echo "  Last modified: $(stat -c %y /home/trader/volume-spike-bot/.funding_state.json 2>/dev/null || stat -f %Sm /home/trader/volume-spike-bot/.funding_state.json)"
else
    echo "✗ State file NOT found"
    echo "  Expected location: /home/trader/volume-spike-bot/.funding_state.json"
fi
echo ""

# 6. Check network connectivity to Binance
echo "[6/6] Testing Binance WebSocket connectivity..."
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Testing connection to fstream.binance.com..."
if nc -zv fstream.binance.com 443 2>&1 | grep -q succeeded; then
    echo "✓ Can reach Binance WebSocket endpoint"
else
    echo "✗ Cannot reach Binance WebSocket endpoint"
    echo "  This may indicate network/firewall issues"
fi
echo ""

echo "════════════════════════════════════════════════════════════════════════════"
echo "  Troubleshooting Complete"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Common fixes:"
echo "  1. Restart WebSocket daemon: systemctl restart binance-funding-ws"
echo "  2. Restart API server: systemctl restart binance-funding-api"
echo "  3. Check for errors in logs above"
echo "  4. Verify network connectivity to Binance"
echo ""
