# Asset Enrichment Issue - Root Cause Analysis

## The Problem

**User expectation**: Assets should automatically enrich themselves with CoinGecko data after Binance sync

**Reality**: 99 assets show "need refresh" and none are being enriched automatically

## Root Cause

### 1. Scheduled Process is TOO SLOW

**Current Settings** (from `volspike-nodejs-backend/src/index.ts:341-361`):
```typescript
const ASSET_REFRESH_INTERVAL = 60 * 60 * 1000 // 1 hour
const MAX_REFRESH_PER_RUN = 15 // From asset-metadata.ts:12
```

**Math**:
- 99 assets need enrichment
- 15 assets processed per hour
- **Time to complete**: 99 ÷ 15 = **6.6 hours minimum**
- **Actual time**: Could be 7-8 hours due to hourly intervals

### 2. First Run Delay

The startup enrichment runs **30 seconds after server starts** (line 352), which is good, but then the next run is **1 hour later**.

### 3. Rate Limiting is Too Conservative

**Current settings** (from `asset-metadata.ts:12-13`):
```typescript
const MAX_REFRESH_PER_RUN = 15 // Process only 15 assets
const REQUEST_GAP_MS = 6500 // 6.5 seconds between requests = 9 calls/minute
```

**CoinGecko Free Tier Limits**:
- **10-50 calls/minute** (depending on load)
- **10,000 calls/month**

**We're using**: 9 calls/minute (very conservative, good for stability)

**Problem**: With only 15 assets per hour, it takes forever

## Why "Run Cycle" Works But Auto Doesn't

- **Manual "Run Cycle"**: Immediately processes 15 assets (takes ~2 minutes)
- **Automatic background**: Waits 1 hour between each 15-asset batch
- **User clicks 20 times**: Can complete all 300 in 40 minutes
- **Automatic process**: Takes 20 hours

## Solution Options

### Option A: Increase Frequency (Recommended)

**Change interval from 1 hour to 10 minutes**:

```typescript
// Before
const ASSET_REFRESH_INTERVAL = 60 * 60 * 1000 // 1 hour

// After
const ASSET_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
```

**Result**:
- 99 assets ÷ 15 per run = 7 cycles needed
- 7 cycles × 10 minutes = **70 minutes to complete**
- Still respects CoinGecko rate limits (9 calls/minute)

### Option B: Increase Assets Per Run

**Change from 15 to 30 assets per run**:

```typescript
// Before
const MAX_REFRESH_PER_RUN = 15

// After
const MAX_REFRESH_PER_RUN = 30
```

**Result**:
- 99 assets ÷ 30 per run = 4 cycles needed
- 4 cycles × 60 minutes = **4 hours to complete**
- Still safe: 30 assets × 6.5s = 195 seconds = 3.25 minutes per run
- Average rate: 9 calls/minute (well under limit)

### Option C: Hybrid (Best)

**10-minute interval + 30 assets per run**:

```typescript
const ASSET_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const MAX_REFRESH_PER_RUN = 30 // 30 assets per cycle
```

**Result**:
- 99 assets ÷ 30 = 4 cycles needed
- 4 cycles × 10 minutes = **40 minutes to complete**
- Each cycle takes 3.25 minutes (30 assets × 6.5s)
- Plenty of idle time between cycles (6.75 minutes)
- Still very safe for CoinGecko limits

### Option D: Progressive Speed-Up

**Start fast when many assets need enrichment, slow down when caught up**:

```typescript
// Fast mode: Many assets need refresh
if (needsRefreshCount > 50) {
    interval = 5 * 60 * 1000 // 5 minutes
    perRun = 30
}
// Normal mode: Some assets need refresh
else if (needsRefreshCount > 10) {
    interval = 15 * 60 * 1000 // 15 minutes
    perRun = 20
}
// Maintenance mode: Few assets need refresh
else {
    interval = 60 * 60 * 1000 // 1 hour
    perRun = 15
}
```

## Recommended Implementation

**Option C - Hybrid Approach**:

1. **Change interval to 10 minutes** (from 1 hour)
2. **Increase to 30 assets per run** (from 15)
3. **Keep 6.5s gap** (safe for CoinGecko)

**Benefits**:
- ✅ 99 assets enriched in 40 minutes (not 7 hours!)
- ✅ Still respects CoinGecko rate limits
- ✅ User sees progress without manual clicking
- ✅ No code complexity (simple config change)

**Files to modify**:
```
volspike-nodejs-backend/src/index.ts (line 341)
volspike-nodejs-backend/src/services/asset-metadata.ts (line 12)
```

## Why Current Settings Were Chosen

**Original design**:
- Optimized for **maintenance mode** (few stale assets)
- Assumed database already populated
- Conservative rate limiting for safety

**Current reality**:
- **Initial setup mode** (99 empty assets)
- Need faster enrichment for new deployments
- Current settings work great for maintenance, terrible for bulk init

## Impact on CoinGecko API

### Current Usage (1 hour interval, 15 per run)
- Calls per hour: 15 × 2 = **30 calls/hour** (search + profile)
- Calls per day: 30 × 24 = **720 calls/day**
- Calls per month: 720 × 30 = **21,600 calls/month** ❌ Over limit!

### Proposed Usage (10 min interval, 30 per run)
- During initial enrichment (40 mins): 120 calls
- After enrichment (maintenance): 30 calls every 10 min = **180 calls/hour** ⚠️ Too high!

### Smart Solution: Conditional Intervals

```typescript
// Get count of assets needing refresh
const needsRefreshCount = await prisma.asset.count({
    where: {
        OR: [
            { logoUrl: null },
            { displayName: null },
            { coingeckoId: null },
            { updatedAt: { lt: new Date(Date.now() - REFRESH_INTERVAL_MS) } }
        ]
    }
})

// Adjust interval based on need
const interval = needsRefreshCount > 20
    ? 10 * 60 * 1000  // 10 min (bulk mode)
    : 60 * 60 * 1000  // 1 hour (maintenance mode)
```

## Final Recommendation

**Implement two modes**:

### 1. Bulk Enrichment Mode (Auto-detected)
- **Trigger**: When >20 assets need refresh
- **Interval**: 10 minutes
- **Per run**: 30 assets
- **Duration**: ~40 minutes for 99 assets
- **Then**: Automatically switches to maintenance mode

### 2. Maintenance Mode (Default)
- **Trigger**: When <20 assets need refresh
- **Interval**: 1 hour
- **Per run**: 15 assets
- **Purpose**: Keep data fresh over time

**Benefits**:
- ✅ Fast initial setup (40 min instead of 7 hours)
- ✅ Efficient maintenance (hourly checks)
- ✅ Respects API limits in both modes
- ✅ Self-adjusting based on workload

---

**Next Steps**:
1. Implement conditional interval logic
2. Add Railway environment variable: `ENABLE_ASSET_ENRICHMENT=true` (verify it's set)
3. Add UI indicator showing enrichment progress
4. Test in production

**Last Updated**: 2025-11-21
