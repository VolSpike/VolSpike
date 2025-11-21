# Testing Guide: Asset Sync & UI

## Quick Start Testing

### Prerequisites
1. Backend running on `http://localhost:3001`
2. Frontend running on `http://localhost:3000`
3. Database accessible (Neon PostgreSQL)
4. Admin account credentials

## Step-by-Step Testing

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd volspike-nodejs-backend
npm run dev

# Wait for these logs:
# ✅ Database ready
# 🚀 VolSpike Backend running on 0.0.0.0:3001
# ✅ Socket.IO attached to HTTP server
```

**Terminal 2 - Frontend:**
```bash
cd volspike-nextjs-frontend
npm run dev

# Wait for:
# ✓ Ready in 2.5s
# ○ Local:   http://localhost:3000
```

### 2. Admin Testing (Full Features)

#### A. Login as Admin
1. Navigate to: `http://localhost:3000/auth`
2. Sign in with admin credentials
3. You should be redirected to `/dashboard`

#### B. Navigate to Asset Management
1. Go to: `http://localhost:3000/admin/assets`
2. Or click "Admin" in sidebar → "Asset Mappings"

**Expected UI:**

**If Database is Empty:**
```
┌────────────────────────────────────────────────────┐
│ Asset Mappings                                     │
│ Manage how Binance perpetual symbols map to...    │
├────────────────────────────────────────────────────┤
│ [Search box] [0 need refresh]                     │
│                                                     │
│ [Card][Table] [Sync from Binance] [Bulk Refresh]  │
│              [Run Cycle] [Add Asset]               │
├────────────────────────────────────────────────────┤
│                                                     │
│           ┌────────┐                               │
│           │   💾   │                               │
│           └────────┘                               │
│                                                     │
│         No assets found                            │
│  Sync all Binance perpetual symbols               │
│         to get started                             │
│                                                     │
│     [💾 Sync from Binance]                         │
│                                                     │
└────────────────────────────────────────────────────┘
```

**If Database Has Assets:**
```
┌────────────────────────────────────────────────────┐
│ Asset Mappings                                     │
│ Manage how Binance perpetual symbols map to...    │
├────────────────────────────────────────────────────┤
│ [Search: BTC, ETH...] [42 need refresh]           │
│                                                     │
│ [Card▼][Table] [Sync from Binance] [Bulk Refresh] │
│                [Run Cycle] [Add Asset]             │
├────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ [🔵 Logo]│ │ [🔵 Logo]│ │ [⚠️ ?]   │          │
│  │ BTC      │ │ ETH      │ │ SOL      │          │
│  │ Bitcoin  │ │ Ethereum │ │ Solana   │          │
│  │ BTCUSDT  │ │ ETHUSDT  │ │ SOLUSDT  │          │
│  │──────────│ │──────────│ │──────────│          │
│  │ bitcoin  │ │ ethereum │ │ solana   │          │
│  │ 🌐 Web   │ │ 🌐 🐦    │ │ 🌐 🐦    │          │
│  │ Today    │ │ Today    │ │ 2d ago   │          │
│  │ [Actions]│ │ [Actions]│ │ [Actions]│          │
│  └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────────────────────────────┘
```

#### C. Test: Sync from Binance

**Action:** Click the blue "Sync from Binance" button

**Expected Behavior:**

1. **Button State Changes:**
   - Button shows spinner: "🔄 Syncing..."
   - Button is disabled
   - Other buttons are disabled

2. **Backend Console Logs:**
   ```bash
   [AdminAssets] 🔄 Manual Binance sync triggered
   [AdminAssets] 📡 Fetching Binance exchange info...
   [AdminAssets] ✅ Binance API response received (status: 200)
   [AdminAssets] 📊 Found 639 total symbols from Binance
   [AdminAssets] 🔍 Filtering perpetual USDT pairs...
   [AdminAssets] ✅ Filtered to 300 valid perpetual USDT pairs
   [AdminAssets] 💾 Fetching existing assets from database...
   [AdminAssets] ✅ Database connected, found 0 existing assets
   [AdminAssets] 📝 Prepared 300 creates, 0 updates
   [AdminAssets] 🚀 Bulk creating 300 new assets...
   [AdminAssets] ✅ Created 300 new assets
   [AdminAssets] ✅ Binance sync completed in 1234ms: 300 created, 0 updated, 0 skipped
   [AdminAssets] 🎨 Triggering background enrichment for 300 new assets...
   [AdminAssets] ✅ Background enrichment completed: 10 assets refreshed
   ```

3. **Frontend Toast Notifications:**
   ```
   ✅ Synced 300 assets from Binance (300 new, 0 updated) - background enrichment started
   ```

4. **UI Updates:**
   - Cards appear immediately with basic info:
     - Symbol (BTC, ETH, SOL, etc.)
     - Binance symbol (BTCUSDT, ETHUSDT, etc.)
     - Placeholder logo (initials like "BTC")
     - Yellow/orange status badges (incomplete data)

5. **Over Next 1-2 Minutes:**
   - Cards update as enrichment completes
   - Logos appear
   - Names populate
   - Status badges turn green ✅
   - Website/Twitter links appear

**Performance Expectations:**
- Sync completes in: **1-3 seconds**
- Cards render in: **< 100ms**
- First 10 logos appear in: **1-2 minutes**
- Remaining logos: Background job (hourly)

#### D. Test: View Toggle

**Action:** Click the table icon button

**Expected:**
- Smooth transition to table view
- All assets shown in spreadsheet format
- Same data as cards
- Editable fields inline

**Action:** Click the card icon button

**Expected:**
- Return to card view
- Same position/scroll maintained

#### E. Test: Search/Filter

**Action:** Type "BTC" in search box

**Expected:**
- Instant filtering (no loading)
- Shows: BTC, WBTC, BTCDOM, STBTC, etc.
- Card count updates
- Maintains view mode (cards/table)

**Action:** Clear search

**Expected:**
- All assets return
- Scroll position resets to top

#### F. Test: Individual Refresh

**Action:** Click "Refresh" button on a card with missing logo

**Expected:**

1. **Button State:**
   - Shows spinner on that card only
   - Other cards remain interactive

2. **Backend API Call:**
   ```bash
   POST http://localhost:3001/api/admin/assets/:id/refresh
   ```

3. **Backend Console:**
   ```bash
   [AdminAssets] Manual refresh requested for SOL
   [AssetMetadata] Fetching CoinGecko data for solana...
   [AssetMetadata] ✅ Updated SOL with CoinGecko data
   ```

4. **UI Updates:**
   - Logo appears
   - Name updates
   - Links populate
   - Status badge turns green
   - Toast: "✅ Successfully refreshed SOL from CoinGecko"

#### G. Test: Bulk Refresh

**Action:** Click "Bulk Refresh" button

**Expected:**

1. **Backend Console:**
   ```bash
   [AdminAssets] Bulk refresh requested for 10 assets
   [AssetMetadata] Refreshing BTC...
   [AssetMetadata] Refreshing ETH...
   ... (up to 10)
   [AdminAssets] ✅ Refreshed 10 of 10 assets
   ```

2. **Toast:**
   ```
   ✅ Refreshed 10 of 42 assets
   ```

3. **UI Updates:**
   - Badge updates: "32 need refresh"
   - Affected cards update with new data

**Performance:**
- Rate limited: ~8 calls/minute to CoinGecko
- Takes: ~1-2 minutes for 10 assets

#### H. Test: Edit Asset

**Action:** Click "Edit" on a card

**Expected:**
- Card enters edit mode
- Fields become editable:
  - Display Name (input)
  - CoinGecko ID (input)
  - Website (input)
  - Twitter (input)
- Buttons change to: [Save] [Cancel]

**Action:** Edit display name, click "Save"

**Expected:**
- Loading spinner on Save button
- Backend API call: `POST /api/admin/assets`
- Card exits edit mode
- Changes persist
- Toast: "✅ Saved BTC"

**Action:** Click "Cancel"

**Expected:**
- Card exits edit mode
- Changes discarded
- No API call

#### I. Test: Delete Asset

**Action:** Click delete button (trash icon)

**Expected:**
1. **Confirmation Dialog:**
   ```
   Delete asset BTC?
   [Cancel] [Delete]
   ```

2. **If Confirmed:**
   - Backend API call: `DELETE /api/admin/assets/:id`
   - Card fades out
   - Removed from list
   - Toast: "✅ Deleted BTC"

#### J. Test: Add Asset Manually

**Action:** Click "Add Asset" button

**Expected:**
- New empty card appears at top
- All fields editable
- No ID yet (will be created on save)

**Action:** Fill in:
- Base Symbol: "CUSTOM"
- Display Name: "My Custom Token"
- CoinGecko ID: "custom-token"

**Action:** Click "Save"

**Expected:**
- Backend creates new asset
- Card gets ID
- Card moves to sorted position
- Toast: "✅ Saved CUSTOM"

### 3. User Testing (Read-Only, Public View)

#### A. Regular User Access

**What Users DON'T See:**
- `/admin/assets` page (redirects to auth)
- Edit/Delete buttons
- Sync/Refresh buttons
- Admin controls

**What Users DO See:**
- Asset logos in dashboard/charts
- Asset names in dropdowns
- Enriched metadata in tooltips

#### B. Test: Asset Display in Dashboard

1. Navigate to: `http://localhost:3000/dashboard`

2. **Expected:**
   - Asset logos visible in charts
   - Asset names in hover tooltips
   - Fast loading (cached manifest)

3. **Backend Endpoint Used:**
   ```
   GET http://localhost:3001/api/assets/manifest
   ```

4. **Response Structure:**
   ```json
   {
     "assets": [
       {
         "baseSymbol": "BTC",
         "binanceSymbol": "BTCUSDT",
         "coingeckoId": "bitcoin",
         "displayName": "Bitcoin",
         "logoUrl": "https://...",
         "websiteUrl": "https://bitcoin.org",
         "twitterUrl": "https://x.com/bitcoin",
         "status": "VERIFIED"
       }
     ],
     "source": "db",
     "staleAfterMs": 604800000
   }
   ```

5. **Frontend Caching:**
   - Check localStorage: `volspike:asset-manifest-v1`
   - TTL: 7 days
   - Automatically refreshes when stale

#### C. Test: Fallback Behavior

**Scenario:** Backend is down

**Expected:**
1. Frontend uses static manifest from `asset-manifest.ts`
2. Shows 7 hardcoded assets (BTC, ETH, SOL, etc.)
3. No errors in console
4. User experience gracefully degraded

### 4. Network Tab Inspection

Open browser DevTools → Network tab

#### During Sync:

**Request:**
```
POST http://localhost:3001/api/admin/assets/sync-binance
Authorization: Bearer <token>
```

**Response (Success):**
```json
{
  "success": true,
  "synced": 300,
  "created": 300,
  "updated": 0,
  "skipped": 0,
  "errors": 0,
  "total": 300,
  "duration": "1234ms",
  "message": "Synced 300 assets from Binance (300 new, 0 updated) - background enrichment started"
}
```

#### During Individual Refresh:

**Request:**
```
POST http://localhost:3001/api/admin/assets/:id/refresh
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "asset": {
    "id": "clx...",
    "baseSymbol": "BTC",
    "binanceSymbol": "BTCUSDT",
    "coingeckoId": "bitcoin",
    "displayName": "Bitcoin",
    "logoUrl": "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    "websiteUrl": "https://bitcoin.org",
    "twitterUrl": "https://x.com/bitcoin",
    "status": "AUTO",
    "updatedAt": "2025-11-21T02:30:00.000Z"
  },
  "message": "Successfully refreshed BTC from CoinGecko"
}
```

### 5. Database Verification

**Query to check assets:**
```sql
-- Connect to Neon PostgreSQL
SELECT
  "baseSymbol",
  "binanceSymbol",
  "displayName",
  "logoUrl",
  "status",
  "updatedAt"
FROM assets
ORDER BY "baseSymbol"
LIMIT 10;
```

**Expected Results:**
```
baseSymbol | binanceSymbol | displayName | logoUrl                  | status | updatedAt
-----------+---------------+-------------+--------------------------+--------+------------------------
1000PEPE   | 1000PEPEUSDT  | Pepe        | https://assets.coin...   | AUTO   | 2025-11-21 02:30:00
AAVE       | AAVEUSDT      | Aave        | https://assets.coin...   | AUTO   | 2025-11-21 02:30:00
ADA        | ADAUSDT       | Cardano     | https://assets.coin...   | AUTO   | 2025-11-21 02:30:00
...
```

**Count total assets:**
```sql
SELECT COUNT(*) FROM assets;
-- Expected: ~300
```

**Check assets needing refresh:**
```sql
SELECT COUNT(*)
FROM assets
WHERE "logoUrl" IS NULL
   OR "displayName" IS NULL
   OR "coingeckoId" IS NULL;
-- Initially: ~290 (only top 10 enriched)
-- After hourly job: decreases
```

### 6. Error Scenarios to Test

#### A. Network Failure

**Test:** Disconnect internet, click "Sync from Binance"

**Expected:**
- Toast error: "❌ Cannot connect to server. Please check your connection."
- Button returns to normal state
- No partial data saved

#### B. Rate Limit (CoinGecko)

**Test:** Click "Bulk Refresh" 3+ times quickly

**Expected:**
- First request: Success
- Subsequent requests: Rate limited (429)
- Toast: "⚠️ CoinGecko rate limit reached. Please wait 60 seconds."
- Background job continues at safe rate

#### C. Invalid CoinGecko ID

**Test:** Edit asset, set coingeckoId to "invalid-id-123", save, refresh

**Expected:**
- Refresh fails gracefully
- Toast: "Failed to refresh asset" (not a crash)
- Asset remains in database
- Status stays yellow/orange

### 7. Performance Benchmarks

**Sync 300 Assets:**
- Target: < 3 seconds
- Acceptable: < 5 seconds
- Poor: > 10 seconds

**Render 300 Cards:**
- Target: < 200ms
- Acceptable: < 500ms
- Poor: > 1 second

**Search Filter:**
- Target: < 50ms
- Acceptable: < 100ms
- Poor: > 200ms

**Individual Refresh:**
- Target: 1-3 seconds (CoinGecko API dependent)
- Acceptable: < 5 seconds
- Poor: > 10 seconds

### 8. Visual Regression Checklist

#### Card View:
- [ ] Cards aligned in grid
- [ ] Logos centered and rounded
- [ ] Status badges visible in top-right
- [ ] Hover effect shows shadow
- [ ] Buttons aligned at bottom
- [ ] Text truncates properly (no overflow)

#### Table View:
- [ ] Headers aligned
- [ ] Columns properly sized
- [ ] Horizontal scroll on small screens
- [ ] Edit fields aligned
- [ ] Action buttons visible

#### Responsive:
- [ ] Mobile (< 768px): 1 column
- [ ] Tablet (768-1024px): 2 columns
- [ ] Desktop (1024-1280px): 3 columns
- [ ] Large (> 1280px): 4 columns

### 9. Accessibility Testing

**Keyboard Navigation:**
- [ ] Tab through cards/table rows
- [ ] Enter to activate buttons
- [ ] Escape to cancel editing

**Screen Reader:**
- [ ] Status badges read aloud
- [ ] Button labels are descriptive
- [ ] Form inputs have labels

**Color Contrast:**
- [ ] Text readable on backgrounds
- [ ] Status colors distinguishable
- [ ] Links have sufficient contrast

### 10. Production Testing

**On Railway (Backend):**
1. Check logs: `https://railway.app/project/<id>/logs`
2. Look for sync completion logs
3. Verify no errors

**On Vercel (Frontend):**
1. Visit: `https://volspike.com/admin/assets`
2. Repeat all admin tests
3. Check performance in Vercel Analytics

## Troubleshooting

### Issue: "No symbols returned from Binance"

**Diagnosis:**
```bash
curl -v "https://fapi.binance.com/fapi/v1/exchangeInfo" | jq '.symbols | length'
# Should return: 639
```

**If fails:** Network/firewall blocking Binance

### Issue: Cards not updating after sync

**Diagnosis:**
1. Check backend logs for enrichment completion
2. Verify `ENABLE_ASSET_ENRICHMENT=true` in env
3. Check CoinGecko rate limit

### Issue: Slow sync (> 10 seconds)

**Diagnosis:**
1. Check database connection latency
2. Verify using bulk operations (not individual creates)
3. Check backend logs for slow queries

---

## Quick Test Script

```bash
# Terminal 1: Start backend
cd volspike-nodejs-backend && npm run dev

# Terminal 2: Start frontend
cd volspike-nextjs-frontend && npm run dev

# Terminal 3: Test backend health
curl http://localhost:3001/health

# Browser:
# 1. Go to http://localhost:3000/admin/assets
# 2. Click "Sync from Binance"
# 3. Wait 2 seconds
# 4. See cards appear
# 5. Click view toggle
# 6. Search "BTC"
# 7. Click refresh on a card

# Expected: All steps succeed with beautiful UI ✅
```

---

**Last Updated**: 2025-11-21
**Status**: Ready for Testing
