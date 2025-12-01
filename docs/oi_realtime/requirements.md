# requirements.md

## 1. Current system & context

**On the DigitalOcean droplet** there are (at least) two long-running processes:

1. **Python hourly volume + OI script**

   ```bash
   /home/trader/volume-spike-bot/.venv/bin/python hourly_volume_alert_dual_env.py
   ```

   This script:

   * Runs **every 5 minutes**, aligned to `…:00, :05, :10, …`.
   * For **all Binance USDT-M PERPETUAL, TRADING** symbols:
     * Computes **hourly volume spikes** using 1h `klines`.
     * Emits **volume alerts** (SPIKE / HALF-UPDATE / FULL-UPDATE) to:
       * Console,
       * Telegram,
       * VolSpike backend (PROD + DEV) via `/api/volume-alerts/ingest`.
   * Every 5 minutes, it also:
     * Calls `GET /fapi/v1/openInterest` and `GET /fapi/v1/premiumIndex` for **every active perp**.
     * Computes **Open Interest in contracts and USD**.
     * Sends a bulk snapshot to:
       * `VOLSPIKE_API_URL/api/market/open-interest/ingest` (PROD),
       * `VOLSPIKE_API_URL_DEV/...` (DEV, if configured).

   It talks **directly** to `https://fapi.binance.com` using `requests` and has its own retry logic.

2. **Node Binance proxy service**

   ```bash
   node /home/trader/volume-spike-bot/binance-proxy.js
   ```

   This is a small Express app that:

   * Loads env from `/opt/perps/.env`.
   * Enables CORS based on `ALLOWED_ORIGINS`.
   * Exposes:
     * `GET /health` – simple health check.
     * `GET /api/binance/futures/info` – proxies `https://fapi.binance.com/fapi/v1/exchangeInfo` and returns the result.

   Purpose: a **central, CORS-friendly internal endpoint to obtain the latest Binance Futures exchangeInfo**, i.e. the list and metadata of all futures symbols (including USDT perps). It doesn't do any alerting or OI itself.

**On the VolSpike backend & frontend side** (high-level):

* The backend (Node/TS):
  * Has `POST /api/volume-alerts/ingest` and `POST /api/market/open-interest/ingest`.
  * Stores alerts and OI snapshots.
  * Pushes updates to clients via WebSockets / Socket.IO.

* The frontend (Next.js):
  * Uses those APIs/WebSockets to show:
    * Volume spike alerts,
    * OI charts / stats (currently based on 5-minute snapshots).

---

## 2. Problem statement

We want to introduce **high-quality Open Interest features** without breaking the current system:

1. **Near-real-time Open Interest** (for "liquid" perps):
   * Current OI cadence is **every 5 minutes** for all symbols.
   * We want **5–12 second resolution** for symbols that matter, while obeying Binance API limits.

2. **Dynamic "liquid" symbol set**:
   * Some symbols drift into/out of liquidity.
   * We want to **dynamically maintain** a set of perps that are "liquid enough" based on volume criteria (e.g., 24h quote volume thresholds).
   * Only those will get the expensive, fast OI polling.

3. **Open Interest spike/dump alerts**:
   * Analogous to volume spike alerts, but based on changes in OI over time.
   * Should work on top of the new near-real-time OI stream.

4. **API budget & safety**:
   * Must stay within Binance REST limits per IP.
   * Must account for:
     * Existing Python script's `klines` + OI snapshot usage,
     * New dynamic liquidity job,
     * New realtime OI poller.

5. **Non-disruption**:
   * **Volume alerts must remain untouched** in behavior and payloads.
   * Existing 5m OI snapshot ingestion path must **continue to work** during rollout.
   * New components should be additive and guarded by configuration / feature flags.

6. **Spec-driven & TDD**:
   * Define payloads and endpoint behavior clearly upfront.
   * Implement backend and poller logic with:
     * Unit tests,
     * Integration tests against a dev backend,
     * Simple manual tests using curl and minimal debug web pages.

---

## 3. Goals

**G1 – Preserve existing behavior**

* Volume alerts from `hourly_volume_alert_dual_env.py` remain exactly as they are.
* Existing OI snapshot ingestion continues to function (even if later we down-scope it to save calls).

**G2 – Dynamic "Open Interest liquid universe"**

* Maintain a **dynamic set of Binance USDT-M perps** that qualify as liquid for OI tracking.
* Liquid definition based on **24h quote volume** (from `ticker/24hr`) and possibly hourly volume (from the existing script), with hysteresis.

**G3 – Near-real-time OI for liquid symbols**

* For all symbols in the liquid OI universe:
  * Poll `openInterest` **every 5–12 seconds** (interval auto-adjusted based on set size & rate limits).
  * Maintain short-term OI history in a ring buffer for each symbol.

**G4 – OI spike/dump alerts**

* Detect meaningful OI changes:
  * Compare current OI vs a configurable baseline window (e.g. median OI 30–60 min ago).
  * Threshold on both % change and absolute contracts change.
* Emit alerts into backend via a dedicated or extended endpoint.

**G5 – Centralize symbol metadata through the Binance proxy (where appropriate)**

* Recognize that `binance-proxy.js` already provides `/api/binance/futures/info` → `exchangeInfo`.
* New components that need the list of perps (like backend liquidity classifier) should **prefer** this proxy instead of hitting Binance directly (less CORS pain and easier to swap).

**G6 – Clear visibility & simple verification**

* Debug APIs & simple `/debug/...` UI pages to:
  * Show current liquid universe,
  * Show latest OI per symbol,
  * Show recent OI alerts,
  * Display basic rate-limit usage and symbol counts.

---

## 4. Functional requirements

### 4.1 Volume alerts (unchanged)

* **FR-VA-1**: Keep the volume alert logic, thresholds, and ingestion payload **exactly** as in current `hourly_volume_alert_dual_env.py`.
* **FR-VA-2**: No changes to:
  * `/api/volume-alerts/ingest` contract,
  * Telegram messaging behavior,
  * Console logging semantics.

### 4.2 Liquid OI universe

* **FR-OI-UNIVERSE-1**: Compute liquid OI universe from:
  * `exchangeInfo` (through `binance-proxy.js` or direct HTTP, depending on where the job runs),
  * `ticker/24hr` for 24h quote volume.

* **FR-OI-UNIVERSE-2**: Use configurable thresholds, e.g.:
  * `OI_LIQUID_ENTER_QUOTE_24H`: default 4M USDT,
  * `OI_LIQUID_EXIT_QUOTE_24H`: default 2M USDT (hysteresis).

* **FR-OI-UNIVERSE-3**: Symbols enter the universe when above ENTER threshold and leave when below EXIT threshold.

* **FR-OI-UNIVERSE-4**: Refresh universe at least every 5 minutes.

* **FR-OI-UNIVERSE-5**: Provide `GET /api/market/open-interest/liquid-universe` (backend debug) returning:
  * List of symbols,
  * Their 24h quote volume,
  * Estimated OI polling interval.

### 4.3 Realtime OI polling

* **FR-OI-POLL-1**: A dedicated OI poller process (Python or Node) should:
  * Read the current liquid universe (from Redis/DB).
  * Compute a safe OI polling interval based on:
    * Universe size N,
    * Target max OI requests/minute (e.g. 2,000), leaving room for other jobs.

* **FR-OI-POLL-2**: Poll `GET /fapi/v1/openInterest?symbol=SYM` for each symbol in universe, at the computed interval.

* **FR-OI-POLL-3**: Maintain per-symbol OI history covering at least 1–3 hours at native polling resolution (5–12s).

* **FR-OI-POLL-4**: Periodically batch and POST latest OI to VolSpike backend via `/api/market/open-interest/ingest` with `source="realtime"`.

### 4.4 OI spike/dump alerts

* **FR-OI-ALERT-1**: For each symbol in universe, on each new OI sample:
  * Compute baseline from a configurable window (e.g. [60 min, 30 min] ago).

* **FR-OI-ALERT-2**: Trigger "spike" (UP) or "dump" (DOWN) alert if:
  * `|pctChange|` ≥ configured threshold (e.g. 5–10%), and
  * `|absChange|` ≥ configured minimum contracts delta.

* **FR-OI-ALERT-3**: Enforce per-symbol rate limiting for alerts (e.g. max 1 spike + 1 dump per 15–30 min).

* **FR-OI-ALERT-4**: Send alerts to backend via:
  * Either a new endpoint `/api/open-interest-alerts/ingest`,
  * Or via `/api/volume-alerts/ingest` extended with `metric="OPEN_INTEREST"` and `alertType` fields.

### 4.5 Backend contracts & debug APIs

* **FR-API-1**: `/api/market/open-interest/ingest` must:
  * Accept both legacy OI snapshots (from Python script) and new realtime OI batches.
  * Distinguish them via a `source` field (`"snapshot"`, `"realtime"`, optionally `"snapshot_legacy"`).

* **FR-API-2**: Add or extend endpoints to:
  * Fetch latest OI per symbol,
  * Fetch recent OI samples per symbol,
  * Fetch recent OI alerts.

* **FR-API-3**: All request/response shapes documented and typed in TypeScript (and optionally given OpenAPI descriptions).

---

## 5. Non-functional requirements

* **NFR-1 – No production downtime**:
  * Introduce new behavior behind feature flags.
  * Keep existing Python script and backend flows working at all times.

* **NFR-2 – Rate-limit safety**:
  * Define budget per component.
  * Cap OI requests/minute to keep under Binance REST limit with margin.
  * Use backoff and error handling on 429/5xx.

* **NFR-3 – Observability**:
  * Log:
    * Number of symbols in liquid universe,
    * OI polls/min,
    * API errors,
    * OI alerts/min.
  * Provide `/health`-style endpoints for new services.
  * Reuse existing logging approach as much as possible.

* **NFR-4 – TDD / spec-driven**:
  * Define types and specs before implementing logic.
  * Add unit tests for pure logic (interval calc, liquid set, OI alerts).
  * Add integration tests for backend ingress + DB writing.

---

## 6. Constraints & assumptions

* DO droplet has a single public IP (default Binance limits apply).
* `binance-proxy.js` is already deployed and reachable from backend/other services.
* You have the ability to:
  * Modify VolSpike backend and deploy,
  * Add new processes/scripts to the droplet,
  * Use Redis/Postgres (or at least Postgres) as shared state.

