# Binance WebSocket Funding Rate Service - Implementation Steps

## Phase 1: WebSocket Daemon Implementation

### Step 1.1: Create WebSocket Daemon Skeleton
- [ ] Create `Digital Ocean/binance_funding_ws_daemon.py`
- [ ] Set up basic structure with imports
- [ ] Define `funding_state` dictionary and lock
- [ ] Create main function skeleton

### Step 1.2: Implement WebSocket Connection
- [ ] Install `websocket-client` library (add to requirements if needed)
- [ ] Implement `connect_websocket()` function
- [ ] Connect to `wss://fstream.binance.com/stream?streams=!markPrice@arr`
- [ ] Test connection and verify it works

### Step 1.3: Implement Message Parsing
- [ ] Implement `on_message()` callback
- [ ] Parse JSON message structure
- [ ] Extract symbol, markPrice, fundingRate, nextFundingTime, indexPrice
- [ ] Update `funding_state` dictionary with thread-safe lock
- [ ] Test with real WebSocket messages

### Step 1.4: Implement Error Handling
- [ ] Implement `on_error()` callback
- [ ] Implement `on_close()` callback
- [ ] Add logging for errors and disconnects
- [ ] Test error scenarios

### Step 1.5: Implement Auto-Reconnection
- [ ] Implement `reconnect_with_backoff()` function
- [ ] Add exponential backoff (1s, 2s, 4s, 8s, max 60s)
- [ ] Test reconnection after disconnect
- [ ] Verify state persists across reconnections

### Step 1.6: Add Data Freshness Tracking
- [ ] Add `updatedAt` timestamp to each symbol entry
- [ ] Implement stale data detection (>3 minutes)
- [ ] Log warnings for stale data
- [ ] Test stale data detection

### Step 1.7: Add Thread-Safe Getters
- [ ] Implement `get_funding_data(symbol)` function
- [ ] Use lock for thread-safe reads
- [ ] Return None if symbol not found
- [ ] Test concurrent access

## Phase 2: HTTP API Server Implementation

### Step 2.1: Create HTTP API Server Skeleton
- [ ] Create `Digital Ocean/funding_api_server.py`
- [ ] Install FastAPI (or Flask) library
- [ ] Set up basic FastAPI app
- [ ] Configure to listen on localhost:8888 only

### Step 2.2: Implement Single Symbol Endpoint
- [ ] Implement `GET /funding/:symbol` endpoint
- [ ] Read from WebSocket daemon's `funding_state`
- [ ] Check data freshness
- [ ] Return 200 with data, 404 if not found, 503 if stale
- [ ] Test endpoint manually

### Step 2.3: Implement Batch Endpoint
- [ ] Implement `GET /funding/batch?symbols=...` endpoint
- [ ] Parse comma-separated symbols
- [ ] Fetch data for each symbol
- [ ] Return array with found/missing indicators
- [ ] Test with multiple symbols

### Step 2.4: Implement Health Check Endpoint
- [ ] Implement `GET /funding/health` endpoint
- [ ] Check WebSocket connection status
- [ ] Calculate data freshness metrics
- [ ] Return health status (200 healthy, 503 unhealthy)
- [ ] Test health endpoint

### Step 2.5: Add Error Handling
- [ ] Add try/except blocks for all endpoints
- [ ] Return proper HTTP status codes
- [ ] Add error logging
- [ ] Test error scenarios

### Step 2.6: Performance Optimization
- [ ] Optimize batch endpoint for large symbol lists
- [ ] Add response caching if needed
- [ ] Measure response times
- [ ] Ensure <10ms for single symbol, <100ms for batch

## Phase 3: Integration with Volume Alert Script

### Step 3.1: Add WebSocket Fetch Function
- [ ] Add `fetch_funding_from_ws()` function to `hourly_volume_alert_dual_env.py`
- [ ] Call HTTP API endpoint
- [ ] Handle errors gracefully
- [ ] Return None on failure

### Step 3.2: Add Comparison Function
- [ ] Add `compare_funding_data()` function
- [ ] Calculate difference percentage
- [ ] Log matches and mismatches
- [ ] Alert on significant discrepancies (>0.1%)

### Step 3.3: Modify Scan Function
- [ ] Keep existing REST API call
- [ ] Add WebSocket API call
- [ ] Compare both values
- [ ] Use WebSocket data for alert payload
- [ ] Fallback to REST if WebSocket unavailable

### Step 3.4: Add Comparison Metrics
- [ ] Track total comparisons
- [ ] Track matches vs mismatches
- [ ] Track average difference
- [ ] Log summary every 100 comparisons

### Step 3.5: Test Integration
- [ ] Run volume alert script
- [ ] Verify both REST and WS calls work
- [ ] Verify comparison logging works
- [ ] Verify alerts use WS data

## Phase 4: Integration with OI Realtime Poller

### Step 4.1: Add WebSocket Fetch Function
- [ ] Add `fetch_mark_price_from_ws()` function to `oi_realtime_poller.py`
- [ ] Call HTTP API endpoint
- [ ] Handle errors gracefully
- [ ] Return None on failure

### Step 4.2: Modify Fetch OI Function
- [ ] Keep existing REST API call (optional)
- [ ] Add WebSocket API call
- [ ] Compare both values
- [ ] Use WebSocket data for USD notional
- [ ] Fallback to REST if WebSocket unavailable

### Step 4.3: Add Comparison Logging
- [ ] Log mark price comparisons
- [ ] Track differences
- [ ] Alert on significant discrepancies

### Step 4.4: Test Integration
- [ ] Run OI poller script
- [ ] Verify both REST and WS calls work
- [ ] Verify comparison logging works
- [ ] Verify USD notional uses WS data

## Phase 5: Validation & Testing

### Step 5.1: Deploy Services
- [ ] Deploy WebSocket daemon as systemd service
- [ ] Deploy HTTP API server as systemd service
- [ ] Verify both services start correctly
- [ ] Verify services restart on failure

### Step 5.2: Run Parallel Validation
- [ ] Start volume alert script (with both REST and WS)
- [ ] Start OI poller script (with both REST and WS)
- [ ] Let run for 24+ hours
- [ ] Monitor logs for discrepancies

### Step 5.3: Generate Validation Report
- [ ] Create script to parse comparison logs
- [ ] Calculate statistics:
  - Total comparisons
  - Matches vs mismatches
  - Average difference percentage
  - Maximum difference observed
  - Distribution of differences
- [ ] Generate report file

### Step 5.4: Review Validation Results
- [ ] Review validation report
- [ ] Check for any significant discrepancies
- [ ] Verify average difference <0.1%
- [ ] Verify no systematic errors
- [ ] Make go/no-go decision

## Phase 6: Production Migration

### Step 6.1: Remove REST API Calls (Volume Alert)
- [ ] Remove `premiumIndex` REST call from `scan()` function
- [ ] Remove comparison logging
- [ ] Use WebSocket data exclusively
- [ ] Keep fallback to REST if WS unavailable (rare)
- [ ] Test script runs correctly

### Step 6.2: Remove REST API Calls (OI Poller)
- [ ] Remove `premiumIndex` REST call from `fetch_oi_for_symbol()` function
- [ ] Remove comparison logging
- [ ] Use WebSocket data exclusively
- [ ] Keep fallback to REST if WS unavailable (rare)
- [ ] Test script runs correctly

### Step 6.3: Monitor Production
- [ ] Deploy updated scripts
- [ ] Monitor for 7+ days
- [ ] Verify no increase in errors
- [ ] Verify API weight reduction
- [ ] Verify data quality maintained

### Step 6.4: Cleanup
- [ ] Remove comparison code (optional, keep for future reference)
- [ ] Update documentation
- [ ] Archive validation reports
- [ ] Mark feature as complete

## Testing Checklist

### Unit Tests
- [ ] WebSocket message parsing
- [ ] State dictionary updates
- [ ] Thread-safe access
- [ ] HTTP API endpoints
- [ ] Error handling

### Integration Tests
- [ ] WebSocket → HTTP API data flow
- [ ] Volume alert script → HTTP API
- [ ] OI poller → HTTP API
- [ ] Reconnection scenarios
- [ ] Stale data handling

### Validation Tests
- [ ] 24-hour parallel run
- [ ] Data comparison accuracy
- [ ] Performance under load
- [ ] Error recovery

## Deployment Checklist

### Pre-Deployment
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Environment variables configured
- [ ] Systemd service files created

### Deployment
- [ ] Deploy WebSocket daemon
- [ ] Deploy HTTP API server
- [ ] Verify services running
- [ ] Verify health endpoints responding
- [ ] Update volume alert script
- [ ] Update OI poller script

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Verify WebSocket connected
- [ ] Verify HTTP API responding
- [ ] Verify scripts using WS data
- [ ] Verify API weight reduction
- [ ] Monitor for 24+ hours

## Rollback Plan

If issues arise during production migration:

1. **Immediate Rollback**: Revert scripts to use REST API only
   - Restore original `scan()` function
   - Restore original `fetch_oi_for_symbol()` function
   - Restart scripts

2. **Investigate Issues**: 
   - Check WebSocket daemon logs
   - Check HTTP API logs
   - Check script logs
   - Identify root cause

3. **Fix and Retry**:
   - Fix identified issues
   - Re-test in validation mode
   - Re-attempt migration

## Success Metrics

### Phase 1-2 (Development)
- ✅ WebSocket daemon connects and receives data
- ✅ HTTP API responds correctly
- ✅ All endpoints working

### Phase 3-4 (Integration)
- ✅ Scripts use both REST and WS
- ✅ Comparison logging works
- ✅ No script errors

### Phase 5 (Validation)
- ✅ 24+ hours parallel run successful
- ✅ Average difference <0.1%
- ✅ No systematic errors

### Phase 6 (Production)
- ✅ REST API calls eliminated
- ✅ API weight reduced by ~80 calls/min
- ✅ No increase in errors
- ✅ Data quality maintained

