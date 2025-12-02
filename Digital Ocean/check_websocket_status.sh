#!/bin/bash
# Quick script to check WebSocket daemon status

echo "=== WebSocket Daemon Status ==="
sudo systemctl status binance-funding-ws.service --no-pager | head -15

echo ""
echo "=== Recent WebSocket Logs ==="
sudo journalctl -u binance-funding-ws.service -n 20 --no-pager | tail -10

echo ""
echo "=== Health Check ==="
curl -s http://localhost:8888/funding/health | python3 -m json.tool | head -15

echo ""
echo "=== Check State File ==="
if [ -f .funding_state.json ]; then
    echo "State file exists"
    echo "File size: $(ls -lh .funding_state.json | awk '{print $5}')"
    echo "Last modified: $(stat -c %y .funding_state.json)"
    
    # Check if 1000PEPEUSDT is in the file
    if python3 -c "import json; data=json.load(open('.funding_state.json')); print('1000PEPEUSDT found:', '1000PEPEUSDT' in data.get('funding_state', {}))" 2>/dev/null; then
        echo ""
        echo "=== 1000PEPEUSDT Data ==="
        python3 -c "
import json
import time
with open('.funding_state.json', 'r') as f:
    data = json.load(f)
    symbol_data = data.get('funding_state', {}).get('1000PEPEUSDT', {})
    if symbol_data:
        age = time.time() - symbol_data.get('updatedAt', 0)
        print(f\"Funding Rate: {symbol_data.get('fundingRate', 'N/A')}\")
        print(f\"Updated At: {symbol_data.get('updatedAt', 'N/A')}\")
        print(f\"Age: {age:.1f} seconds\")
    else:
        print('Symbol not found in state file')
"
    fi
else
    echo "State file does not exist!"
fi

