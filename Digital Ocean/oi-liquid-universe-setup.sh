#!/bin/bash
# Setup script for liquid universe job using systemd timer (better than cron)

set -e

echo "🔧 Setting up liquid universe job with systemd timer..."

# Create oneshot service file
sudo tee /etc/systemd/system/oi-liquid-universe.service > /dev/null <<EOF
[Unit]
Description=VolSpike Liquid Universe Classification Job
After=network.target

[Service]
Type=oneshot
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/oi_liquid_universe_job.py

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create timer file (runs every 5 minutes)
sudo tee /etc/systemd/system/oi-liquid-universe.timer > /dev/null <<EOF
[Unit]
Description=Run Liquid Universe Job every 5 minutes
Requires=oi-liquid-universe.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start timer
sudo systemctl enable oi-liquid-universe.timer
sudo systemctl start oi-liquid-universe.timer

echo "✅ Setup complete!"
echo ""
echo "Check status:"
echo "  sudo systemctl status oi-liquid-universe.timer"
echo "  sudo systemctl status oi-liquid-universe.service"
echo ""
echo "View logs:"
echo "  sudo journalctl -u oi-liquid-universe.service -f"
echo ""
echo "List all timers:"
echo "  systemctl list-timers"

