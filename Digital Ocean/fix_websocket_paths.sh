#!/bin/bash
################################################################################
# Fix WebSocket Daemon Path Mismatch
################################################################################
# This script fixes the critical path mismatch between the WebSocket daemon
# and API server that causes the "connected but no data" issue.
#
# The fix ensures both services use the same WorkingDirectory and state file.
#
# Run as: sudo ./fix_websocket_paths.sh
################################################################################

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root: sudo ./fix_websocket_paths.sh"
   exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "  Fix WebSocket Daemon Path Mismatch"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Configuration
TARGET_DIR="/home/trader/volume-spike-bot"
DAEMON_SCRIPT="${TARGET_DIR}/binance_funding_ws_daemon.py"
API_SCRIPT="${TARGET_DIR}/funding_api_server.py"

echo "Target directory: ${TARGET_DIR}"
echo ""

# Verify scripts exist
echo "[1/8] Verifying scripts exist..."
echo "─────────────────────────────────────────────────────────────────────────────"
if [ ! -f "$DAEMON_SCRIPT" ]; then
    echo -e "${RED}✗ Daemon script not found: $DAEMON_SCRIPT${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Daemon script found${NC}"

if [ ! -f "$API_SCRIPT" ]; then
    echo -e "${RED}✗ API script not found: $API_SCRIPT${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API script found${NC}"
echo ""

# Backup existing service files
echo "[2/8] Backing up existing service files..."
echo "─────────────────────────────────────────────────────────────────────────────"
cp /etc/systemd/system/binance-funding-ws.service /etc/systemd/system/binance-funding-ws.service.backup.$(date +%s) 2>/dev/null || true
cp /etc/systemd/system/binance-funding-api.service /etc/systemd/system/binance-funding-api.service.backup.$(date +%s) 2>/dev/null || true
echo -e "${GREEN}✓ Backups created${NC}"
echo ""

# Create/update WebSocket daemon service file
echo "[3/8] Creating WebSocket daemon service file..."
echo "─────────────────────────────────────────────────────────────────────────────"
cat > /etc/systemd/system/binance-funding-ws.service << 'EOF'
[Unit]
Description=Binance Funding Rate WebSocket Daemon
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/binance_funding_ws_daemon.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Prevent too many restarts
StartLimitIntervalSec=60
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
EOF
echo -e "${GREEN}✓ WebSocket daemon service file created${NC}"
echo ""

# Create/update API server service file
echo "[4/8] Creating API server service file..."
echo "─────────────────────────────────────────────────────────────────────────────"
cat > /etc/systemd/system/binance-funding-api.service << 'EOF'
[Unit]
Description=Binance Funding Rate HTTP API Server
After=network.target binance-funding-ws.service
Requires=binance-funding-ws.service

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/funding_api_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
echo -e "${GREEN}✓ API server service file created${NC}"
echo ""

# Set correct ownership
echo "[5/8] Setting correct ownership..."
echo "─────────────────────────────────────────────────────────────────────────────"
chown -R trader:trader "$TARGET_DIR"
echo -e "${GREEN}✓ Ownership set to trader:trader${NC}"
echo ""

# Reload systemd
echo "[6/8] Reloading systemd daemon..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl daemon-reload
echo -e "${GREEN}✓ Systemd daemon reloaded${NC}"
echo ""

# Stop services
echo "[7/8] Stopping services..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl stop binance-funding-ws 2>/dev/null || true
systemctl stop binance-funding-api 2>/dev/null || true
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

# Remove old state files from incorrect locations
echo "Removing old state files from incorrect locations..."
find /home -name ".funding_state.json" -not -path "${TARGET_DIR}/.funding_state.json" -delete 2>/dev/null || true
echo -e "${GREEN}✓ Old state files removed${NC}"
echo ""

# Start services
echo "[8/8] Starting services..."
echo "─────────────────────────────────────────────────────────────────────────────"
systemctl start binance-funding-ws
sleep 2
systemctl start binance-funding-api
sleep 2
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Check status
echo "════════════════════════════════════════════════════════════════════════════"
echo "  Services Status"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

echo "WebSocket Daemon:"
systemctl status binance-funding-ws --no-pager -l | head -15
echo ""

echo "API Server:"
systemctl status binance-funding-api --no-pager -l | head -15
echo ""

# Wait for data to accumulate
echo "Waiting 10 seconds for data to accumulate..."
sleep 10

# Test health endpoint
echo "════════════════════════════════════════════════════════════════════════════"
echo "  Health Check"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
curl -s http://localhost:8888/funding/health | python3 -m json.tool || echo "Health endpoint not responding"
echo ""

# Check state file
echo "════════════════════════════════════════════════════════════════════════════"
echo "  State File"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
if [ -f "${TARGET_DIR}/.funding_state.json" ]; then
    echo -e "${GREEN}✓ State file exists at: ${TARGET_DIR}/.funding_state.json${NC}"
    ls -lh "${TARGET_DIR}/.funding_state.json"
    echo ""
    echo "State file preview (connection_status):"
    python3 << 'PYTHON_EOF'
import json
try:
    with open("/home/trader/volume-spike-bot/.funding_state.json", "r") as f:
        data = json.load(f)
        print(json.dumps(data.get("connection_status", {}), indent=2))
        print(f"\nTotal symbols: {len(data.get('funding_state', {}))}")
        if data.get('funding_state'):
            sample_symbols = list(data['funding_state'].keys())[:5]
            print(f"Sample symbols: {', '.join(sample_symbols)}")
except Exception as e:
    print(f"Error reading state file: {e}")
PYTHON_EOF
else
    echo -e "${RED}✗ State file not found at: ${TARGET_DIR}/.funding_state.json${NC}"
fi
echo ""

echo "════════════════════════════════════════════════════════════════════════════"
echo "  Fix Complete!"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Both services are now using the same WorkingDirectory:"
echo "  ${TARGET_DIR}"
echo ""
echo "State file location:"
echo "  ${TARGET_DIR}/.funding_state.json"
echo ""
echo "Monitor logs:"
echo "  journalctl -u binance-funding-ws -f"
echo "  journalctl -u binance-funding-api -f"
echo ""
echo "Test health:"
echo "  curl http://localhost:8888/funding/health | python3 -m json.tool"
echo ""
echo "Test single symbol:"
echo "  curl http://localhost:8888/funding/BTCUSDT | python3 -m json.tool"
echo ""
