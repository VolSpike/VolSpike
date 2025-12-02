# How to Check Validation Results After Overnight Run

## Quick Status Check

Run this command to get a quick overview:

```bash
echo "=== Services Status ===" && \
sudo systemctl is-active binance-funding-ws.service binance-funding-api.service volspike.service && \
echo "" && \
echo "=== Comparison Statistics ===" && \
MATCHES=$(sudo journalctl -u volspike.service --since "24 hours ago" | grep -c "Funding match" 2>/dev/null || echo "0") && \
MISMATCHES=$(sudo journalctl -u volspike.service --since "24 hours ago" | grep -c "Funding mismatch" 2>/dev/null || echo "0") && \
TOTAL=$((MATCHES + MISMATCHES)) && \
echo "Total comparisons (24h): $TOTAL" && \
echo "Matches: $MATCHES" && \
echo "Mismatches: $MISMATCHES" && \
if [ $TOTAL -gt 0 ]; then \
  MATCH_RATE=$(echo "scale=2; $MATCHES * 100 / $TOTAL" | bc) && \
  echo "Match rate: $MATCH_RATE%" && \
  echo "" && \
  echo "=== Latest Comparison Summary ===" && \
  sudo journalctl -u volspike.service --since "24 hours ago" | grep -A 10 "Funding Comparison Summary" | tail -15; \
fi
```

## Detailed Analysis

### 1. Extract All Comparison Data

```bash
# Extract all matches and mismatches
sudo journalctl -u volspike.service --since "24 hours ago" | \
  grep -E "Funding match|Funding mismatch" > /tmp/all_comparisons.txt

# Count statistics
wc -l /tmp/all_comparisons.txt
```

### 2. View Comparison Summary (if appeared)

```bash
# Check for comparison summaries (logged every 100 comparisons)
sudo journalctl -u volspike.service --since "24 hours ago" | \
  grep -A 10 "Funding Comparison Summary"
```

### 3. Analyze Mismatches

```bash
# Extract all mismatches with details
sudo journalctl -u volspike.service --since "24 hours ago" | \
  grep "Funding mismatch" > /tmp/mismatches.txt

# Count mismatches
echo "Total mismatches: $(wc -l < /tmp/mismatches.txt)"

# Show worst mismatches (highest difference)
grep "Funding mismatch" /tmp/mismatches.txt | \
  awk -F'diff=' '{print $2}' | \
  awk '{print $1}' | \
  sort -rn | head -10

# Show symbols with most mismatches
grep "Funding mismatch" /tmp/mismatches.txt | \
  awk '{print $NF}' | \
  cut -d: -f1 | \
  sort | uniq -c | sort -rn | head -20
```

### 4. Generate Validation Report

```bash
# Collect all logs
sudo journalctl -u volspike.service --since "24 hours ago" > /tmp/volume_alert_24h.log

# Generate report
python3 validate_funding_comparison.py /tmp/volume_alert_24h.log
```

### 5. Check Data Freshness

```bash
# Check health endpoint
curl http://localhost:8888/funding/health | python3 -m json.tool

# Check a few symbols
curl http://localhost:8888/funding/BTCUSDT | python3 -m json.tool | grep ageSeconds
curl http://localhost:8888/funding/ETHUSDT | python3 -m json.tool | grep ageSeconds
```

### 6. Check WebSocket Connection Stability

```bash
# Count disconnections in last 24 hours
sudo journalctl -u binance-funding-ws.service --since "24 hours ago" | \
  grep -c "WebSocket disconnected"

# Count reconnections
sudo journalctl -u binance-funding-ws.service --since "24 hours ago" | \
  grep -c "Reconnecting in"

# Show disconnection pattern
sudo journalctl -u binance-funding-ws.service --since "24 hours ago" | \
  grep -E "WebSocket disconnected|ping/pong timed out" | \
  tail -20
```

## Expected Results

### Good Results (Validation Passing)
- **Match rate**: >99%
- **Average difference**: <0.1%
- **Maximum difference**: <1.0% (with few outliers)
- **Total comparisons**: Thousands (depending on scan frequency)
- **WebSocket uptime**: >95% (minimal disconnections)

### Concerning Results (Need Investigation)
- **Match rate**: <95%
- **Average difference**: >0.5%
- **Systematic mismatches**: Same symbols always mismatching
- **Frequent disconnections**: Every few minutes
- **Data gaps**: Long periods without updates

## Decision Criteria

### ✅ Safe to Switch to WebSocket-Only If:
- Match rate >99%
- Average difference <0.1%
- Maximum difference <1.0% (with few outliers)
- WebSocket stable (>95% uptime)
- No systematic errors

### ⚠️ Need More Validation If:
- Match rate 95-99%
- Average difference 0.1-0.5%
- Some systematic mismatches
- Occasional disconnections

### ❌ Do Not Switch If:
- Match rate <95%
- Average difference >0.5%
- Systematic errors
- Frequent disconnections
- Data quality issues

## Generate Full Report

```bash
# Create comprehensive report
cat > /tmp/generate_report.sh << 'EOF'
#!/bin/bash
echo "=========================================="
echo "Binance WebSocket Funding Validation Report"
echo "Generated: $(date)"
echo "=========================================="
echo ""

echo "=== Services Status ==="
sudo systemctl is-active binance-funding-ws.service binance-funding-api.service volspike.service
echo ""

echo "=== Comparison Statistics (24h) ==="
MATCHES=$(sudo journalctl -u volspike.service --since "24 hours ago" | grep -c "Funding match" 2>/dev/null || echo "0")
MISMATCHES=$(sudo journalctl -u volspike.service --since "24 hours ago" | grep -c "Funding mismatch" 2>/dev/null || echo "0")
TOTAL=$((MATCHES + MISMATCHES))
echo "Total comparisons: $TOTAL"
echo "Matches: $MATCHES"
echo "Mismatches: $MISMATCHES"
if [ $TOTAL -gt 0 ]; then
  MATCH_RATE=$(echo "scale=2; $MATCHES * 100 / $TOTAL" | bc)
  echo "Match rate: $MATCH_RATE%"
fi
echo ""

echo "=== WebSocket Stability (24h) ==="
DISCONNECTIONS=$(sudo journalctl -u binance-funding-ws.service --since "24 hours ago" | grep -c "WebSocket disconnected" 2>/dev/null || echo "0")
RECONNECTIONS=$(sudo journalctl -u binance-funding-ws.service --since "24 hours ago" | grep -c "Reconnecting in" 2>/dev/null || echo "0")
echo "Disconnections: $DISCONNECTIONS"
echo "Reconnections: $RECONNECTIONS"
echo ""

echo "=== Latest Comparison Summary ==="
sudo journalctl -u volspike.service --since "24 hours ago" | grep -A 10 "Funding Comparison Summary" | tail -15
echo ""

echo "=== Health Check ==="
curl -s http://localhost:8888/funding/health | python3 -m json.tool | head -10
EOF

chmod +x /tmp/generate_report.sh
/tmp/generate_report.sh > /tmp/validation_report.txt
cat /tmp/validation_report.txt
```

