# Asset Enrichment System - Requirements

> **⚠️ IMPORTANT**: See [MANIFEST_CACHE_TROUBLESHOOTING.md](./MANIFEST_CACHE_TROUBLESHOOTING.md) for troubleshooting guide and post-mortem analysis of cache issues.

## Overview
The Asset Enrichment System ensures that when users click on a symbol row in the Market Data table, a slide-out card displays complete, accurate asset information (image, description, website, Twitter/X, TradingView link) sourced from CoinGecko. The system must automatically detect new Binance perpetual assets, fetch their metadata, store it efficiently, and keep it up-to-date while respecting CoinGecko API rate limits.

---

## 1. User-Facing Slide-Out Card Requirements

### 1.1 Card Display
- **Trigger**: User clicks on any symbol row in the Market Data table
- **Performance**: Card must slide out instantly with minimal delay/lag (< 200ms perceived latency)
- **Data Source**: All information should come from CoinGecko free API
- **Required Fields**:
  - Asset image/logo (high quality, visible on dark background)
  - Asset description (full text, expandable if > 320 characters)
  - Website URL (if available)
  - Twitter/X account link (if available)
  - TradingView chart link (auto-generated: `https://www.tradingview.com/chart/?symbol=BINANCE:{SYMBOL}USDT.P`)

### 1.2 Current Issues to Fix
- **Bitcoin**: Missing image/logo
- **SQD**: Missing description (showing placeholder), logo has poor visibility on grey background
- **General**: Many assets missing complete metadata (images, descriptions, links)
- **Admin Panel**: Description field is completely missing from asset cards (major issue)

### 1.3 Data Quality Requirements
- **Logo Quality**: Must use high-quality images from CoinGecko (prefer `large` or `small` over `thumb`)
- **Logo Background**: Logos should be visible on dark backgrounds (transparent PNG preferred)
- **Description**: Must be actual project description from CoinGecko, not placeholder text
- **Missing Data Handling**: If data is unavailable, show appropriate fallbacks without breaking UX

---

## 2. New Asset Detection Requirements

### 2.1 Detection Mechanism
- **Source**: Binance Futures API (`/fapi/v1/exchangeInfo`)
- **Trigger**: System must detect when Binance adds new perpetual USDT pairs
- **Scope**: Only perpetual contracts (`contractType: 'PERPETUAL'`) with `quoteAsset: 'USDT'` and `status: 'TRADING'`

### 2.2 Detection Frequency
- **Backend**: Check Binance API during scheduled refresh cycles (weekly)
- **Admin Panel**: Manual sync button (`/admin/assets`) triggers immediate check
- **Real-time**: Not required (Binance doesn't add assets that frequently)

### 2.3 Detection Logic
- Compare current Binance perpetual symbols with database `Asset` table
- Identify symbols that exist in Binance but not in database
- Create new `Asset` records for missing symbols with `status: 'AUTO'`
- Trigger enrichment process for newly detected assets

---

## 3. CoinGecko Data Collection Requirements

### 3.1 Data Collection Process
1. **Search Phase**: Query CoinGecko search API with base symbol (e.g., "BTC", "SQD")
2. **ID Resolution**: Extract CoinGecko ID from search results (prefer exact symbol matches, highest market cap rank)
3. **Profile Fetch**: Fetch full coin profile using CoinGecko ID
4. **Data Extraction**: Extract:
   - Coin name (e.g., "Bitcoin", "SQD")
   - Description (English, HTML stripped)
   - Logo URL (prefer `image.large` or `image.small`)
   - Website URL (first valid homepage link)
   - Twitter/X handle (from `links.twitter_screen_name`)
   - CoinGecko ID (for future reference)

### 3.2 Symbol Mapping Challenges
- **Multiplier Symbols**: Handle cases like `1000PEPE` → CoinGecko ID `pepe`, `1000000MOG` → `mog`
- **Symbol Variations**: Some Binance symbols don't match CoinGecko exactly (e.g., `0G` → CoinGecko ID `zero-gravity`)
- **Fallback Logic**: If search fails for full symbol, try stripped variant (remove multipliers: `1000`, `100`, `10000`, `1000000`)

### 3.3 Data Storage
- **Database**: Store in PostgreSQL `Asset` table
- **Fields**: `coingeckoId`, `displayName`, `description`, `logoUrl`, `websiteUrl`, `twitterUrl`
- **Logo Storage**: Convert logo URLs to data URLs (base64) for reliability and performance
- **Manifest**: Update asset manifest API (`/api/assets/manifest`) to include new assets

---

## 4. Rate Limiting & API Guardrails

### 4.1 CoinGecko Free Tier Limits
- **Rate Limit**: ~10-30 calls/minute (varies, conservative estimate: 20 calls/minute)
- **Daily Limit**: ~10,000-50,000 calls/day (free tier)
- **Best Practice**: 3-5 second delay between requests

### 4.2 Rate Limiting Strategy
- **Request Gap**: Minimum 3 seconds between CoinGecko API calls (~20 calls/minute, safe for free tier)
- **Automatic Processing**: System processes ALL assets automatically, one by one, within CoinGecko limits
- **No Manual Intervention**: Admin should NOT need to trigger refreshes manually
- **Continuous Processing**: System continuously processes assets needing refresh until all are updated
- **Exponential Backoff**: Implement retry logic with exponential backoff on 429 (rate limit) errors

### 4.3 Guardrails
- **Request Timeout**: 8-10 seconds per CoinGecko API call
- **Error Handling**: Gracefully handle API failures, log errors, continue with next asset
- **Progress Monitoring**: Admin panel shows visual progress of update process (which assets are being processed, how many remaining)
- **No Batch Limits**: System processes all assets automatically, respecting rate limits but not artificially limiting batch sizes
- **Admin Role**: Admin monitors progress and can verify data quality, but system runs autonomously

---

## 5. Data Refresh & Maintenance Requirements

### 5.1 Refresh Strategy
- **Initial Fetch**: When new asset detected from Market Data, fetch CoinGecko data immediately
- **Subsequent Refreshes**: Weekly background refresh for all assets (to catch CoinGecko data changes)
- **Refresh Criteria**: Asset needs refresh if:
  - Missing `logoUrl`, `displayName`, `description`, or `coingeckoId`
  - `updatedAt` is older than 7 days
  - Status is not `HIDDEN`
- **Note**: Weekly refresh is for updating CoinGecko data (description, logo, website, Twitter may change), NOT for detecting new assets

### 5.2 Background Refresh Process
- **Scheduled Task**: Run weekly refresh cycle automatically (no admin intervention needed)
- **Continuous Processing**: System processes assets continuously, respecting CoinGecko rate limits
- **Spread Out**: Process refreshes throughout the week to avoid rate limit spikes
- **Priority**: Process assets with missing data first, then stale data
- **Non-Blocking**: Background refresh should not block user-facing operations
- **Progress Visibility**: Admin panel shows progress (which assets processed, how many remaining)
- **Autonomous Operation**: System runs automatically without admin triggers

### 5.3 Data Freshness
- **Update Frequency**: Once per week (7 days) is sufficient for most assets
- **Manual Refresh**: Admin can trigger refresh for specific assets via `/admin/assets` page
- **Bulk Refresh**: Admin can trigger bulk refresh for all assets needing update

---

## 6. Admin Panel Requirements

### 6.1 `/admin/assets` Page Display
- **Asset Cards**: Display all assets in card view (default) or table view
- **Required Fields Display**:
  - Perp prefix (e.g., "0G" from "0GUSDT")
  - Asset name (e.g., "0G")
  - Perp String (e.g., "0GUSDT")
  - CoinGecko name (e.g., "zero-gravity" - the CoinGecko ID, not display name)
  - **Project Description** (full text from CoinGecko, expandable if long)
  - Website address (if available)
  - Twitter/X link (if available)
  - Logo preview (if available)

### 6.2 Status Indicators
- **Complete** ✅: Has logo, display name, AND CoinGecko ID
- **Missing Logo** ⚠️: Has CoinGecko ID and name, but no logo
- **No CoinGecko ID** 🔶: Missing CoinGecko mapping (can't auto-enrich)
- **Pending Enrichment**: Waiting for CoinGecko fetch

### 6.3 Admin Actions
- **Monitor Progress**: View progress of automatic refresh process (which assets processed, remaining count)
- **Edit Asset**: Manually edit CoinGecko ID, display name, URLs, description, etc. (for corrections)
- **Verify Data Quality**: Review asset cards to ensure CoinGecko data is correct
- **Manual Refresh (Last Resort)**: Click "Refresh" button for individual assets only if automatic refresh failed
- **Note**: System runs autonomously - admin primarily monitors and verifies, doesn't trigger refreshes

### 6.4 Data Validation
- **CoinGecko ID Format**: Validate format (lowercase, hyphens allowed, no spaces)
- **URL Validation**: Ensure website and Twitter URLs are valid
- **Logo Validation**: Verify logo URLs are accessible before storing
- **Description Validation**: Ensure descriptions are properly extracted and stored (HTML stripped, English preferred)

### 6.5 Description Field Requirements
- **Display**: Description must be visible in admin panel asset cards
- **Format**: Full text from CoinGecko (HTML stripped, plain text)
- **Length Handling**: 
  - Short descriptions (< 200 chars): Display in full
  - Medium descriptions (200-500 chars): Display with "Read more" expand/collapse
  - Long descriptions (> 500 chars): Display truncated with "Read more" expand/collapse
- **Edit Mode**: Allow admin to manually edit description in edit mode
- **Placeholder**: Show "No description available" if description is missing
- **Styling**: Use readable font size and line height, proper text wrapping

---

## 7. Performance Requirements

### 7.1 Slide-Out Card Performance
- **Initial Load**: < 200ms perceived latency (show cached data immediately if available)
- **Data Fetch**: Background fetch if cache is stale, don't block UI
- **Cache Strategy**: Use localStorage cache (1 week TTL) + backend manifest cache

### 7.2 Backend Performance
- **Manifest API**: `/api/assets/manifest` should respond in < 100ms
- **Asset Refresh**: Non-blocking, runs in background
- **Database Queries**: Optimized queries with proper indexes

### 7.3 Frontend Performance
- **Prefetching**: Prefetch asset manifest on app load
- **Lazy Loading**: Load asset profiles on-demand when card opens
- **Cache Management**: Efficient cache invalidation on updates

---

## 8. Error Handling Requirements

### 8.1 CoinGecko API Errors
- **Rate Limit (429)**: Implement exponential backoff, retry after delay
- **Not Found (404)**: Log warning, mark asset as needing manual CoinGecko ID
- **Timeout**: Retry once, then skip asset for this cycle
- **Network Errors**: Log error, continue with next asset

### 8.2 Data Quality Errors
- **Missing Logo**: Fallback to placeholder or symbol initials
- **Missing Description**: Show generic placeholder text
- **Invalid URLs**: Validate before storing, log warnings

### 8.3 User-Facing Errors
- **Card Load Failure**: Show cached data if available, otherwise show placeholder
- **No Data Available**: Display friendly message, don't break UI

---

## 9. Testing Requirements (TDD Approach)

### 9.1 Unit Tests
- **Symbol Normalization**: Test multiplier stripping (`1000PEPE` → `PEPE`)
- **CoinGecko ID Resolution**: Test search and ranking logic
- **Data Extraction**: Test profile parsing and field extraction
- **Rate Limiting**: Test request gap enforcement

### 9.2 Integration Tests
- **Binance Sync**: Test new asset detection
- **CoinGecko Fetch**: Test API calls with mock responses
- **Database Operations**: Test asset creation and updates
- **Manifest Generation**: Test manifest API response

### 9.3 E2E Tests
- **Admin Panel**: Test asset refresh, edit, sync operations
- **Slide-Out Card**: Test card display with various asset states
- **Cache Behavior**: Test cache hit/miss scenarios

---

## 10. Non-Functional Requirements

### 10.1 Reliability
- **No Breaking Changes**: Ensure existing functionality continues to work
- **Backward Compatibility**: Support existing asset data format
- **Graceful Degradation**: System should work even if CoinGecko API is temporarily unavailable

### 10.2 Maintainability
- **Code Organization**: Clear separation between frontend and backend logic
- **Logging**: Comprehensive logging for debugging and monitoring
- **Documentation**: Code comments and documentation for complex logic

### 10.3 Scalability
- **Database Indexes**: Proper indexes on `baseSymbol`, `coingeckoId`, `updatedAt`
- **Batch Processing**: Efficient batch operations for bulk updates
- **Cache Strategy**: Multi-layer caching (localStorage, backend manifest)

---

## 11. Success Criteria

### 11.1 Functional Success
- ✅ All assets in Market Data table have complete metadata (logo, description, links)
- ✅ New assets are automatically detected and enriched within 24 hours
- ✅ Slide-out card displays instantly with correct information
- ✅ Admin panel shows accurate asset information with clear status indicators

### 11.2 Performance Success
- ✅ Slide-out card opens in < 200ms
- ✅ CoinGecko API rate limits are never exceeded
- ✅ Background refresh completes without blocking user operations

### 11.3 Quality Success
- ✅ No placeholder descriptions for assets with CoinGecko data
- ✅ **Description field is visible and functional in admin panel asset cards**
- ✅ All logos are visible on dark backgrounds
- ✅ All links are valid and functional
- ✅ Admin can verify and correct asset data easily (including descriptions)

---

## Implementation Status

✅ **COMPLETED** - All requirements have been implemented and tested (December 2025).

### Key Achievements:
- ✅ New asset detection from Market Data (WebSocket-based, automatic every 5 minutes)
- ✅ Automatic enrichment for newly detected assets (background processing)
- ✅ Instant data display for incomplete assets (cache invalidation on detection)
- ✅ Hook initialization fixes (no infinite loops, timers fire correctly)
- ✅ Public detection endpoint (`/api/assets/detect-new`) for frontend integration
- ✅ Manifest cache invalidation ensures new assets appear instantly

### Recent Fixes (December 2025):
- Fixed infinite re-render loop in `useAssetDetection` hook
- Fixed timers not firing due to cleanup function clearing timers
- Fixed incomplete assets not showing data instantly (cache invalidation)
- Added comprehensive logging for debugging detection issues
- Ensured `isComplete` flag only affects refresh scheduling, not data display

### Architecture Decisions:
- **Public Detection Endpoint**: No admin auth required - frontend calls automatically
- **Cache Invalidation**: Manifest cache cleared when new assets detected
- **Hook Design**: Uses refs to prevent re-initialization, empty dependency array
- **Timer Management**: Timers persist after initialization, cleanup doesn't reset state

## References

- See `MANIFEST_CACHE_TROUBLESHOOTING.md` for documentation on manifest cache issues and fixes.
- See `IMPLEMENTATION_NOTES.md` for detailed implementation notes, fixes, and architecture decisions.
- See `DEBUG_ASSET_DETECTION.md` for debugging guide for detection issues.

