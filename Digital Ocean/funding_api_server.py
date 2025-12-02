"""
Binance Funding Rate HTTP API Server
────────────────────────────────────────────────────────────────────────────
• Exposes REST endpoints for funding rate and mark price data
• Reads from WebSocket daemon's in-memory state
• Provides health check endpoint
• Runs on localhost:8888 only

This server provides HTTP access to the funding data maintained by
binance_funding_ws_daemon.py. Other scripts can query this API instead of
calling Binance REST API directly.
"""

import time
import sys
import json
import threading
from pathlib import Path
from typing import Dict, Optional, Any, List
from datetime import datetime

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.responses import JSONResponse
    import uvicorn
except ImportError:
    print("ERROR: FastAPI and uvicorn libraries not installed")
    print("Install with: pip install fastapi uvicorn")
    sys.exit(1)

# Shared state file (for inter-process communication with WebSocket daemon)
STATE_FILE = Path(__file__).parent / ".funding_state.json"
STALE_THRESHOLD_SEC = 180  # seconds (3 minutes)

# In-memory cache of funding state
funding_state_cache: Dict[str, Dict[str, Any]] = {}
connection_status_cache: Dict[str, Any] = {}
cache_updated_at = 0
cache_lock = threading.Lock()

# ─────────────────────── Configuration ───────────────────────

API_PORT = 8888
API_HOST = "127.0.0.1"  # localhost only
STALE_THRESHOLD_SEC = 180  # seconds (3 minutes)

# ─────────────────────── FastAPI App ───────────────────────

app = FastAPI(
    title="Binance Funding Rate API",
    description="HTTP API for Binance funding rate and mark price data",
    version="1.0.0",
)

# Track server start time
server_start_time = time.time()

# Cache refresh interval (seconds)
CACHE_REFRESH_INTERVAL = 1.0  # Refresh cache every second


# ─────────────────────── Helper Functions ───────────────────────

def load_state_from_file():
    """Load funding state from shared JSON file"""
    global funding_state_cache, connection_status_cache, cache_updated_at
    
    try:
        if not STATE_FILE.exists():
            return
        
        with cache_lock:
            with open(STATE_FILE, 'r') as f:
                data = json.load(f)
                funding_state_cache = data.get("funding_state", {})
                connection_status_cache = data.get("connection_status", {})
                cache_updated_at = time.time()
    except Exception as e:
        # Silent failure - file may not exist yet or be locked
        pass


def get_funding_data(symbol: str) -> Optional[Dict[str, Any]]:
    """Get funding data for a symbol from cache"""
    # Refresh cache if needed
    if time.time() - cache_updated_at > CACHE_REFRESH_INTERVAL:
        load_state_from_file()
    
    with cache_lock:
        return funding_state_cache.get(symbol)


def get_all_symbols() -> List[str]:
    """Get list of all symbols in cache"""
    with cache_lock:
        return list(funding_state_cache.keys())


def get_state_stats() -> Dict[str, Any]:
    """Get statistics about current state"""
    load_state_from_file()
    
    with cache_lock:
        now = time.time()
        symbol_count = len(funding_state_cache)
        
        if symbol_count == 0:
            return {
                "symbolCount": 0,
                "oldestDataAgeSeconds": None,
                "newestDataAgeSeconds": None,
            }
        
        # Find oldest and newest data
        oldest_age = None
        newest_age = None
        
        for symbol_data in funding_state_cache.values():
            age = now - symbol_data["updatedAt"]
            if oldest_age is None or age > oldest_age:
                oldest_age = age
            if newest_age is None or age < newest_age:
                newest_age = age
        
        return {
            "symbolCount": symbol_count,
            "oldestDataAgeSeconds": oldest_age,
            "newestDataAgeSeconds": newest_age,
        }


def is_data_stale(updated_at: float) -> bool:
    """Check if data is stale (older than threshold)"""
    age = time.time() - updated_at
    return age > STALE_THRESHOLD_SEC


def calculate_age(updated_at: float) -> float:
    """Calculate age of data in seconds"""
    return time.time() - updated_at


# ─────────────────────── API Endpoints ───────────────────────

@app.get("/funding/health")
async def get_health():
    """
    Get health status of the service.
    
    Returns:
        - 200 OK: Service healthy
        - 503 Service Unavailable: Service unhealthy (WebSocket disconnected or stale data)
    """
    # Refresh cache
    load_state_from_file()
    
    # Check WebSocket connection status
    ws_connected = connection_status_cache.get("connected", False)
    
    # Get state statistics
    stats = get_state_stats()
    
    # Calculate uptime
    uptime_seconds = time.time() - server_start_time
    
    # Determine health status
    is_healthy = ws_connected and stats["symbolCount"] > 0
    
    if stats["oldestDataAgeSeconds"] is not None:
        is_healthy = is_healthy and stats["oldestDataAgeSeconds"] < STALE_THRESHOLD_SEC
    
    # Build response
    response = {
        "status": "healthy" if is_healthy else "unhealthy",
        "websocketConnected": ws_connected,
        "symbolCount": stats["symbolCount"],
        "uptimeSeconds": round(uptime_seconds, 2),
        "lastConnectedTime": connection_status_cache.get("last_connected_time"),
        "messagesReceived": connection_status_cache.get("messages_received", 0),
        "reconnectAttempts": connection_status_cache.get("reconnect_attempts", 0),
    }
    
    if stats["oldestDataAgeSeconds"] is not None:
        response["oldestDataAgeSeconds"] = round(stats["oldestDataAgeSeconds"], 2)
        response["newestDataAgeSeconds"] = round(stats["newestDataAgeSeconds"], 2)
    
    if not ws_connected:
        last_connected = connection_status_cache.get("last_connected_time")
        if last_connected:
            disconnected_for = time.time() - last_connected
            response["disconnectedForSeconds"] = round(disconnected_for, 2)
        response["error"] = "WebSocket disconnected"
    
    # Return appropriate status code
    if is_healthy:
        return response
    else:
        return JSONResponse(
            status_code=503,
            content=response
        )


@app.get("/funding/{symbol}")
async def get_funding(symbol: str):
    """
    Get funding rate and mark price for a single symbol.
    
    Returns:
        - 200 OK: Data found and fresh
        - 404 Not Found: Symbol not found
        - 503 Service Unavailable: Data stale or WebSocket disconnected
    """
    # Get data from WebSocket daemon
    data = get_funding_data(symbol)
    
    if data is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Symbol not found",
                "symbol": symbol,
            }
        )
    
    # Check if data is stale
    age = calculate_age(data["updatedAt"])
    if is_data_stale(data["updatedAt"]):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Data stale",
                "symbol": symbol,
                "ageSeconds": round(age, 2),
                "maxAgeSeconds": STALE_THRESHOLD_SEC,
            }
        )
    
    # Return data
    return {
        "symbol": symbol,
        "markPrice": data["markPrice"],
        "fundingRate": data["fundingRate"],
        "nextFundingTime": data["nextFundingTime"],
        "indexPrice": data["indexPrice"],
        "updatedAt": data["updatedAt"],
        "ageSeconds": round(age, 2),
    }


@app.get("/funding/batch")
async def get_funding_batch(symbols: str = Query(..., description="Comma-separated list of symbols")):
    """
    Get funding rate and mark price for multiple symbols.
    
    Query Parameters:
        - symbols: Comma-separated list of symbols (e.g., "BTCUSDT,ETHUSDT,SOLUSDT")
    
    Returns:
        - 200 OK: Array of data (some symbols may have errors)
    """
    # Parse symbols
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    
    if not symbol_list:
        raise HTTPException(
            status_code=400,
            detail={"error": "No symbols provided"}
        )
    
    # Fetch data for each symbol
    results = []
    found_count = 0
    missing_count = 0
    
    for symbol in symbol_list:
        data = get_funding_data(symbol)
        
        if data is None:
            results.append({
                "symbol": symbol,
                "error": "Symbol not found",
            })
            missing_count += 1
        elif is_data_stale(data["updatedAt"]):
            age = calculate_age(data["updatedAt"])
            results.append({
                "symbol": symbol,
                "error": "Data stale",
                "ageSeconds": round(age, 2),
                "maxAgeSeconds": STALE_THRESHOLD_SEC,
            })
            missing_count += 1
        else:
            age = calculate_age(data["updatedAt"])
            results.append({
                "symbol": symbol,
                "markPrice": data["markPrice"],
                "fundingRate": data["fundingRate"],
                "nextFundingTime": data["nextFundingTime"],
                "indexPrice": data["indexPrice"],
                "updatedAt": data["updatedAt"],
                "ageSeconds": round(age, 2),
            })
            found_count += 1
    
    return {
        "data": results,
        "found": found_count,
        "missing": missing_count,
        "total": len(symbol_list),
    }


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Binance Funding Rate API",
        "version": "1.0.0",
        "endpoints": {
            "GET /funding/{symbol}": "Get funding data for a single symbol",
            "GET /funding/batch?symbols=...": "Get funding data for multiple symbols",
            "GET /funding/health": "Get service health status",
        },
    }


# ─────────────────────── Main ───────────────────────

def main():
    """Main entry point"""
    print("=" * 70)
    print("Binance Funding Rate HTTP API Server")
    print("=" * 70)
    print(f"Host: {API_HOST}")
    print(f"Port: {API_PORT}")
    print(f"Stale threshold: {STALE_THRESHOLD_SEC}s")
    print("=" * 70)
    print(f"Starting server on http://{API_HOST}:{API_PORT}")
    print("=" * 70)
    
    # Run server
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()

