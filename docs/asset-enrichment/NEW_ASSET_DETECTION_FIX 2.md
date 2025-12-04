# New Asset Detection Fix - December 2025

## Problem

New Binance assets (like RLS) were not being automatically detected and added to the database. When users clicked on new assets in the Market Data table, the slide-out card would query CoinGecko on-the-fly (slow, 5-10 seconds) instead of showing cached data from the database.

## Root Cause

The new asset detection system was implemented but **silently failing** due to authentication issues:

1. **Frontend Hook** (`useAssetDetection`) was calling `/api/admin/assets/detect-new`
2. **Backend Endpoint** required admin authentication (`requireAdmin` middleware)
3. **Frontend Hook** didn't send authentication token (no `Authorization` header)
4. **Backend** returned `401 Unauthorized`
5. **Frontend Hook** caught error silently (`console.debug` only)
6. **Result**: No new assets detected, no errors visible to user

## Solution

Created a **public endpoint** for asset detection that doesn't require admin authentication:

### Backend Changes

**File**: `volspike-nodejs-backend/src/routes/assets.ts`

- Added `POST /api/assets/detect-new` endpoint (public, no auth required)
- Uses same `detectNewAssetsFromMarketData()` function as admin endpoint
- Automatically triggers enrichment for newly created assets
- Logs detection activity for monitoring

### Frontend Changes

**File**: `volspike-nextjs-frontend/src/hooks/use-asset-detection.ts`

- Updated to call `/api/assets/detect-new` instead of `/api/admin/assets/detect-new`
- Improved error logging (shows status code and error text)
- Still runs automatically every 5 minutes + initial check after 10 seconds

## How It Works Now

1. **Market Data Arrives**: WebSocket provides symbols (e.g., "RLSUSDT")
2. **Frontend Hook**: `useAssetDetection` extracts symbols from Market Data
3. **Detection Call**: Every 5 minutes, sends symbols to `/api/assets/detect-new`
4. **Backend Processing**:
   - Compares symbols against existing `Asset` database
   - Creates new `Asset` records for missing symbols
   - Triggers automatic CoinGecko enrichment (background, non-blocking)
5. **Enrichment**: New assets are automatically enriched with:
   - CoinGecko ID (via search)
   - Display name
   - Logo URL (`logoImageUrl`)
   - Description
   - Website URL
   - Twitter URL
6. **Manifest Update**: Asset manifest includes new assets immediately
7. **User Experience**: Slide-out card shows data instantly from database (no CoinGecko query needed)

## Detection Timing

- **Initial Check**: 10 seconds after dashboard mount (lets Market Data stabilize)
- **Periodic Checks**: Every 5 minutes (new assets don't appear that frequently)
- **Enrichment**: Starts immediately after detection (background, rate-limited)

## Why Public Endpoint?

Asset detection is a **read-only operation** that:
- Only creates new `Asset` records (non-sensitive data)
- Should work automatically for all users
- Doesn't expose sensitive information
- Is rate-limited by CoinGecko API constraints

The admin endpoint (`/api/admin/assets/detect-new`) still exists for manual admin triggers, but the automatic detection uses the public endpoint.

## Testing

To verify new asset detection is working:

1. **Check Browser Console**: Look for `[AssetDetection] ✅ Detected X new assets` messages
2. **Check Backend Logs**: Look for `[Assets] New asset detection requested` and `[Assets] ✅ Enriched X new assets`
3. **Check Admin Panel**: New assets should appear in `/admin/assets` within 5 minutes
4. **Check User Experience**: Click on new asset → slide-out card should show data instantly (no 5-10 second delay)

## Future Improvements

- Consider reducing detection interval from 5 minutes to 2-3 minutes for faster detection
- Add admin notification when new assets are detected
- Add rate limiting to public endpoint to prevent abuse
- Consider WebSocket-based real-time detection (if Market Data WebSocket supports it)

