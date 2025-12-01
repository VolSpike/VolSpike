# design.md

## 1. Overall architecture (with existing components)

### 1.1 Existing components

* **Python hourly script** (`hourly_volume_alert_dual_env.py`)
  * Responsibilities:
    * Volume spike detection (1h candles).
    * Telegram + VolSpike alert sending.
    * Full-universe OI snapshot every 5 minutes.
  * Integrations:
    * Direct to Binance REST (`fapi.binance.com`).
    * VolSpike backend (`/api/volume-alerts/ingest`, `/api/market/open-interest/ingest`).

* **Node Binance proxy** (`binance-proxy.js`)
  * Responsibilities:
    * Provide CORS-enabled proxy to `exchangeInfo`:
      * `GET /api/binance/futures/info` → `GET https://fapi.binance.com/fapi/v1/exchangeInfo`.
    * Provide `GET /health` status.
  * Integrations:
    * Used by any internal service or frontend that needs the latest futures symbol metadata without hitting Binance directly.

* **VolSpike backend**
  * Responsibilities:
    * Ingest volume alerts and OI snapshots.
    * Store them in DB.
    * Serve them via REST and WebSockets to frontend.
  * Important routes:
    * `POST /api/volume-alerts/ingest`
    * `POST /api/market/open-interest/ingest`

* **VolSpike frontend**
  * Responsibilities:
    * Display volume alerts & OI data.
    * Possibly call `binance-proxy` or backend for symbol lists.

### 1.2 New components

1. **OI Liquidity Classifier Job** (backend job / worker)
   * Runs inside backend or as a Node worker.
   * Uses:
     * `binance-proxy` for latest `exchangeInfo`.
     * Direct call to `GET /fapi/v1/ticker/24hr` (from backend) to get 24h stats.
   * Produces and stores:
     * `liquid_oi_universe` (set of symbols),
     * Per-symbol metadata (24h quote volume, timestamps).

2. **Realtime OI Poller** (Python or Node process on DO)
   * Reads `liquid_oi_universe` from backend/Redis/Postgres.
   * Talks directly to Binance REST (`openInterest`, maybe `premiumIndex`).
   * Maintains local ring buffers for OI history.
   * Posts realtime OI batches to backend.
   * Posts OI spike/dump alerts to backend.

3. **Backend Open Interest module (extended)**
   * Adds logic to:
     * Store `source='realtime'` OI snapshots.
     * Expose debug/diagnostic APIs.
     * Store and expose OI alerts.
     * Feed OI updates to WebSocket clients.

4. **Debug frontend views**
   * Minimal pages like `/debug/open-interest` for internal validation.

---

## 2. Binance interaction design

### 2.1 Using the proxy vs direct calls

* **Proxy (`binance-proxy.js`)** will be used for:
  * `exchangeInfo` in backend jobs and possibly frontend:
    * `GET /api/binance/futures/info`.

* **Direct Binance REST** calls used by:
  * `hourly_volume_alert_dual_env.py` (already in place).
  * New realtime OI poller:
    * `GET /fapi/v1/openInterest?symbol=SYM`.
    * Optionally `GET /fapi/v1/premiumIndex?symbol=SYM`.
  * Backend liquidity job (for `ticker/24hr`).

This separation keeps the proxy focused on symbol metadata and avoids turning it into a bottleneck for high-frequency OI calls.

### 2.2 Rate-limit & budget planning

* Assume Binance REST limit ≈ 2,400 req/min per IP.
* Shared components that hit Binance:
  1. **Python hourly script**:
     * 1h `klines` for volume scan.
     * 5m OI snapshot for all perps.
     * Currently modest usage compared to overall limit.
  2. **Backend liquidity job**:
     * `exchangeInfo` through proxy (weight ~10) every 5–15 min.
     * `ticker/24hr` (weight ~40) every 5 min.
  3. **Realtime OI poller**:
     * Main consumer of OI requests.

* Budget assumption:
  * Reserve ~2,000 req/min for realtime OI poller.
  * Leave ~400 req/min for hourly script, ticker/24hr, retries, etc.

---

## 3. Liquid OI universe design

### 3.1 Data flow

1. **Fetch perps list**:
   * Backend job calls:
     ```http
     GET http://<droplet-host>:3002/api/binance/futures/info
     ```
   * Filters in backend to:
     * `contractType == "PERPETUAL"`,
     * `quoteAsset == "USDT"`,
     * `status == "TRADING"`.

2. **Fetch 24h stats**:
   * Backend job calls Binance directly:
     ```http
     GET https://fapi.binance.com/fapi/v1/ticker/24hr
     ```
   * Builds a map: `symbol -> quoteVolume`.

3. **Classify liquidity**:
   * Configurable ENTER/EXIT thresholds:
     * ENTER: 4M USDT,
     * EXIT: 2M USDT (example defaults).
   * For each USDT perp symbol:
     * If not in universe and `quoteVolume >= ENTER` → add.
     * If in universe and `quoteVolume < EXIT` → remove.
     * If in universe and in between → keep.

4. **Persist universe**:
   * Redis (fast access):
     * Set `oi:liquid_universe` holding symbols.
     * Hash `oi:liquid_meta:<symbol>` with:
       * 24h quote vol,
       * lastUpdated timestamp.
   * Postgres:
     * Table `open_interest_liquid_symbols` for historical tracking and offline analysis.

5. **Expose via backend**:
   * `GET /api/market/open-interest/liquid-universe` → JSON summary.

### 3.2 Consumers

* **Realtime OI poller**:
  * Reads from backend or directly from Redis.
* **Debug UI**:
  * Shows what's considered "liquid" at any moment.

---

## 4. Realtime OI poller design

### 4.1 Process responsibilities

* Runs on DO (same host as Python script & Binance proxy).
* Periodically:
  1. Fetches the liquid universe (from backend `GET /.../liquid-universe` or Redis).
  2. Computes OI polling interval based on N and max requests/minute.
  3. Loops over symbols, calling `openInterest` (and optionally `premiumIndex`).
  4. Pushes latest OI to:
     * Local ring buffers (for OI alerts),
     * Backend `/api/market/open-interest/ingest` as `source="realtime"`.

### 4.2 Interval computation

Given:
* `MAX_REQ_PER_MIN = 2000` (configurable),
* `MIN_INTERVAL_SEC = 5`,
* `MAX_INTERVAL_SEC = 20`,
* `N = len(liquid_symbols)` (≥ 1).

We compute:

```python
polls_per_min_per_symbol = MAX_REQ_PER_MIN / N
raw_interval = 60.0 / polls_per_min_per_symbol
interval_sec = min(
    MAX_INTERVAL_SEC,
    max(MIN_INTERVAL_SEC, int(round(raw_interval)))
)
```

Examples:
* N = 100 → polls_per_min_sym = 20 → raw_interval ≈ 3s → clamped to 5s.
* N = 300 → polls_per_min_sym ≈ 6.67 → raw_interval ≈ 9s.
* N = 400 → polls_per_min_sym = 5 → raw_interval = 12s.

This auto-scales with market activity.

### 4.3 OI storage (ring buffers)

In poller process:

```python
from collections import deque
oi_history: dict[str, deque[tuple[float, float]]] = {}
# symbol -> deque[(timestamp_epoch, oi_contracts)]
# maxlen enough to cover 1–3h at chosen interval
```

* For 10s interval & 3h: maxlen ≈ 3h * 3600/10 ≈ 1080.

Optionally replicate to Redis if we want backend-side alerting later.

### 4.4 Posting OI to backend

On each loop (or every K loops):

* Build batch:
  ```json
  {
    "data": [
      {
        "symbol": "BTCUSDT",
        "openInterest": 123456.0,
        "openInterestUsd": 7890000.0,
        "markPrice": 64000.0,
        "source": "realtime"
      },
      ...
    ],
    "timestamp": "2025-12-01T12:34:56Z",
    "totalSymbols": 150
  }
  ```

* POST to:
  ```http
  POST /api/market/open-interest/ingest
  ```

Backend stores rows in `open_interest_snapshots` with `source='realtime'`.

---

## 5. OI alert engine design

### 5.1 Baseline window & metrics

* For each symbol `sym` and latest sample `(t_now, oi_now)` from `oi_history[sym]`:
  1. Choose a baseline window: `[t_now - W_high, t_now - W_low]`.
     * Example: `[60 min, 30 min]` to avoid using very fresh data.
  2. Extract samples `(t, oi)` where `W_high <= t_now - t <= W_low`.
  3. Baseline OI:
     ```python
     baseline = median([oi for (_, oi) in samples])
     ```

* Compute:
  ```python
  pct_change = (oi_now - baseline) / baseline
  abs_change = oi_now - baseline
  ```

### 5.2 Thresholds & alert conditions

Configurable, but example defaults:
* `OI_SPIKE_THRESHOLD_PCT = 0.05` (5% up).
* `OI_DUMP_THRESHOLD_PCT = 0.05` (5% down).
* `OI_MIN_DELTA_CONTRACTS = 5000` (example; may be scaled by symbol's typical OI).

Conditions:
* Spike (UP):
  ```python
  if pct_change >= OI_SPIKE_THRESHOLD_PCT and abs_change >= OI_MIN_DELTA_CONTRACTS:
      direction = "UP"
  ```
* Dump (DOWN):
  ```python
  if pct_change <= -OI_DUMP_THRESHOLD_PCT and abs_change <= -OI_MIN_DELTA_CONTRACTS:
      direction = "DOWN"
  ```

Also track a dict:

```python
last_oi_alert_at: dict[tuple[str, str], float]
# key = (symbol, direction)
```

to rate-limit alerts.

### 5.3 Alert payload & ingestion

Payload (new endpoint):

```json
{
  "symbol": "BTCUSDT",
  "direction": "UP",
  "baseline": 150000.0,
  "current": 165000.0,
  "pctChange": 0.1,
  "absChange": 15000.0,
  "timestamp": "2025-12-01T12:34:56Z",
  "source": "oi_realtime_poller"
}
```

Backend:
* Validate.
* Write into `open_interest_alerts` table.
* Emit WebSocket event `open_interest_alert`.

Alternative: reuse `volume-alerts` ingest with additional fields.

---

## 6. Backend schema & API design (summary)

### 6.1 Tables

* `open_interest_snapshots`:
  ```sql
  CREATE TABLE open_interest_snapshots (
    id                 bigserial PRIMARY KEY,
    symbol             text NOT NULL,
    ts                 timestamptz NOT NULL,
    open_interest      numeric NOT NULL,
    open_interest_usd  numeric,
    mark_price         numeric,
    source             text NOT NULL DEFAULT 'snapshot', -- or 'realtime'
    created_at         timestamptz NOT NULL DEFAULT now()
  );
  ```

* `open_interest_alerts`:
  ```sql
  CREATE TABLE open_interest_alerts (
    id          bigserial PRIMARY KEY,
    symbol      text NOT NULL,
    direction   text NOT NULL, -- 'UP'|'DOWN'
    baseline    numeric NOT NULL,
    current     numeric NOT NULL,
    pct_change  numeric NOT NULL,
    abs_change  numeric NOT NULL,
    source      text NOT NULL,
    ts          timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  ```

* `open_interest_liquid_symbols`:
  ```sql
  CREATE TABLE open_interest_liquid_symbols (
    symbol            text PRIMARY KEY,
    quote_volume_24h  numeric NOT NULL,
    entered_at        timestamptz NOT NULL,
    last_seen_at      timestamptz NOT NULL
  );
  ```

### 6.2 APIs

* `POST /api/market/open-interest/ingest`:
  * Accepts both snapshot & realtime OI batches.

* `POST /api/open-interest-alerts/ingest`:
  * Accepts OI spike/dump alerts.

* `GET /api/market/open-interest/liquid-universe`:
  * Returns current liquid set & metadata.

* `GET /api/market/open-interest/samples?symbol=...&limit=...`:
  * Returns recent OI samples (debug).

* Optional `GET /api/open-interest-alerts?symbol=...`.

---

## 7. Integration with existing script & proxy

* The existing Python script remains as-is initially.
* The new OI poller is added as a **separate process**.
* The liquidity job uses `binance-proxy.js` for `exchangeInfo`, to avoid rewriting that logic and to re-use an already deployed, CORS-handled endpoint.

Over time, we can choose to:
* Reduce OI snapshot coverage in the Python script (e.g. only liquid symbols, or lower frequency),
* But that is a later optimization, not part of initial rollout.

