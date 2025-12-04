# Asset Enrichment System - Design Document

> **⚠️ IMPORTANT**: See [MANIFEST_CACHE_TROUBLESHOOTING.md](./MANIFEST_CACHE_TROUBLESHOOTING.md) for troubleshooting guide and post-mortem analysis of cache issues.

## Architecture Overview

The Asset Enrichment System follows a **backend-driven, frontend-cached** architecture where:
- **Backend** handles CoinGecko API calls, rate limiting, and database storage
- **Frontend** uses cached manifest data for instant display, with fallback to CoinGecko for missing data
- **Admin Panel** provides manual controls and monitoring

---

## System Components

### 1. Backend Components

#### 1.1 Asset Metadata Service (`asset-metadata.ts`)
**Purpose**: Core service for CoinGecko integration and asset management

**Key Functions**:
- `pickCoingeckoId()`: Search CoinGecko API for asset by symbol, return best match
- `fetchCoinProfile()`: Fetch full coin profile from CoinGecko using ID
- `refreshSingleAsset()`: Refresh one asset's metadata from CoinGecko
- `runAssetRefreshCycle()`: Automatic refresh cycle for multiple assets (runs continuously)
- `detectNewAssets()`: Compare Market Data symbols against database to find new assets
- `getAssetManifest()`: Generate manifest for frontend consumption

**Rate Limiting Strategy**:
- 3-second gap between CoinGecko API calls (`REQUEST_GAP_MS`)
- Adaptive batch sizes: 30 for bulk mode, 15 for maintenance mode
- Exponential backoff on 429 errors

**Data Flow**:
```
WebSocket Market Data → detectNewAssets() → Asset DB (new assets)
CoinGecko API → refreshSingleAsset() → Asset DB (enrichment)
Asset DB → getAssetManifest() → Frontend API
```

#### 1.2 Admin Assets Routes (`routes/admin/assets.ts`)
**Purpose**: Admin API endpoints for asset management

**Endpoints**:
- `GET /api/admin/assets`: List assets with pagination and filtering
- `POST /api/admin/assets`: Create/update asset
- `DELETE /api/admin/assets/:id`: Delete asset
- `POST /api/admin/assets/:id/refresh`: Refresh single asset (last resort, manual override)
- `POST /api/admin/assets/detect-new`: Detect new assets from Market Data symbols
- `GET /api/admin/assets/refresh-status`: Get progress of automatic refresh cycle

**Design Decisions**:
- Automatic processing: System processes all assets continuously without admin triggers
- Progress tracking: Real-time progress visible in admin panel
- Rate limit compliance: Respects CoinGecko limits while processing all assets
- Comprehensive error logging for debugging

#### 1.3 Public Assets Routes (`routes/assets.ts`)
**Purpose**: Public API for frontend manifest consumption

**Endpoints**:
- `GET /api/assets/manifest`: Get asset manifest (cached, fast response)

**Manifest Structure**:
```typescript
{
  assets: AssetManifestEntry[],
  generatedAt: string,
  source: 'db' | 'fallback',
  staleAfterMs: number
}
```

**Note**: Manifest includes `description` field for each asset, which is used by both frontend slide-out card and admin panel.

---

### 2. Frontend Components

#### 2.1 Asset Project Overview (`components/asset-project-overview.tsx`)
**Purpose**: Slide-out card component displaying asset information

**Data Flow**:
```
User clicks row → selectedSymbol set → useAssetProfile() hook → 
  Check cache → Check manifest → Fetch CoinGecko if needed → Display
```

**Performance Optimizations**:
- Immediate display of cached/manifest data
- Background fetch if cache is stale
- Prefetch on hover (via `prefetchAssetProfile()`)

**Display Fields**:
- Logo/image
- Display name
- Description (expandable if > 320 chars)
- Website link
- Twitter/X link
- TradingView link

#### 2.2 Asset Profile Hook (`hooks/use-asset-profile.ts`)
**Purpose**: React hook for fetching and caching asset profiles

**Caching Strategy**:
- **Layer 1**: Memory cache (session)
- **Layer 2**: localStorage cache (1 week TTL)
- **Layer 3**: Backend manifest (6.9 days TTL)
- **Layer 4**: CoinGecko API (on-demand, rate-limited)

**Data Sources Priority**:
1. localStorage cache (if fresh)
2. Backend manifest (if available)
3. CoinGecko API (if missing or stale)

**Rate Limiting**:
- Uses `rateLimitedFetch()` utility with priority levels
- Respects CoinGecko free tier limits
- Implements request queuing

#### 2.3 Asset Manifest (`lib/asset-manifest.ts`)
**Purpose**: Frontend asset manifest loading and caching

**Features**:
- localStorage caching (6.9 days TTL)
- Memory caching for session
- Fallback to static seed manifest
- Symbol matching with multipliers support

**Symbol Matching Logic**:
- Exact base symbol match
- Binance symbol match (strip USDT suffix)
- Extra symbols array match
- Multiplier handling (1000PEPE → PEPE)

#### 2.4 Admin Asset Card View (`components/admin/assets/asset-card-view.tsx`)
**Purpose**: Admin panel card component displaying asset details

**Display Fields**:
- Status badge (AUTO/VERIFIED/HIDDEN)
- Logo preview (80x80px)
- Base symbol and display name
- Binance symbol (perp string)
- CoinGecko ID (with visual indicator if missing)
- **Project Description** (NEW - must be added)
- Website and Twitter links
- Updated timestamp
- Action buttons (Refresh, Edit, Delete)

**Edit Mode**:
- All fields editable including description (Textarea component)
- Save/Cancel buttons
- Validation before save

---

### 3. Database Schema

#### 3.1 Asset Model (`prisma/schema.prisma`)
```prisma
model Asset {
  id              String      @id @default(cuid())
  baseSymbol      String      @unique
  binanceSymbol   String?
  extraSymbols    String?     @db.Text  // JSON array
  coingeckoId     String?
  displayName     String?
  description     String?     @db.Text
  websiteUrl      String?
  twitterUrl      String?
  logoUrl         String?     // Data URL (base64)
  status          AssetStatus @default(AUTO)
  notes           String?     @db.Text
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

**Indexes**:
- `baseSymbol` (unique index)
- `coingeckoId` (for lookups)
- `updatedAt` (for refresh cycle ordering)

**Status Values**:
- `AUTO`: Auto-managed, can be overwritten by refresh cycle
- `VERIFIED`: Manually verified, refresh cycle won't overwrite
- `HIDDEN`: Hidden from public manifest, still in database

---

## Data Flow Diagrams

### 4.1 New Asset Detection Flow
```
WebSocket Market Data (from useClientOnlyMarketData)
  ↓
Extract unique symbols (e.g., "BTCUSDT" → "BTC")
  ↓
Compare with Asset DB (baseSymbol)
  ↓
New symbols detected?
  ↓ Yes
Create Asset records (status: AUTO)
  ↓
Trigger CoinGecko enrichment (automatic, background)
  ↓
CoinGecko search → ID resolution → Profile fetch
  ↓
Update Asset DB (coingeckoId, displayName, logoUrl, description, etc.)
  ↓
Manifest updated → Frontend cache invalidated
```

### 4.2 Slide-Out Card Display Flow
```
User clicks Market Data row
  ↓
selectedSymbol set
  ↓
useAssetProfile(symbol) hook called
  ↓
Check localStorage cache (1 week TTL)
  ↓ Fresh? → Display immediately
  ↓ Stale/Missing?
Check backend manifest (via findAssetInManifest)
  ↓ Found? → Display + background refresh
  ↓ Not Found?
Fetch from CoinGecko API (rate-limited)
  ↓
Store in cache + Display
```

### 4.3 Refresh Cycle Flow
```
Automatic trigger (weekly schedule OR continuous processing)
  ↓
Query Asset DB (orderBy: updatedAt ASC)
  ↓
Filter: shouldRefresh(asset) = true
  ↓
Process ALL assets needing refresh (no artificial batch limits)
  ↓
For each asset (with 3s gap between requests):
  - Search CoinGecko (if no coingeckoId)
  - Fetch profile (if coingeckoId exists)
  - Update Asset DB
  - Update progress tracker
  ↓
Continue until all assets processed (respecting rate limits)
  ↓
Log results + Update manifest + Update progress UI
```

---

## CoinGecko Integration Design

### 5.1 API Endpoints Used

#### Search API
```
GET https://api.coingecko.com/api/v3/search?query={SYMBOL}
```
**Purpose**: Find CoinGecko ID for a symbol
**Rate Limit**: ~20 calls/minute
**Response**: Array of coins with `id`, `symbol`, `market_cap_rank`

**Matching Logic**:
1. Filter exact symbol matches
2. Rank by market cap (lower rank = higher priority)
3. Fallback to best match if no exact match

#### Coin Profile API
```
GET https://api.coingecko.com/api/v3/coins/{ID}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false&sparkline=false
```
**Purpose**: Get full coin metadata
**Rate Limit**: ~20 calls/minute
**Response**: Full coin object with `name`, `description`, `image`, `links`

**Data Extraction**:
- `name`: Coin display name
- `description.en`: English description (HTML stripped)
- `image.large` or `image.small`: Logo URL
- `links.homepage[0]`: Website URL
- `links.twitter_screen_name`: Twitter handle → `https://x.com/{handle}`

### 5.2 Symbol Mapping Challenges

#### Multiplier Handling
**Problem**: Binance uses multipliers (1000PEPE, 1000000MOG) but CoinGecko uses base symbols (pepe, mog)

**Solution**:
1. Try full symbol first (1000PEPE)
2. If no match, strip multipliers: `/^(10|100|1000|10000|1000000)([A-Z0-9]+)$/`
3. Try stripped symbol (PEPE)
4. Use best match from results

#### Symbol Variations
**Problem**: Some symbols don't match exactly (0G → zero-gravity)

**Solution**:
1. Admin can manually set `coingeckoId` override
2. System stores override and uses it for future refreshes
3. Override takes precedence over search results

### 5.3 Logo Handling

#### Logo URL to Data URL Conversion
**Problem**: CoinGecko logo URLs may expire or be blocked

**Solution**:
1. Fetch logo image as ArrayBuffer
2. Convert to base64 data URL: `data:image/png;base64,{base64}`
3. Store data URL in database
4. Fallback to original URL if conversion fails

**Benefits**:
- No external dependencies for logo display
- Faster loading (no additional HTTP request)
- Works even if CoinGecko CDN is blocked

---

## Rate Limiting Design

### 6.1 Backend Rate Limiting

#### Request Gap Strategy
- **Fixed Gap**: 3 seconds between CoinGecko API calls
- **Calculation**: ~20 calls/minute (safe for free tier)
- **Implementation**: `await sleep(REQUEST_GAP_MS)` between requests

#### Continuous Processing Strategy
- **No Batch Limits**: Process all assets automatically, one by one
- **Rate Limit Compliance**: Respect 3-second gap, but process continuously
- **Progress Tracking**: Update progress in real-time for admin visibility
- **Rationale**: System runs autonomously, admin monitors progress but doesn't trigger

#### Error Handling
- **429 (Rate Limit)**: Exponential backoff (2s, 4s, 8s, max 30s)
- **Timeout**: 8-10 second timeout per request
- **Network Error**: Log and continue with next asset

### 6.2 Frontend Rate Limiting

#### Rate Limited Fetch Utility
**Purpose**: Queue and throttle CoinGecko API calls from frontend

**Priority Levels**:
- `high`: Direct CoinGecko ID fetch (manifest has ID)
- `normal`: Search + fetch (no ID in manifest)
- `low`: Fallback search (multiplier stripping)

**Implementation**:
- Request queue with priority ordering
- Minimum delay between requests (3-5 seconds)
- Exponential backoff on 429 errors

---

## Caching Strategy

### 7.1 Backend Caching

#### Manifest Cache
- **Storage**: Generated on-demand from Asset DB
- **TTL**: None (always fresh from DB)
- **Invalidation**: Automatic (DB updates reflect immediately)

#### Asset Refresh Cache
- **Storage**: Asset DB `updatedAt` field
- **TTL**: 7 days (REFRESH_INTERVAL_MS)
- **Invalidation**: Manual refresh or scheduled cycle
- **Missing Data Check**: Assets missing `logoUrl`, `displayName`, `description`, or `coingeckoId` are prioritized for refresh

### 7.2 Frontend Caching

#### Multi-Layer Cache Strategy

**Layer 1: Memory Cache**
- **Storage**: In-memory object (`manifestMemory`, `memoryCache`)
- **TTL**: Session (cleared on page reload)
- **Purpose**: Fastest access, no serialization overhead

**Layer 2: localStorage Cache**
- **Storage**: Browser localStorage
- **TTL**: 1 week (CACHE_TTL_MS) for profiles, 6.9 days for manifest
- **Purpose**: Persist across page reloads
- **Format**: JSON with timestamp

**Layer 3: Backend Manifest**
- **Storage**: API response (`/api/assets/manifest`)
- **TTL**: 6.9 days (slightly under 1 week to stagger refreshes)
- **Purpose**: Fallback if localStorage cache is stale

**Layer 4: CoinGecko API**
- **Storage**: On-demand fetch
- **TTL**: 1 week (after fetch, stored in cache)
- **Purpose**: Last resort, rate-limited

#### Cache Invalidation
- **On Update**: Backend updates Asset DB → Manifest regenerated → Frontend cache becomes stale
- **On Refresh**: Frontend checks timestamp, fetches new manifest if stale
- **Manual**: Admin can trigger refresh, invalidates cache

---

## Error Handling Design

### 8.1 Backend Error Handling

#### CoinGecko API Errors
```typescript
try {
  // API call
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limit: exponential backoff
  } else if (error.response?.status === 404) {
    // Not found: log warning, skip asset
  } else if (error.code === 'ECONNABORTED') {
    // Timeout: retry once
  } else {
    // Network error: log, continue
  }
}
```

#### Database Errors
- **Unique Constraint**: Handle gracefully (asset already exists)
- **Transaction Timeout**: Batch operations in smaller chunks
- **Connection Error**: Log and return error response

### 8.2 Frontend Error Handling

#### Asset Profile Fetch Errors
```typescript
try {
  const profile = await fetchProfileFromCoinGecko(symbol)
  if (profile) {
    writeCache(symbol, profile)
    setState({ loading: false, profile })
  } else {
    // No profile found: show cached data or placeholder
    setState({ loading: false, profile: cachedProfile })
  }
} catch (error) {
  // Show cached data if available, otherwise placeholder
  setState({ loading: false, profile: cachedProfile || undefined })
}
```

#### Manifest Fetch Errors
- **API Unavailable**: Fallback to static seed manifest
- **Network Error**: Use cached manifest if available
- **Invalid Response**: Log error, use fallback

---

## Performance Optimizations

### 9.1 Backend Optimizations

#### Database Queries
- **Indexes**: `baseSymbol` (unique), `coingeckoId`, `updatedAt`
- **Batch Operations**: Use `createMany()` and transactions for bulk updates
- **Selective Fields**: Only select needed fields (`select: { baseSymbol: true }`)

#### API Calls
- **Parallel Processing**: Not used (rate limiting requires sequential)
- **Request Batching**: Not applicable (CoinGecko doesn't support batch)
- **Connection Pooling**: Handled by Prisma

### 9.2 Frontend Optimizations

#### Component Rendering
- **Memoization**: `useMemo` for expensive computations (TradingView URL)
- **Lazy Loading**: Load asset profiles on-demand (when card opens)
- **Prefetching**: Prefetch manifest on app load, prefetch profiles on hover

#### Network Requests
- **Request Deduplication**: Track inflight requests, reuse promises
- **Cache-First Strategy**: Always check cache before API call
- **Background Refresh**: Don't block UI while refreshing stale cache

---

## Security Considerations

### 10.1 API Security
- **Rate Limiting**: Prevent abuse of CoinGecko API
- **Input Validation**: Validate symbols, URLs, CoinGecko IDs
- **SQL Injection**: Prisma ORM prevents SQL injection

### 10.2 Data Security
- **Admin Access**: Admin routes protected with role-based auth
- **Public Manifest**: Only exposes non-sensitive data (no user info)
- **Logo Storage**: Data URLs are safe (no external dependencies)

---

## Monitoring & Logging

### 11.1 Backend Logging
- **Asset Refresh**: Log each asset refresh with success/failure
- **Rate Limiting**: Log when rate limits are hit
- **Errors**: Comprehensive error logging with stack traces
- **Performance**: Log refresh cycle duration and throughput

### 11.2 Frontend Logging
- **Debug Mode**: Enable via `localStorage.setItem('volspike:debug:assets', 'true')`
- **Cache Hits/Misses**: Log cache performance
- **API Errors**: Log CoinGecko API failures

---

## Future Enhancements

### 12.1 Potential Improvements
- **WebSocket Updates**: Push asset updates to frontend in real-time
- **Image CDN**: Host logos on CDN instead of data URLs (reduce DB size)
- **Batch CoinGecko API**: If CoinGecko adds batch endpoint, use it
- **Machine Learning**: Improve symbol matching accuracy with ML

### 12.2 Scalability Considerations
- **Database Sharding**: If asset count grows significantly, consider sharding
- **Redis Cache**: Add Redis layer for faster manifest access
- **CDN Caching**: Cache manifest API response on CDN

---

## Testing Strategy

### 13.1 Unit Tests
- **Symbol Normalization**: Test multiplier stripping, case handling
- **CoinGecko ID Resolution**: Test search ranking logic
- **Data Extraction**: Test profile parsing, HTML stripping
- **Rate Limiting**: Test request gap enforcement

### 13.2 Integration Tests
- **Binance Sync**: Test new asset detection with mock Binance API
- **CoinGecko Fetch**: Test API calls with mock responses
- **Database Operations**: Test asset creation, updates, queries
- **Manifest Generation**: Test manifest API response format

### 13.3 E2E Tests
- **Admin Panel**: Test asset refresh, edit, sync operations
- **Slide-Out Card**: Test card display with various asset states
- **Cache Behavior**: Test cache hit/miss scenarios, invalidation

---

## Implementation Phases

### Phase 1: Core Functionality
1. Fix existing asset data issues (Bitcoin logo, SQD description)
2. Improve CoinGecko data extraction (better logo quality, description handling)
3. Enhance symbol matching (multiplier handling, fallback logic)

### Phase 2: New Asset Detection
1. Improve Binance sync detection logic
2. Automatic enrichment trigger for new assets
3. Admin panel improvements for monitoring

### Phase 3: Performance & Polish
1. Optimize caching strategy
2. Improve error handling and user feedback
3. Add comprehensive logging and monitoring

### Phase 4: Testing & Documentation
1. Write unit tests for core functions
2. Write integration tests for API endpoints
3. Update documentation and user guides

---

## Implementation Details

### New Asset Detection Hook (`useAssetDetection`)

**Location**: `volspike-nextjs-frontend/src/hooks/use-asset-detection.ts`

**Key Features**:
- Monitors Market Data from WebSocket (`useClientOnlyMarketData`)
- Extracts symbols every 5 minutes automatically
- Calls public endpoint `/api/assets/detect-new` (no admin auth required)
- Invalidates manifest cache after detection to ensure instant display
- Uses refs (`marketDataRef`, `initializedRef`) to prevent re-initialization loops

**Preventing Re-render Loops**:
- Empty dependency array `[]` in effect to prevent re-runs
- `initializedRef` guard prevents multiple timer setups
- `marketDataRef` for accessing latest data without triggering effects
- Cleanup function doesn't reset `initializedRef` to prevent re-initialization

**Timer Management**:
- Initial detection: 10-second delay after mount
- Periodic detection: Every 5 minutes
- Timers stored in refs (`initialTimeoutRef`, `detectionIntervalRef`)
- Cleanup only runs if not already initialized

### Cache Invalidation

**Location**: `volspike-nextjs-frontend/src/lib/asset-manifest.ts`

**Function**: `invalidateManifestCache()`

**When Called**:
- After new asset detection (in `useAssetDetection` hook)
- Clears memory cache (`manifestMemory = null`)
- Clears localStorage cache (`localStorage.removeItem(MANIFEST_CACHE_KEY)`)
- Resets manifest promise (`manifestPromise = null`)

**Why**: Ensures newly detected assets (including incomplete ones) appear instantly in slide-out cards without waiting for cache TTL.

### Public Detection Endpoint

**Location**: `volspike-nodejs-backend/src/routes/assets.ts`

**Endpoint**: `POST /api/assets/detect-new`

**Why Public**: 
- Frontend needs to call automatically without user interaction
- Market Data is already public (WebSocket stream)
- Only creates new assets, doesn't modify existing ones
- Enrichment happens in background with rate limiting

**Request**: `{ symbols: string[] }` (array of Market Data symbols)
**Response**: `{ success: boolean, created: number, newSymbols: string[], message: string }`

### `isComplete` Flag Behavior

**Important**: The `isComplete` flag ONLY affects refresh scheduling, NOT data display.

- **Incomplete Assets**: 
  - Still display data instantly in slide-out cards
  - Included in manifest (no filtering)
  - Not included in weekly refresh cycles
  - Admin can review and mark as complete

- **Complete Assets**:
  - Included in weekly refresh cycles
  - Show "Next refresh" date in admin panel
  - Display green checkmark in admin panel
  - Refresh if stale (>1 week old)

## References

- See `MANIFEST_CACHE_TROUBLESHOOTING.md` for documentation on manifest cache issues and fixes.
- See `IMPLEMENTATION_NOTES.md` for detailed implementation notes, fixes, and architecture decisions.
- See `DEBUG_ASSET_DETECTION.md` for debugging guide for detection issues.

