# Binance WebSocket Funding Rate Service - Requirements

## Overview
Replace REST API calls to Binance `premiumIndex` endpoint with WebSocket-based data streaming to reduce API weight and improve efficiency on Digital Ocean server.

## Problem Statement

### Current State
- **Volume Alert Script** (`hourly_volume_alert_dual_env.py`):
  - Calls `premiumIndex` REST endpoint once per symbol per 5-minute scan for funding rate
  - Calls `premiumIndex` REST endpoint once per symbol per 5-minute scan for mark price (in OI snapshot)
  - For ~200 perpetuals: ~40 premiumIndex calls/min for volume alerts + ~40 premiumIndex calls/min for OI = **~80 calls/min**

- **OI Realtime Poller** (`oi_realtime_poller.py`):
  - Optionally calls `premiumIndex` REST endpoint per symbol per poll for mark price
  - Can add significant additional API weight depending on polling frequency

### API Weight Impact
- Each `premiumIndex` call = 1 API weight
- Current volume: ~80 calls/min = ~4,800 calls/hour = **~115,200 calls/day**
- This consumes significant portion of Binance API rate limits
- Limits headroom for other operations (OI polling, etc.)

## Goals

### Primary Goals
1. **Eliminate REST API calls** for funding rate and mark price data
2. **Replace with WebSocket stream** (`!markPrice@arr`) that provides both funding rate and mark price
3. **Maintain data accuracy** - ensure WebSocket data matches REST API data
4. **Zero downtime migration** - run both approaches in parallel during validation period

### Secondary Goals
1. **Reduce API weight** by ~80 calls/min (~115K calls/day)
2. **Improve data freshness** - WebSocket provides updates every 1-3 seconds vs REST polling
3. **Create reusable service** - other scripts can consume funding/mark price data
4. **Better resilience** - WebSocket auto-reconnects vs manual REST retries

## Requirements

### Functional Requirements

#### FR1: WebSocket Daemon Service
- **FR1.1**: Connect to Binance WebSocket stream `wss://fstream.binance.com/stream?streams=!markPrice@arr`
- **FR1.2**: Parse incoming messages and extract:
  - Symbol (`s`)
  - Mark Price (`p`)
  - Funding Rate (`r`)
  - Next Funding Time (`T`)
  - Index Price (`i`)
- **FR1.3**: Maintain in-memory state dictionary:
  ```python
  {
    "BTCUSDT": {
      "markPrice": 11185.87786614,
      "fundingRate": 0.0003,
      "nextFundingTime": 1562306400000,
      "indexPrice": 11180.5,
      "updatedAt": 1710000000.0  # Unix timestamp
    },
    ...
  }
  ```
- **FR1.4**: Auto-reconnect on disconnect with exponential backoff
- **FR1.5**: Log connection status and errors
- **FR1.6**: Handle stale data detection (data older than 2-3 minutes)

#### FR2: Local HTTP API Service
- **FR2.1**: Expose REST endpoint: `GET /funding/:symbol`
  - Returns latest funding/mark price data for a symbol
  - Returns `404` if symbol not found
  - Returns `503` if data is stale (>3 minutes old)
- **FR2.2**: Expose REST endpoint: `GET /funding/batch?symbols=BTCUSDT,ETHUSDT,...`
  - Returns funding/mark price data for multiple symbols
  - Handles missing symbols gracefully
- **FR2.3**: Expose REST endpoint: `GET /funding/health`
  - Returns service health status
  - Returns connection status (connected/disconnected)
  - Returns data freshness metrics
- **FR2.4**: Run on localhost only (127.0.0.1) for security
- **FR2.5**: Fast response time (<10ms for single symbol lookup)

#### FR3: Integration with Volume Alert Script
- **FR3.1**: Add parallel execution mode:
  - Fetch funding rate from REST API (existing)
  - Fetch funding rate from WebSocket service (new)
  - Compare values and log differences
- **FR3.2**: Use WebSocket data for alert payloads
- **FR3.3**: Fallback to REST API if WebSocket service unavailable or stale
- **FR3.4**: Log comparison metrics (matches, mismatches, differences)
- **FR3.5**: Flag significant discrepancies (>0.1% difference) for review

#### FR4: Integration with OI Realtime Poller
- **FR4.1**: Add parallel execution mode:
  - Fetch mark price from REST API (existing)
  - Fetch mark price from WebSocket service (new)
  - Compare values and log differences
- **FR4.2**: Use WebSocket data for USD notional calculation
- **FR4.3**: Fallback to REST API if WebSocket service unavailable or stale
- **FR4.4**: Log comparison metrics

#### FR5: Validation & Testing
- **FR5.1**: Run both REST and WebSocket approaches in parallel for minimum 24 hours
- **FR5.2**: Compare all data points and log discrepancies
- **FR5.3**: Generate validation report showing:
  - Total comparisons made
  - Matches vs mismatches
  - Average difference percentage
  - Maximum difference observed
- **FR5.4**: Alert on significant discrepancies (>1% difference)
- **FR5.5**: Only switch to WebSocket-only after validation period passes

### Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: WebSocket daemon must handle 200+ symbols without performance degradation
- **NFR1.2**: HTTP API must respond in <10ms for single symbol lookup
- **NFR1.3**: HTTP API must handle batch requests (100+ symbols) in <100ms
- **NFR1.4**: Memory usage should be <50MB for in-memory state

#### NFR2: Reliability
- **NFR2.1**: WebSocket must auto-reconnect within 30 seconds of disconnect
- **NFR2.2**: Service must handle Binance WebSocket rate limits gracefully
- **NFR2.3**: Service must handle malformed messages without crashing
- **NFR2.4**: Service must log all errors for debugging

#### NFR3: Security
- **NFR3.1**: HTTP API must only listen on localhost (127.0.0.1)
- **NFR3.2**: No authentication needed (localhost only)
- **NFR3.3**: Service must not expose sensitive data in logs

#### NFR4: Maintainability
- **NFR4.1**: Code must be well-documented
- **NFR4.2**: Code must follow existing Python style conventions
- **NFR4.3**: Code must include comprehensive error handling
- **NFR4.4**: Code must be testable and include unit tests

## Success Criteria

### Phase 1: Parallel Execution (Validation)
- ✅ WebSocket daemon running and connected
- ✅ HTTP API responding to requests
- ✅ Volume alert script using both REST and WS in parallel
- ✅ OI poller using both REST and WS in parallel
- ✅ Comparison logs showing <0.1% average difference
- ✅ Zero service crashes during 24-hour validation period

### Phase 2: WebSocket-Only (Production)
- ✅ All REST `premiumIndex` calls removed from scripts
- ✅ All scripts using WebSocket service exclusively
- ✅ API weight reduction of ~80 calls/min verified
- ✅ No increase in alert errors or data quality issues
- ✅ Service running stable for 7+ days

## Out of Scope

- **Not in scope**: Replacing other Binance REST API calls (klines, openInterest, etc.)
- **Not in scope**: WebSocket service for other data types (ticker, depth, etc.)
- **Not in scope**: Distributed WebSocket service (single DO server only)
- **Not in scope**: Persistence of funding/mark price data (in-memory only)

## Dependencies

### External Dependencies
- Binance WebSocket API (`wss://fstream.binance.com/stream`)
- Python `websocket-client` or `websockets` library
- Python HTTP server library (FastAPI or Flask)

### Internal Dependencies
- Existing Digital Ocean server infrastructure
- Existing volume alert and OI poller scripts
- Existing logging infrastructure

## Risks & Mitigations

### Risk 1: WebSocket Connection Instability
- **Mitigation**: Implement robust auto-reconnect with exponential backoff
- **Mitigation**: Fallback to REST API if WebSocket unavailable

### Risk 2: Data Mismatch Between REST and WS
- **Mitigation**: Run parallel validation period before switching
- **Mitigation**: Log all discrepancies for analysis
- **Mitigation**: Alert on significant differences

### Risk 3: Service Crashes
- **Mitigation**: Comprehensive error handling
- **Mitigation**: Systemd service with auto-restart
- **Mitigation**: Health check endpoint for monitoring

### Risk 4: Memory Leaks
- **Mitigation**: Use bounded dictionaries (max symbols)
- **Mitigation**: Periodic memory monitoring
- **Mitigation**: Restart service daily if needed

## Timeline

### Week 1: Development
- Day 1-2: WebSocket daemon implementation
- Day 3-4: HTTP API implementation
- Day 5: Integration with volume alert script
- Day 6: Integration with OI poller
- Day 7: Testing and bug fixes

### Week 2: Validation
- Day 1-7: Parallel execution with comparison logging
- Daily: Review comparison reports
- End of week: Decision to proceed with WebSocket-only

### Week 3: Production Migration
- Day 1: Remove REST API calls from scripts
- Day 2-7: Monitor production stability
- End of week: Validation complete

