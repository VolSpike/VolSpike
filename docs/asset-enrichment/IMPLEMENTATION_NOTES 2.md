# Asset Enrichment Implementation Notes

## Overview

This document tracks the implementation details, fixes, and improvements made to the asset enrichment system, particularly focusing on new asset detection and instant data display.

## Key Features Implemented

### 1. New Asset Detection from Market Data

**Location**: `volspike-nextjs-frontend/src/hooks/use-asset-detection.ts`

**How it works**:
- Frontend hook (`useAssetDetection`) monitors Market Data from WebSocket
- Extracts symbols from Market Data every 5 minutes
- Sends symbols to public backend endpoint `/api/assets/detect-new`
- Backend compares symbols against database and creates new assets
- Automatic enrichment starts in background for newly created assets

**Key Implementation Details**:
- Uses `marketDataRef` to always access latest market data without triggering re-initialization
- `initializedRef` prevents multiple timer setups
- Empty dependency array `[]` in effect to prevent re-render loops
- Cleanup function doesn't reset `initializedRef` to prevent re-initialization
- Detection runs every 5 minutes automatically

**Public Endpoint**: `POST /api/assets/detect-new`
- No admin authentication required
- Accepts array of symbols from Market Data
- Returns `{ success, created, newSymbols, message }`
- Triggers automatic enrichment in background

### 2. Instant Data Display for Incomplete Assets

**Issue**: Incomplete assets (like RLS) were taking 5+ seconds to show data in slide-out cards.

**Root Cause**: 
- Manifest cache was stale after new asset detection
- Frontend was falling back to CoinGecko API instead of using database data
- `isComplete` flag was incorrectly thought to affect data display

**Solution**:
- Added `invalidateManifestCache()` function to clear cache when new assets detected
- Manifest includes ALL assets (complete and incomplete) - no filtering
- `isComplete` flag ONLY affects refresh scheduling, NOT data display
- Cache invalidation triggers fresh manifest fetch on next asset card open

**Key Files**:
- `volspike-nextjs-frontend/src/lib/asset-manifest.ts` - `invalidateManifestCache()` function
- `volspike-nextjs-frontend/src/hooks/use-asset-detection.ts` - Calls invalidation after detection
- `volspike-nodejs-backend/src/services/asset-metadata.ts` - `getAssetManifest()` includes all assets

### 3. Hook Initialization Fixes

**Problem**: Hook was re-running on every render, resetting timers and preventing detection.

**Fixes Applied**:

1. **Prevented Re-initialization Loop**:
   - Added `initializedRef` to track if hook has been initialized
   - Early return if already initialized
   - Don't reset `initializedRef` in cleanup function

2. **Market Data Reference**:
   - Use `marketDataRef` to always access latest data
   - Separate effect updates ref without triggering re-initialization
   - Detection function uses ref to get current market data

3. **Timer Management**:
   - Store timer IDs in refs (`initialTimeoutRef`, `detectionIntervalRef`)
   - Only cleanup timers if not already initialized
   - Prevent cleanup from clearing timers after initialization

4. **Dependency Array**:
   - Changed from `[marketData]` to `[]` to prevent re-runs
   - Effect only runs once on mount
   - Market data accessed via ref, not dependency

## Critical Fixes Applied

### Fix 1: Infinite Re-render Loop
**Date**: December 2025
**Issue**: Hook was printing setup/cleanup messages repeatedly
**Cause**: `marketData` dependency caused effect to re-run on every render
**Fix**: Empty dependency array + `initializedRef` guard

### Fix 2: Timers Not Firing
**Date**: December 2025
**Issue**: 10-second timer never fired, detection never ran
**Cause**: Cleanup function was clearing timers when `marketData` changed
**Fix**: Don't cleanup timers if already initialized

### Fix 3: Incomplete Assets Not Showing Data Instantly
**Date**: December 2025
**Issue**: RLS took 5+ seconds to show data in slide-out card
**Cause**: Stale manifest cache after new asset detection
**Fix**: Invalidate cache when new assets detected

### Fix 4: Detection Not Running
**Date**: December 2025
**Issue**: No detection logs appearing in console
**Cause**: Hook wasn't being called or market data wasn't available
**Fix**: Added comprehensive logging at all levels (hook render, effect, timers)

## Architecture Decisions

### Why Public Endpoint for Detection?

The detection endpoint (`/api/assets/detect-new`) is public (no admin auth) because:
- Frontend needs to call it automatically without user interaction
- Market Data is already public (WebSocket stream)
- Detection only creates new assets, doesn't modify existing ones
- Enrichment happens in background with rate limiting

### Why Cache Invalidation?

When new assets are detected:
1. Asset is created in database immediately
2. Manifest cache is invalidated
3. Next asset card open fetches fresh manifest
4. New asset appears instantly with its data

This ensures users see new assets immediately without waiting for cache TTL.

### Why `isComplete` Doesn't Affect Display?

The `isComplete` flag is purely for admin workflow:
- **Incomplete**: Admin needs to review and verify data
- **Complete**: Admin verified, ready for weekly refresh cycles

Both complete and incomplete assets should display their data instantly to users. The flag only controls:
- Whether asset is included in weekly refresh cycles
- Whether "Next refresh" date is shown
- Whether green checkmark appears in admin panel

## Testing Checklist

- [x] New asset detection runs automatically every 5 minutes
- [x] Detection creates assets in database
- [x] Enrichment starts automatically in background
- [x] Incomplete assets show data instantly in slide-out cards
- [x] Manifest cache invalidates after detection
- [x] Hook doesn't re-initialize on every render
- [x] Timers fire correctly (10s initial, 5min periodic)
- [x] No infinite loops or repeated setup/cleanup

## Known Limitations

1. **Detection Frequency**: Currently set to 5 minutes. Could be reduced if needed.
2. **Cache Invalidation**: Only happens after detection. Manual refresh might be needed for immediate updates.
3. **Enrichment Rate Limiting**: Background enrichment respects CoinGecko rate limits (3s between requests).

## Future Improvements

1. **Real-time Detection**: Could use WebSocket to detect new assets immediately
2. **Optimistic UI**: Show asset card immediately with placeholder data
3. **Notification System**: Alert admin when new assets are detected
4. **Batch Detection**: Process multiple new assets more efficiently

## Related Documentation

- `Requirements.md` - Original requirements and specifications
- `Design.md` - Technical architecture and data flow
- `ToDo.md` - Implementation checklist
- `MANIFEST_CACHE_TROUBLESHOOTING.md` - Cache-related issues and fixes
- `DEBUG_ASSET_DETECTION.md` - Debugging guide for detection issues

