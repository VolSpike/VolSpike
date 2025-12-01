# Asset Manifest Cache Troubleshooting Guide

## Overview

This document explains the asset manifest caching system, common issues, and how to diagnose and fix problems when assets don't display correctly (missing logos, descriptions, or data).

## How the Asset Manifest System Works

### Data Flow

```
Database (PostgreSQL) 
  ↓
Backend API (/api/assets/manifest)
  ↓
Frontend fetchManifestFromApi()
  ↓
localStorage cache (volspike:asset-manifest-v3)
  ↓
Memory cache (manifestMemory)
  ↓
findAssetInManifestSync() → Instant lookup
```

### Key Components

1. **Backend (`/api/assets/manifest`)**: Returns all assets from database
2. **localStorage Cache**: Persistent cache across page reloads
3. **Memory Cache**: In-memory cache for instant synchronous lookup
4. **Preload on Module Load**: Manifest is loaded from localStorage synchronously when JavaScript module loads

### Cache Lifecycle

1. **First Visit**: No cache → Fetch from backend → Store in localStorage + memory
2. **Subsequent Visits**: Load from localStorage → Store in memory → Use instantly
3. **Stale Cache**: If cache is > 1 week old → Use cached data immediately → Refresh in background
4. **Incomplete Cache**: If cache has < 100 assets → Clear cache → Force fresh fetch

## The Problem (December 2025)

### Symptoms

- Asset cards not displaying logos or descriptions
- Console shows: `[findAssetInManifestSync] ❌ No match`
- Only 7 assets in cache: `['BTC', 'ETH', 'SOL', 'ENA', 'SOON']`
- Falls back to CoinGecko API → Fails with "body stream already read" error
- User sees placeholder text instead of actual data
- **NEW**: `localStorage quota exceeded` error when trying to cache manifest

### Root Causes

#### 1. localStorage Quota Exceeded (December 2025)

**Problem**: Manifest cache was 14.7 MB, exceeding browser's localStorage quota (typically 5-10 MB).

**Why it happened**:
- Base64-encoded logos stored in database (~15KB each)
- 534 assets × 15KB = ~8MB just for logos
- Combined with descriptions and metadata = 14.7 MB total
- localStorage limit exceeded → `QuotaExceededError`

**Impact**:
- Manifest cache couldn't be written to localStorage
- Users had to fetch fresh manifest on every page load
- Slower initial load time
- No persistent cache across page reloads

**Solution**:
- Strip base64 logos from localStorage cache (store only URLs)
- Keep full data (including base64 logos) in memory cache
- Logos fetched fresh from backend on page load
- localStorage cache now ~1-2 MB (manageable)

#### 2. Incomplete Manifest Cache

**Problem**: localStorage cache only contained 7 assets instead of 500+ assets from database.

**Why it happened**:
- Old/incomplete cache from previous version
- Cache version bump (`v1` → `v2` → `v3`) didn't clear old incomplete cache
- Cache was written before all assets were synced from database
- Cache corruption or partial write failure

**Impact**: 
- `findAssetInManifestSync()` couldn't find assets like AVAX
- System fell back to CoinGecko API (slow, rate-limited, error-prone)
- User experience degraded (missing logos, descriptions)

#### 2. CoinGecko "Body Stream Already Read" Error

**Problem**: When falling back to CoinGecko API, responses were being read multiple times, causing:
```
TypeError: Failed to execute 'json' on 'Response': body stream already read
```

**Why it happened**:
- Fetch Response objects can only be read once
- Code was calling `.json()` directly on the response
- If response was inspected or cloned elsewhere, body stream was consumed
- Rate limiter might have been reading response for error checking

**Impact**:
- CoinGecko fallback completely broken
- No way to get asset data if not in manifest
- User sees empty/placeholder data

## The Solution

### Fix 1: Strip Base64 Logos from localStorage Cache

**File**: `volspike-nextjs-frontend/src/lib/asset-manifest.ts`

**Change**: Modified `writeManifestCache()` to exclude base64 logos:

```typescript
// Strip base64 logos from localStorage cache
const assetsForStorage = assets.map((asset) => {
    const { logoUrl, ...rest } = asset
    // Only store logo if it's a URL (not base64 data URL)
    const logoForStorage = logoUrl && !logoUrl.startsWith('data:image') ? logoUrl : undefined
    return { ...rest, logoUrl: logoForStorage }
})

// Always store full data (including base64 logos) in memory cache
manifestMemory = assets
```

**Why it works**:
- localStorage cache is now ~1-2 MB (manageable)
- Memory cache has full data including logos (instant display)
- Logos fetched fresh from backend on page load
- No quota exceeded errors

### Fix 2: Detect and Clear Incomplete Caches

**File**: `volspike-nextjs-frontend/src/lib/asset-manifest.ts`

**Change**: Added validation in `readCachedManifest()`:

```typescript
// CRITICAL: If cache has too few assets (< 100), it's incomplete - don't use it
// This prevents using stale/incomplete caches that only have a few assets
if (parsed.assets.length < 100) {
    console.log(`[readCachedManifest] Cache has only ${parsed.assets.length} assets - too few, ignoring incomplete cache`)
    localStorage.removeItem(MANIFEST_CACHE_KEY) // Clear incomplete cache
    return null // Force fresh fetch from backend
}
```

**Why it works**:
- Detects incomplete caches before they cause problems
- Automatically clears bad cache and fetches fresh data
- Prevents using stale/incomplete data
- Ensures all assets from database are available

### Fix 3: Clone CoinGecko Responses Before Reading

**File**: `volspike-nextjs-frontend/src/hooks/use-asset-profile.ts`

**Change**: Clone responses before calling `.json()`:

```typescript
const searchRes = await rateLimitedFetch(...)
// Clone response before reading to avoid "body stream already read" error
const clonedRes = searchRes.clone()
const searchJson = (await clonedRes.json()) as any
```

**Why it works**:
- `.clone()` creates a new Response object with its own body stream
- Original response can be inspected/used elsewhere without consuming body
- Prevents "body stream already read" errors
- Ensures CoinGecko fallback works correctly

### Fix 4: Enhanced Logging

**Added console logs to trace manifest loading**:
- `[readCachedManifest]` - Cache validation and loading
- `[loadAssetManifest]` - Manifest fetch and cache status
- `[findAssetInManifestSync]` - Asset lookup results

**Why it helps**:
- Easy to diagnose cache issues in browser console
- See exactly what's happening at each step
- Identify incomplete caches quickly

## Post-Mortem Analysis

### What Went Wrong

1. **No validation of cache completeness**: System trusted localStorage cache without checking if it was complete
2. **Silent failures**: Incomplete cache was used without warning, causing degraded UX
3. **Poor error handling**: CoinGecko fallback failed silently, leaving users with no data
4. **Cache versioning issues**: Version bumps didn't properly invalidate incomplete caches

### What We Learned

1. **Always validate cache completeness**: Don't trust cached data without checking it's complete
2. **Clone fetch responses**: Always clone responses before reading if they might be used elsewhere
3. **Add comprehensive logging**: Logging helps diagnose issues quickly in production
4. **Fail fast**: Detect and fix incomplete caches immediately, don't let them degrade UX

### Prevention Strategies

1. **Cache validation**: Always check cache completeness (minimum asset count)
2. **Version invalidation**: When bumping cache version, clear old cache explicitly
3. **Response cloning**: Clone fetch responses before reading to prevent body stream errors
4. **Monitoring**: Add metrics/logging to detect incomplete caches in production
5. **Testing**: Test with empty/incomplete caches to ensure graceful handling

## How to Diagnose This Issue

### Step 1: Check Browser Console

Look for these log messages:

```
[readCachedManifest] Cache has only X assets - too few, ignoring incomplete cache
[loadAssetManifest] No cache or incomplete cache, fetching from backend...
[findAssetInManifestSync] ❌ No match
```

### Step 2: Check localStorage

Open browser DevTools → Application → Local Storage → Check `volspike:asset-manifest-v3`:

```javascript
// In browser console:
const cache = JSON.parse(localStorage.getItem('volspike:asset-manifest-v3'))
console.log('Cache has', cache?.assets?.length || 0, 'assets')
console.log('Sample assets:', cache?.assets?.slice(0, 10).map(a => a.baseSymbol))
```

**Expected**: 500+ assets  
**Problem**: < 100 assets (incomplete cache)

### Step 3: Check Backend API

Test backend endpoint directly:

```bash
curl https://your-backend-url/api/assets/manifest | jq '.assets | length'
```

**Expected**: 500+ assets  
**Problem**: < 100 assets (database sync issue)

### Step 4: Check Network Tab

In DevTools → Network → Filter by "manifest":
- Should see 200 OK response
- Response should have 500+ assets in JSON
- Check if response is being cached correctly

## How to Fix This Issue

### Quick Fix (User's Browser)

**Option 1: Clear localStorage cache**
```javascript
// In browser console:
localStorage.removeItem('volspike:asset-manifest-v3')
// Then refresh page
```

**Option 2: Bump cache version**
Edit `volspike-nextjs-frontend/src/lib/asset-manifest.ts`:
```typescript
const MANIFEST_CACHE_KEY = 'volspike:asset-manifest-v4' // Bump version
```
This forces all users to fetch fresh cache.

### Permanent Fix (Code)

**1. Ensure cache validation is in place**:
```typescript
// In readCachedManifest()
if (parsed.assets.length < 100) {
    localStorage.removeItem(MANIFEST_CACHE_KEY)
    return null
}
```

**2. Ensure response cloning**:
```typescript
// Always clone before reading
const clonedRes = response.clone()
const json = await clonedRes.json()
```

**3. Add monitoring**:
```typescript
// Log cache completeness
console.log(`[Manifest] Cache has ${assets.length} assets`)
if (assets.length < 100) {
    console.warn('[Manifest] WARNING: Incomplete cache detected!')
}
```

## Prevention Checklist

When making changes to manifest system, ensure:

- [ ] Cache validation checks minimum asset count (< 100 = incomplete)
- [ ] Response cloning for all fetch calls that read JSON
- [ ] Cache version bumps clear old cache explicitly
- [ ] Logging added for cache operations
- [ ] Testing with empty/incomplete caches
- [ ] Backend returns all assets from database
- [ ] Error handling for incomplete caches
- [ ] Fallback to CoinGecko works (if needed)

## Related Files

- `volspike-nextjs-frontend/src/lib/asset-manifest.ts` - Manifest caching logic
- `volspike-nextjs-frontend/src/hooks/use-asset-profile.ts` - Asset profile lookup
- `volspike-nodejs-backend/src/routes/assets.ts` - Backend manifest API
- `volspike-nodejs-backend/src/services/asset-metadata.ts` - Asset metadata service

## Version History

- **v3** (December 2025): Added incomplete cache detection, response cloning, enhanced logging
- **v2** (December 2025): Preload from localStorage on module load
- **v1** (November 2025): Initial manifest caching implementation

## Questions?

If you encounter this issue again:

1. Check browser console for error messages
2. Verify localStorage cache completeness
3. Test backend API endpoint directly
4. Check this document for diagnosis steps
5. Review recent code changes to manifest system

