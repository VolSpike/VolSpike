# implementation_steps.md

> Each step is incremental and designed to be verifiable from a terminal and/or a simple debug page.

> The Python droplet script and `binance-proxy.js` are treated as **existing, live** components.

---

## Step 0 – Add docs and backend scaffolding

**Goal:** Introduce this feature as a named project in the codebase.

1. In VolSpike repo, add:
   * `docs/oi_realtime/requirements.md` (this file),
   * `docs/oi_realtime/design.md`,
   * `docs/oi_realtime/implementation_steps.md`.

2. In backend code:
   * Add folder `src/openInterest/` with empty shells:
     * `openInterest.routes.ts`,
     * `openInterest.service.ts`,
     * `openInterest.types.ts`,
     * `openInterest.liquidUniverse.service.ts`.

**Verification:**
* `ls docs/oi_realtime` shows three files.
* Backend builds with stubs (no runtime changes yet).

---

## Step 1 – Define backend types & DB schema (spec-first)

**Goal:** Lock in data shapes before polling or alerts exist.

1. In `openInterest.types.ts`, define TypeScript interfaces:
   * `OpenInterestSampleInput` (symbol, openInterest, openInterestUsd, markPrice, source?).
   * `OpenInterestIngestRequest` (data[], timestamp, totalSymbols).
   * `OpenInterestAlertInput` (symbol, direction, baseline, current, pctChange, absChange, timestamp, source).

2. Create migrations for:
   * `open_interest_snapshots`,
   * `open_interest_alerts`,
   * `open_interest_liquid_symbols`.

3. Add these to the migration runner.

**TDD:**
* Jest tests that:
  * DTOs serialize/parse as expected.
  * Migration scripts run against a test DB and create tables.

**Manual:**
* Run migrations in local/dev DB.
* `\d open_interest_snapshots` etc. in psql.

---

## Step 2 – Implement `/api/market/open-interest/ingest` v2

**Goal:** Accept both existing snapshot payloads and new realtime OI batches.

1. In `openInterest.routes.ts`:
   * Wire route:
     ```ts
     router.post('/api/market/open-interest/ingest', openInterestController.ingest);
     ```
   * In controller:
     * Parse body as `OpenInterestIngestRequest`.
     * For each `data` item:
       * Insert into `open_interest_snapshots` with:
         * `ts` from request `timestamp`,
         * `source = body.source || 'snapshot'` (if `source` not present).

2. Update frontend `test-oi-post.js` (or create new) to send a sample request matching current Python script output (no `source`).

**TDD:**
* `openInterest.ingest.spec.ts`:
  * Legacy payload (no `source`) → DB row with `source='snapshot'`.
  * New payload with `source='realtime'` → DB row with `source='realtime'`.
  * Invalid payload → 400.

**Manual:**
* `curl` POST a test payload, inspect DB.

---

## Step 3 – Implement OI alert ingest endpoint

**Goal:** Create backend entrypoint for OI spike/dump alerts.

1. In `openInterest.routes.ts`:
   * Add:
     ```ts
     router.post('/api/open-interest-alerts/ingest', openInterestController.ingestAlert);
     ```

2. In controller:
   * Validate against `OpenInterestAlertInput`.
   * Insert into `open_interest_alerts`.

3. Wire a GET debug endpoint (later step) to fetch alerts.

**TDD:**
* `openInterest.alerts.ingest.spec.ts`:
  * Valid → 200 & row exists.
  * Missing fields → 400.

**Manual:**
* `curl -X POST .../api/open-interest-alerts/ingest` with sample JSON.
* Verify row with SQL.

---

## Step 4 – Implement liquid universe classification logic (pure, no Binance yet)

**Goal:** Pure functions to classify liquidity using mocked data.

1. In `openInterest.liquidUniverse.service.ts`:
   * Implement functions:
     * `filterUsdtPerps(exchangeInfo: any): string[]` → list of symbols.
     * `computeLiquidUniverse(perps: string[], tickerStats: Record<string, {quoteVolume: number}>, enter: number, exit: number, currentSet: Set<string>): {newSet: Set<string>, meta: Map<string, {...}>}`.

2. Add unit tests:
   * `openInterest.liquidUniverse.spec.ts`:
     * Given perps & ticker stats:
       * Symbols above ENTER not in `currentSet` → in `newSet`.
       * Symbols below EXIT in `currentSet` → removed.
       * Hysteresis respected.

**Verification:**
* Run Jest tests; all pass.

---

## Step 5 – Wire liquid universe job to real Binance + proxy (staging)

**Goal:** Periodically populate `liquid_oi_universe` using `binance-proxy.js` and `ticker/24hr`.

**CRITICAL ARCHITECTURE NOTE**: Per AGENTS.md, this job MUST run on Digital Ocean, NOT Railway backend. Only Digital Ocean scripts are allowed to call Binance REST API.

1. **On Digital Ocean droplet**, create Python script `oi_liquid_universe_job.py`:
   * Every 5 min:
     * `GET http://<droplet-host>:3002/api/binance/futures/info` → exchangeInfo.
     * `GET https://fapi.binance.com/fapi/v1/ticker/24hr` → 24h stats.
     * Filter to USDT perps.
     * Build `tickerStats` map.
     * Call `computeLiquidUniverse(...)`.
     * Persist results to:
       * Redis: set + per-symbol meta.
       * Postgres: `open_interest_liquid_symbols` upsert.

2. Expose a backend debug endpoint:
   * `GET /api/market/open-interest/liquid-universe`:
     * Reads from Redis or DB,
     * Returns JSON with:
       * `updatedAt`,
       * `enterThreshold`, `exitThreshold`,
       * `symbols: [{symbol, quoteVolume24h, estimatedPollIntervalSec}]`.

**TDD:**
* For service logic, we already have unit tests.
* For the job, add integration test that:
  * Uses stubbed HTTP responses (mock axios/fetch),
  * Produces expected universe.

**Manual:**
* Deploy to staging.
* Hit `curl <staging>/api/market/open-interest/liquid-universe`.

---

## Step 6 – Implement realtime OI poller skeleton (local, stubbed)

**Goal:** Build the shape of the new poller without touching Binance yet.

1. On your dev machine, create `oi_realtime_poller.py` (in repo, e.g. `scripts/oi_realtime_poller.py`):
   * Components:
     * `load_liquid_universe()` – returns a hard-coded list for now.
     * `compute_interval(N)` – same formula as design.
     * `fetch_oi_stub(sym)` – returns random synthetic OI.
     * Ring buffer `oi_history`.
     * `maybe_emit_oi_alert()` – prints alert messages instead of POSTing.

2. CLI entry:
   * `python oi_realtime_poller.py` runs an infinite loop printing OI + synthetic alerts.

**TDD:**
* `test_interval_calculator.py`:
  * For N values, assert intervals are within bounds and respect budget.
* `test_oi_alert_logic.py`:
  * For synthetic history sequences, spike/dump conditions fire correctly.

**Manual:**
* Run locally, watch console.

---

## Step 7 – Connect poller to backend liquid universe (staging), still stub OI

**Goal:** Have poller read real liquid universe from backend, but still not hit Binance.

1. Modify `load_liquid_universe()` in poller:
   * Use `requests` to call:
     ```http
     GET <staging-backend>/api/market/open-interest/liquid-universe
     ```
   * Extract `symbols` array.

2. Keep `fetch_oi_stub(sym)` for now.

3. Run poller locally (pointing to staging backend) and confirm that:
   * Symbol list is nonempty.
   * Computed interval matches expectations for N.

**Manual:**
* Start poller; check logs that show number of symbols & computed interval.

---

## Step 8 – Hook poller to real Binance OI (staging)

**Goal:** Replace stub OI with real `openInterest` calls, but send data only to staging backend.

1. Implement `fetch_oi_for_symbol(sym)`:
   * `GET https://fapi.binance.com/fapi/v1/openInterest?symbol=SYM`.
   * Parse `openInterest` as float.
   * Add retries / error handling.

2. Optionally fetch mark price via:
   * `GET https://fapi.binance.com/fapi/v1/premiumIndex?symbol=SYM`
   * Or skip for now and let backend/frontend multiply `contracts * lastPrice`.

3. Implement `post_oi_batch(samples)`:
   * Build payload that matches `/api/market/open-interest/ingest` with `source='realtime'`.
   * POST to staging backend.

4. Temporarily, disable alert POSTs; only log them.

**TDD:**
* For network functions, use mocking in tests to simulate Binance responses.

**Manual:**
* Run poller against staging with a small N (e.g. top 10 symbols).
* Check DB in staging:
  * `SELECT ... FROM open_interest_snapshots WHERE source='realtime' ORDER BY created_at DESC LIMIT 20;`.

---

## Step 9 – Enable OI alerts in poller (staging)

**Goal:** Emit OI spike/dump alerts to staging backend.

1. Implement `emit_oi_alert(sym, direction, baseline, current, pctChange, absChange, ts)`:
   * Build payload for `/api/open-interest-alerts/ingest`.
   * POST to staging.

2. Integrate with `maybe_emit_oi_alert()`:
   * Check thresholds and rate limit → call `emit_oi_alert()`.

**TDD:**
* Extend `test_oi_alert_logic.py` to cover API call helper (mock requests).

**Manual:**
* Use staging debug SQL or a simple `/debug` endpoint to confirm OI alerts appear for synthetic thresholds (you can temporarily lower thresholds to force alerts).

---

## Step 10 – Backend WebSocket & debug UI

**Goal:** Surface realtime OI + OI alerts for inspection.

1. Backend:
   * Add WebSocket events:
     * `open_interest_update` for latest OI per symbol (or aggregated per timeframe).
     * `open_interest_alert` for alerts.
   * Add debug GET endpoints:
     * `/api/market/open-interest/samples?symbol=BTCUSDT&limit=50`
     * `/api/open-interest-alerts?symbol=BTCUSDT&limit=20`

2. Frontend:
   * Add `/debug/open-interest` page that:
     * Displays liquid universe (API call).
     * Shows streaming latest OI values via WebSocket.
     * Lists recent OI alerts.

**TDD:**
* Jest/React tests for debug page rendering with mocked data.
* Backend integration tests for WebSocket events (optional, or manual).

**Manual:**
* Open `/debug/open-interest` on staging and visually verify behavior.

---

## Step 11 – Production rollout (shadow mode)

**Goal:** Run realtime OI alongside existing system without changing user-facing behavior.

1. Deploy backend changes to PROD with:
   * Feature flag `OPEN_INTEREST_REALTIME_ENABLED=false`.

2. Run OI poller against PROD backend:
   * `post_oi_batch` → PROD `/api/market-open-interest/ingest`.
   * `emit_oi_alert` → PROD `/api/open-interest-alerts/ingest`.

3. Existing Python script continues unchanged.

4. Use debug endpoints and SQL to monitor:
   * `open_interest_snapshots` with `source='realtime'`.
   * `open_interest_alerts`.

5. Monitor API usage vs Binance limits from logs.

---

## Step 12 – Enable realtime OI for Pro/Elite tiers

**Goal:** Switch UI to use realtime OI for high-tier users.

1. In backend:
   * When `OPEN_INTEREST_REALTIME_ENABLED=true`:
     * For Pro/Elite WebSocket connections, stream realtime OI.
     * Use `source='realtime'` samples for charts wherever possible.

2. Frontend:
   * For Pro/Elite accounts:
     * Replace or overlay 5m OI with realtime series.
     * Visualize OI alerts similarly to volume alerts but distinct (color/icon).

3. Keep 5m snapshots as fallback and/or for Free tier.

---

## Step 13 – Optional: Optimize existing Python OI snapshot behavior

**Goal:** Save API calls without breaking anything.

Once realtime pipeline is stable:

1. Modify `hourly_volume_alert_dual_env.py` **carefully** in a small change:
   * Option A: restrict OI snapshot to `liquid_oi_universe` (read from backend).
   * Option B: reduce OI snapshot frequency (e.g. every 15 min).

2. Ensure snapshots are still ingested correctly (as `source='snapshot'` or `source='snapshot_legacy'`).

3. Use tests & logs to confirm we didn't break anything.

---

That's the updated picture wired to the actual droplet setup (`hourly_volume_alert_dual_env.py` + `binance-proxy.js`). You can now drop these three files into your repo and iterate the code to match this spec step-by-step.

