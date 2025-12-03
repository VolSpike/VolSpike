#!/bin/bash
################################################################################
# Full WebSocket Daemon Debug - Get ALL Information
################################################################################

echo "════════════════════════════════════════════════════════════════════════════"
echo "  COMPLETE WebSocket Daemon Debug"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Check daemon logs
echo "[1/5] WebSocket Daemon Logs (last 100 lines):"
echo "─────────────────────────────────────────────────────────────────────────────"
journalctl -u binance-funding-ws -n 100 --no-pager
echo ""

# Check API logs
echo "[2/5] API Server Logs (last 50 lines):"
echo "─────────────────────────────────────────────────────────────────────────────"
journalctl -u binance-funding-api -n 50 --no-pager
echo ""

# Check state file
echo "[3/5] State File Details:"
echo "─────────────────────────────────────────────────────────────────────────────"
ls -lh /home/trader/volume-spike-bot/.funding_state.json
echo ""
echo "State file contents:"
cat /home/trader/volume-spike-bot/.funding_state.json
echo ""
echo "State file size in bytes:"
stat -c %s /home/trader/volume-spike-bot/.funding_state.json 2>/dev/null || stat -f %z /home/trader/volume-spike-bot/.funding_state.json
echo ""

# Check process
echo "[4/5] Daemon Process Details:"
echo "─────────────────────────────────────────────────────────────────────────────"
ps aux | grep binance_funding_ws_daemon.py | grep -v grep
echo ""
pgrep -f binance_funding_ws_daemon.py | xargs lsof -p 2>/dev/null | grep -E "(LISTEN|ESTABLISHED|websocket)"
echo ""

# Test WebSocket connection manually
echo "[5/5] Testing WebSocket Library:"
echo "─────────────────────────────────────────────────────────────────────────────"
python3 << 'PYTHON_TEST'
import sys
print(f"Python version: {sys.version}")

try:
    import websocket
    print(f"✓ websocket-client library installed: {websocket.__version__}")
except ImportError as e:
    print(f"✗ websocket-client library NOT installed: {e}")
    sys.exit(1)

# Test if we can connect to Binance
print("\nTesting Binance WebSocket connection...")
try:
    import json
    import time

    ws_url = "wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr"

    message_count = 0

    def on_message(ws, message):
        global message_count
        message_count += 1
        if message_count == 1:
            print(f"✓ First message received! Size: {len(message)} bytes")
            try:
                data = json.loads(message)
                print(f"✓ Message is valid JSON")
                print(f"✓ Data keys: {list(data.keys())}")
                if 'data' in data and isinstance(data['data'], list):
                    print(f"✓ Received {len(data['data'])} items in data array")
                    if data['data']:
                        print(f"✓ First item keys: {list(data['data'][0].keys())[:5]}")
            except:
                print(f"✗ Message is not valid JSON")

        if message_count >= 3:
            print(f"✓ Received {message_count} messages total - WebSocket is working!")
            ws.close()

    def on_error(ws, error):
        print(f"✗ WebSocket error: {error}")

    def on_close(ws, close_status_code, close_msg):
        print(f"WebSocket closed: {close_status_code}")

    def on_open(ws):
        print(f"✓ WebSocket connected to Binance!")

    ws = websocket.WebSocketApp(
        ws_url,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open,
    )

    print("Attempting connection (10 second timeout)...")
    import threading

    def run_ws():
        ws.run_forever(ping_interval=None, ping_timeout=None)

    thread = threading.Thread(target=run_ws)
    thread.daemon = True
    thread.start()

    # Wait max 10 seconds
    thread.join(timeout=10)

    if message_count == 0:
        print("✗ No messages received in 10 seconds - connection failed")

except Exception as e:
    print(f"✗ Error testing WebSocket: {e}")
    import traceback
    traceback.print_exc()
PYTHON_TEST

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "  Debug Complete"
echo "════════════════════════════════════════════════════════════════════════════"
