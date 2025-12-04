#!/bin/bash
# Deploy Bulletproof Funding Data Services
# This script sets up production-grade systemd services with auto-recovery

set -e  # Exit on error

echo "============================================================================"
echo "Deploying Bulletproof Funding Data Services"
echo "============================================================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Configuration
INSTALL_DIR="/home/trader/volume-spike-bot"
SERVICE_DIR="/etc/systemd/system"

echo "📁 Installation directory: $INSTALL_DIR"
echo "📁 Service directory: $SERVICE_DIR"
echo ""

# Step 1: Copy service files
echo "Step 1: Installing systemd service files..."
cp "$INSTALL_DIR/binance-funding-ws.service" "$SERVICE_DIR/"
cp "$INSTALL_DIR/binance-funding-api.service" "$SERVICE_DIR/"
cp "$INSTALL_DIR/funding-health-check.service" "$SERVICE_DIR/"
cp "$INSTALL_DIR/funding-health-check.timer" "$SERVICE_DIR/"

# Set correct permissions
chmod 644 "$SERVICE_DIR/binance-funding-ws.service"
chmod 644 "$SERVICE_DIR/binance-funding-api.service"
chmod 644 "$SERVICE_DIR/funding-health-check.service"
chmod 644 "$SERVICE_DIR/funding-health-check.timer"

echo "✅ Service files installed"
echo ""

# Step 2: Make scripts executable
echo "Step 2: Making scripts executable..."
chmod +x "$INSTALL_DIR/binance_funding_ws_daemon.py"
chmod +x "$INSTALL_DIR/funding_api_server.py"
chmod +x "$INSTALL_DIR/funding_health_monitor.py"
echo "✅ Scripts are executable"
echo ""

# Step 3: Reload systemd
echo "Step 3: Reloading systemd daemon..."
systemctl daemon-reload
echo "✅ Systemd daemon reloaded"
echo ""

# Step 4: Enable services (start on boot)
echo "Step 4: Enabling services to start on boot..."
systemctl enable binance-funding-ws.service
systemctl enable binance-funding-api.service
systemctl enable funding-health-check.timer
echo "✅ Services enabled"
echo ""

# Step 5: Stop existing services (if running)
echo "Step 5: Stopping existing services..."
systemctl stop binance-funding-ws.service 2>/dev/null || true
systemctl stop binance-funding-api.service 2>/dev/null || true
systemctl stop funding-health-check.timer 2>/dev/null || true
echo "✅ Existing services stopped"
echo ""

# Step 6: Start services
echo "Step 6: Starting services..."
systemctl start binance-funding-ws.service
sleep 3
systemctl start binance-funding-api.service
sleep 3
systemctl start funding-health-check.timer
echo "✅ Services started"
echo ""

# Step 7: Check service status
echo "Step 7: Checking service status..."
echo ""

echo "─── WebSocket Daemon ───"
systemctl status binance-funding-ws.service --no-pager --lines=5 || true
echo ""

echo "─── API Server ───"
systemctl status binance-funding-api.service --no-pager --lines=5 || true
echo ""

echo "─── Health Check Timer ───"
systemctl status funding-health-check.timer --no-pager --lines=5 || true
echo ""

# Step 8: Run initial health check
echo "Step 8: Running initial health check..."
echo ""
python3 "$INSTALL_DIR/funding_health_monitor.py" || true
echo ""

# Step 9: Configure sudo permissions for trader user (for health monitor auto-restart)
echo "Step 9: Configuring sudo permissions for health monitor..."
SUDOERS_FILE="/etc/sudoers.d/funding-health-monitor"
cat > "$SUDOERS_FILE" << 'EOF'
# Allow trader user to restart funding services without password
trader ALL=(ALL) NOPASSWD: /bin/systemctl restart binance-funding-ws.service
trader ALL=(ALL) NOPASSWD: /bin/systemctl restart binance-funding-api.service
trader ALL=(ALL) NOPASSWD: /bin/systemctl status binance-funding-ws.service
trader ALL=(ALL) NOPASSWD: /bin/systemctl status binance-funding-api.service
trader ALL=(ALL) NOPASSWD: /bin/systemctl is-active binance-funding-ws.service
trader ALL=(ALL) NOPASSWD: /bin/systemctl is-active binance-funding-api.service
EOF

chmod 440 "$SUDOERS_FILE"
echo "✅ Sudo permissions configured"
echo ""

echo "============================================================================"
echo "✅ Deployment Complete!"
echo "============================================================================"
echo ""
echo "Services Status:"
echo "  • binance-funding-ws.service:  $(systemctl is-active binance-funding-ws.service)"
echo "  • binance-funding-api.service: $(systemctl is-active binance-funding-api.service)"
echo "  • funding-health-check.timer:  $(systemctl is-active funding-health-check.timer)"
echo ""
echo "Next Steps:"
echo "  1. Monitor logs: journalctl -u binance-funding-ws.service -f"
echo "  2. Check health: python3 $INSTALL_DIR/funding_health_monitor.py"
echo "  3. View timer schedule: systemctl list-timers funding-health-check.timer"
echo ""
echo "Features Enabled:"
echo "  ✅ Auto-restart on failure (5-second delay)"
echo "  ✅ Memory limits (512MB max)"
echo "  ✅ Health monitoring (every 60 seconds)"
echo "  ✅ Auto-recovery (health monitor restarts failed services)"
echo "  ✅ Boot-time startup (enabled)"
echo "  ✅ Comprehensive logging (journalctl)"
echo ""
