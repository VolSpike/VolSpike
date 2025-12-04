# Asset Enrichment Guide - Admin Panel

## Overview

The Asset Mappings panel (`/admin/assets`) manages cryptocurrency asset metadata, logos, and CoinGecko mappings for all Binance perpetual futures pairs.

### 🔧 New: description backfill CLI

When descriptions fall behind production data, run the new script inside `volspike-nodejs-backend`:

```
DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts
```

Key flags:

- `--limit=50` – process a subset for testing
- `--symbols=BTC,ETH,SOL` – focus on a few tickers
- `--allow-overwrite` – re-hydrate verified assets (use sparingly)
- `--dry-run` – log intended updates without writing

The script respects CoinGecko rate limits (default 3.5 s delay, exponential back-off on 429s), logs per-asset outcomes, and outputs a summary table when finished.

---

## Understanding the UI Elements

### Status Badge ("AUTO")

**What it means:**
- `AUTO`: Automatically managed assets (synced from Binance, enriched automatically)
- `VERIFIED`: Manually verified and locked from automatic updates
- `HIDDEN`: Hidden from public asset manifest

**Why you see it:**
- All assets synced from Binance default to `AUTO` status
- This allows the system to automatically update logos, names, and links from CoinGecko
- `VERIFIED` assets protect your manual edits from being overwritten

### Status Indicator (Circle with Icon)

The colored icon on each card shows enrichment status:

- **Green checkmark** ✅ **"Complete"**: Has logo, display name, AND CoinGecko ID
- **Yellow warning** ⚠️ **"Missing Logo"**: Has CoinGecko ID and name, but no logo yet
- **Orange warning** 🔶 **"No CoinGecko ID"**: Missing CoinGecko mapping (can't auto-enrich)
- **Blue clock** 🕐 **"Partial"**: Has some data but incomplete

**How to fix:**
1. **Missing Logo**: Click "Refresh" on the asset card, or wait for scheduled enrichment
2. **No CoinGecko ID**: Manually edit the asset and add the correct CoinGecko ID
3. **Partial**: Click "Run Cycle" to trigger enrichment for all pending assets

### "Pending enrichment" Message

**What it means:**
- Asset was just created from Binance sync
- CoinGecko data hasn't been fetched yet
- Waiting for background enrichment cycle to run

**Why it's not instant:**
- CoinGecko has strict rate limits (9-10 API calls/minute on free tier)
- Enrichment processes 15 assets per cycle with 6.5-second gaps between calls
- With 300 assets, full enrichment takes ~3-4 hours

**How to speed it up:**
1. Click **"Run Cycle"** button to manually trigger enrichment (processes 15 assets)
2. Wait 2 minutes, click "Run Cycle" again (another 15 assets)
3. Repeat as needed, or let scheduled background process handle it

---

## Button Functions

### 1. "Sync from Binance" (Blue button with Database icon)

**What it does:**
- Fetches ALL Binance perpetual USDT futures symbols
- Creates new assets for any missing symbols
- Updates Binance symbol mappings for existing assets
- Automatically triggers enrichment for newly created assets

**When to use:**
- Initial setup (empty database)
- When Binance lists new perpetual futures
- To ensure database matches current Binance universe

**Expected result:**
- Toast: "✅ Successfully synced 300 assets from Binance (300 new, 0 updated)"
- Cards appear with "Pending enrichment" for CoinGecko data
- Background enrichment starts automatically

### 2. "Bulk Refresh" (Gray button with RefreshCcw icon)

**What it does:**
- Manually refreshes up to 10 assets that need updating
- Fetches fresh CoinGecko data (logos, names, links)
- Respects rate limits (6.5s between calls)

**When to use:**
- Quick spot-check refresh for a few assets
- Test enrichment on small batch before full cycle

**Expected result:**
- Toast: "Refreshed 10 of 300 assets"
- Updated logos and metadata appear on refreshed cards

### 3. "Run Cycle" (Gray button with RefreshCw icon)  ⭐ **MAIN ENRICHMENT BUTTON**

**What it does:**
- Runs the scheduled asset refresh cycle manually
- Processes up to 15 assets per run (oldest/most outdated first)
- Fetches CoinGecko ID, name, logo, website, Twitter
- Respects strict rate limits (6.5s between calls)
- Takes ~1.5-2 minutes per cycle (15 assets × 6.5s ≈ 98s)

**When to use:**
- **Primary method** to populate CoinGecko data after Binance sync
- After adding new assets manually
- To refresh stale data (assets older than 1 week)

**Expected result:**
- Toast: "Refresh cycle completed: 15 assets refreshed"
- Cards update with logos, names, website/Twitter links
- CoinGecko IDs appear in green boxes

**Pro tip:** Click "Run Cycle" multiple times (wait 2 min between clicks) to process more assets faster than waiting for scheduled runs.

### 4. "Add Asset" (Gray button with Plus icon)

**What it does:**
- Manually add a custom asset not in Binance

**When to use:**
- Rare - most assets come from Binance sync

---

## Enrichment Process Explained

### How CoinGecko Enrichment Works

1. **CoinGecko ID Lookup**:
   - System searches CoinGecko API for asset by symbol (e.g., "BTC")
   - Picks best match based on market cap rank
   - Saves CoinGecko ID (e.g., "bitcoin")

2. **Profile Fetch**:
   - Fetches full coin profile from CoinGecko
   - Extracts: name, logo URL, website, Twitter handle

3. **Logo Caching**:
   - Downloads logo image from CoinGecko CDN
   - Converts to base64 data URL for fast loading
   - Stores in database (no external dependencies)

4. **Update Asset**:
   - Saves all metadata to database
   - Updates `updatedAt` timestamp
   - Asset marked as enriched

### Rate Limiting

CoinGecko free tier limits:
- **10-50 calls/minute** (varies by API key tier)
- **10,000 calls/month** (free tier)

Our conservative settings:
- **6.5 seconds** between calls ≈ 9 calls/minute (safe buffer)
- **15 assets** per cycle (stays well under limits)
- **~1.5 hours** between automatic scheduled cycles

**Math for 300 assets:**
- 300 assets ÷ 15 per cycle = 20 cycles needed
- 20 cycles × 2 minutes per cycle = 40 minutes (if run continuously)
- In practice: **3-4 hours** with scheduled intervals

### Priority Order

Assets are enriched in this order:
1. **Missing data first**: No logo, no name, no CoinGecko ID
2. **Oldest first**: Haven't been updated in >7 days
3. **Status respects**:
   - `AUTO`: Can be updated automatically
   - `VERIFIED`: Skipped (protected from overwrites)
   - `HIDDEN`: Skipped

---

## Workflow: From Empty Database to Fully Enriched

### Step 1: Initial Sync from Binance

```
1. Go to /admin/assets
2. Click "Sync from Binance"
3. Wait ~5-10 seconds
4. See toast: "✅ Successfully synced 300 assets from Binance"
5. Cards appear with "Pending enrichment" messages
```

### Step 2: Trigger Enrichment (Fast Method)

**Option A - Manual Power Run (Fast ⚡)**:
```
1. Click "Run Cycle" → Wait 2 minutes → 15 assets enriched
2. Click "Run Cycle" → Wait 2 minutes → 15 more assets enriched
3. Repeat 20 times to enrich all 300 assets
4. Total time: ~40-50 minutes (if you babysit it)
```

**Option B - Automated (Slow 🐌)**:
```
1. Let scheduled background process run automatically
2. Enriches 15 assets every ~1.5 hours
3. Total time: 3-4 hours (hands-off)
```

**Option C - Hybrid (Recommended 🎯)**:
```
1. Click "Run Cycle" 5-10 times over first hour (75-150 assets enriched)
2. Let background process finish the rest overnight
3. Total time: 1 hour active + background completes rest
```

### Step 3: Verify Results

Check card statuses:
- **Green checkmarks** ✅: Fully enriched (goal state)
- **Yellow warnings** ⚠️: Logo fetch may have failed, click "Refresh" on individual cards
- **Orange warnings** 🔶: CoinGecko couldn't find symbol (may need manual mapping)

---

## Troubleshooting

### Problem: "Pending enrichment" not changing

**Causes:**
1. Background enrichment hasn't run yet (wait or click "Run Cycle")
2. CoinGecko rate limit hit (wait 1 minute, try again)
3. CoinGecko can't find asset by symbol (needs manual CoinGecko ID)

**Solution:**
```
1. Click "Run Cycle" button
2. Wait 2 minutes for toast notification
3. Refresh page to see updated cards
4. Repeat if needed
```

### Problem: Some assets never get enriched

**Causes:**
- Asset symbol doesn't match CoinGecko (e.g., "1000PEPE" on Binance vs "pepe" on CoinGecko)
- CoinGecko doesn't list the asset
- Symbol is too generic (e.g., "CAT" matches multiple coins)

**Solution:**
```
1. Click "Edit" on the asset card
2. Manually enter correct CoinGecko ID (search coingecko.com first)
3. Click "Save"
4. Click "Refresh" on the card to fetch profile
```

**Example:**
- Binance symbol: `1000PEPE` → CoinGecko ID: `pepe`
- Binance symbol: `1000BONK` → CoinGecko ID: `bonk`

### Problem: Logo missing but everything else is there

**Causes:**
- CoinGecko logo URL was broken/expired
- Logo download failed (network error)
- Image conversion to data URL failed

**Solution:**
```
1. Click "Refresh" button on specific asset card
2. System will re-fetch logo from CoinGecko
3. If still fails, manually add logoUrl in edit mode
```

### Problem: "Run Cycle" does nothing

**Check:**
1. Are all assets already enriched? (All green checkmarks)
2. Is rate limit active? (Wait 1-2 minutes)
3. Check Railway logs for errors

**Solution:**
```
# Check Railway logs:
1. Go to Railway dashboard
2. Click on backend service
3. View logs for "[AssetMetadata]" entries
4. Look for errors or "No assets need refresh"
```

---

## Best Practices

### For Initial Setup

1. **Always sync Binance first**: "Sync from Binance" before any enrichment
2. **Use Run Cycle**: Click "Run Cycle" instead of "Bulk Refresh" for consistent results
3. **Be patient**: CoinGecko rate limits are strict, respect them to avoid API blocks
4. **Batch manual runs**: Click "Run Cycle" → wait 2 min → repeat (don't spam)

### For Maintenance

1. **Weekly Binance sync**: Check for new listings every Monday
2. **Let scheduled runs handle updates**: Background process refreshes stale data (>7 days old)
3. **Verify new listings manually**: New coins may need manual CoinGecko ID mapping
4. **Monitor enrichment status**: Dashboard shows "100 need refresh" count

### For Troubleshooting

1. **Check Railway logs first**: Most issues show clear error messages
2. **Verify CoinGecko API is up**: coingecko.com/api/documentation
3. **Don't hammer Run Cycle**: Respect rate limits (2 min between clicks minimum)
4. **Manual edits for edge cases**: Some assets will always need manual mapping

---

## UI Legend

### Card Elements

```
┌─────────────────────────────────────┐
│ AUTO                             ⚠️ │ ← Status badge + indicator
├─────────────────────────────────────┤
│  [LOGO]  BTC                        │ ← Logo + Symbol (bold)
│          Bitcoin                    │ ← Display name
│          BTCUSDT                    │ ← Binance symbol
│                                     │
│ COINGECKO                           │ ← Section label
│ ┌─────────────────────────────────┐ │
│ │ bitcoin                         │ │ ← CoinGecko ID (green if present)
│ └─────────────────────────────────┘ │
│                                     │
│ LINKS                               │ ← Section label
│ [Website] [Twitter]                 │ ← Social links (blue buttons)
│                                     │
│ Updated Today                       │ ← Last update timestamp
│ [Refresh] [Edit] [Delete]           │ ← Action buttons
└─────────────────────────────────────┘
```

### Status Colors

- **Green**: Complete, good state ✅
- **Yellow**: Warning, missing logo ⚠️
- **Orange**: Warning, missing CoinGecko ID 🔶
- **Blue**: Info, partial data 🕐
- **Red**: Error, requires attention ❌

---

## Technical Details

### Database Schema

```prisma
model Asset {
  id            String      @id @default(cuid())
  baseSymbol    String      @unique  // e.g., "BTC"
  binanceSymbol String?              // e.g., "BTCUSDT"
  coingeckoId   String?              // e.g., "bitcoin"
  displayName   String?              // e.g., "Bitcoin"
  logoUrl       String?              // base64 data URL
  websiteUrl    String?              // https://bitcoin.org
  twitterUrl    String?              // https://x.com/bitcoin
  status        AssetStatus @default(AUTO)
  updatedAt     DateTime    @updatedAt
}
```

### API Endpoints Used

**Backend (Railway)**:
- `POST /api/admin/assets/sync-binance` - Sync from Binance
- `POST /api/admin/assets/bulk-refresh` - Bulk refresh (10 assets)
- `POST /api/admin/assets/run-cycle` - Run enrichment cycle (15 assets)
- `POST /api/admin/assets/:id/refresh` - Refresh single asset

**External APIs**:
- `https://fapi.binance.com/fapi/v1/exchangeInfo` - Binance perpetual futures (via proxy)
- `https://api.coingecko.com/api/v3/search?query=BTC` - CoinGecko search
- `https://api.coingecko.com/api/v3/coins/bitcoin` - CoinGecko coin profile

### Background Scheduled Process

**NOT currently implemented** - Enrichment cycles must be triggered manually via "Run Cycle" button or happen automatically after Binance sync.

**To add scheduled enrichment** (future enhancement):
```typescript
// In volspike-nodejs-backend/src/index.ts
import { runAssetRefreshCycle } from './services/asset-metadata'

// Run every 1.5 hours
setInterval(async () => {
    await runAssetRefreshCycle('scheduled')
}, 90 * 60 * 1000) // 90 minutes
```

---

## Summary: Quick Reference

| Element | Meaning | Action |
|---------|---------|--------|
| **AUTO badge** | Automatically managed | Normal state |
| **Green ✅** | Fully enriched | No action needed |
| **Yellow ⚠️** | Missing logo | Click "Refresh" or "Run Cycle" |
| **Orange 🔶** | No CoinGecko ID | Edit card and add CoinGecko ID manually |
| **"Pending enrichment"** | Waiting for CoinGecko fetch | Click "Run Cycle" button |
| **"Sync from Binance" button** | Import all Binance futures | Use once initially, then weekly |
| **"Run Cycle" button** | Enrich 15 assets (2 min) | Main enrichment tool - use repeatedly |
| **"Bulk Refresh" button** | Quick refresh 10 assets | For spot-checking specific assets |

**TL;DR**: After "Sync from Binance", click "Run Cycle" 20 times (2 min intervals) to enrich all 300 assets in ~40 minutes.

---

**Last Updated**: 2025-11-21
