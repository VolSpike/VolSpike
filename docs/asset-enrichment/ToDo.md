# Asset Enrichment System - Implementation To-Do List

> **✅ STATUS**: All critical tasks completed (December 2025). See `IMPLEMENTATION_NOTES.md` for details.

## Phase 1: Fix Current Issues & Improve Data Quality

### 1.1 Fix Logo Quality Issues
- [ ] **Investigate Bitcoin logo missing**
  - Check if CoinGecko ID is correct (`bitcoin`)
  - Verify logo URL extraction logic (prefer `image.large` over `image.thumb`)
  - Test logo fetch and data URL conversion
  - Fix if logo URL is invalid or conversion fails

- [ ] **Fix SQD logo visibility**
  - Check CoinGecko logo URL for SQD
  - Verify logo has transparent background (prefer PNG)
  - Test logo display on dark background
  - Update logo extraction to prefer high-quality images

- [ ] **Improve logo extraction logic**
  - Update `fetchCoinProfile()` to prefer `image.large` or `image.small` over `image.thumb`
  - Add fallback chain: `large` → `small` → `thumb`
  - Ensure logos are converted to data URLs for reliability
  - Test logo conversion with various image formats

### 1.2 Fix Description Issues
- [ ] **Fix SQD missing description**
  - Verify CoinGecko ID is correct (`zero-gravity` or actual ID)
  - Check description extraction logic (HTML stripping)
  - Test description fetch for SQD
  - Ensure description is stored correctly in database

- [ ] **Remove placeholder descriptions**
  - Identify all assets with placeholder text
  - Trigger refresh for assets missing descriptions
  - Verify description extraction handles empty/null cases
  - Update UI to show "No description available" instead of placeholder

- [ ] **Improve description extraction**
  - Enhance HTML stripping logic (handle more edge cases)
  - Ensure English description is preferred (`description.en`)
  - Add description length validation (min 50 chars for meaningful descriptions)
  - Test with various CoinGecko description formats

- [ ] **Add description to admin panel cards** (CRITICAL)
  - Currently description field is completely missing from admin panel
  - Add description display section to asset card component
  - Ensure description is included in edit mode
  - Test description display with various lengths and content

### 1.3 Enhance Symbol Matching
- [ ] **Improve multiplier handling**
  - Test multiplier regex: `/^(10|100|1000|10000|1000000)([A-Z0-9]+)$/`
  - Add support for more multiplier patterns if needed
  - Test with real examples: `1000PEPE`, `1000000MOG`, `100BONK`
  - Ensure fallback search uses stripped symbol correctly

- [ ] **Fix symbol variations (0G → zero-gravity)**
  - Verify CoinGecko ID mapping for `0G` symbol
  - Test search API with `0G` vs `zero-gravity`
  - Ensure admin can manually set CoinGecko ID override
  - Document common symbol variations for admin reference

- [ ] **Improve search ranking**
  - Test market cap rank sorting logic
  - Add CoinGecko score as secondary sort criteria
  - Ensure exact symbol matches are preferred
  - Test edge cases (multiple matches, no matches)

---

## Phase 2: New Asset Detection & Auto-Enrichment

### 2.1 Implement New Asset Detection from Market Data
- [ ] **Create detection endpoint**
  - Create `/api/admin/assets/detect-new` endpoint
  - Accept array of symbols from Market Data (WebSocket)
  - Compare against Asset DB to find new symbols
  - Create new Asset records for missing symbols
  - Return list of newly created assets

- [ ] **Frontend integration**
  - Extract symbols from Market Data (useClientOnlyMarketData hook)
  - Periodically send symbols to detection endpoint
  - Handle new asset detection automatically
  - Show notification when new assets detected

- [ ] **Automatic enrichment trigger**
  - Ensure new assets trigger CoinGecko enrichment automatically
  - Test enrichment flow: Detection → Asset creation → CoinGecko fetch
  - Verify new assets are enriched within reasonable time
  - Add monitoring for new asset detection rate

- [ ] **Remove Binance API dependency**
  - Remove `ensureBinanceUniverse()` function (or keep as fallback only)
  - Remove `sync-binance` endpoint (or mark as deprecated)
  - Update documentation to reflect WebSocket-based detection

### 2.2 Background Refresh Improvements
- [ ] **Implement continuous processing**
  - Remove artificial batch limits (30/15 assets per cycle)
  - Process ALL assets automatically, respecting rate limits
  - Implement progress tracking system
  - Add real-time progress updates to admin panel

- [ ] **Add progress monitoring**
  - Create progress tracker (current asset, total remaining, ETA)
  - Display progress in admin panel
  - Show which assets are being processed
  - Update progress in real-time

- [ ] **Remove manual triggers**
  - Remove "Run Cycle" button (system runs automatically)
  - Keep "Refresh" button for individual assets (last resort)
  - Update UI to show progress instead of trigger buttons
  - Add "Pause/Resume" functionality if needed

---

## Phase 3: Rate Limiting & API Guardrails

### 3.1 Backend Rate Limiting
- [ ] **Verify rate limiting implementation**
  - Test `REQUEST_GAP_MS` (3 seconds) enforcement
  - Ensure exponential backoff on 429 errors
  - Test with CoinGecko API rate limit simulation
  - Add metrics for rate limit hits

- [ ] **Remove batch size limits**
  - Remove `MAX_REFRESH_PER_RUN_BULK` and `MAX_REFRESH_PER_RUN_MAINTENANCE` constants
  - Process all assets continuously, respecting rate limits
  - Ensure system can handle hundreds of assets automatically
  - Add configuration for request gap (keep it configurable)

- [ ] **Improve error handling**
  - Test 429 (rate limit) error handling
  - Test timeout error handling (8-10 seconds)
  - Test network error handling
  - Ensure errors don't break refresh cycle

### 3.2 Frontend Rate Limiting
- [ ] **Review rate limited fetch utility**
  - Test `rateLimitedFetch()` implementation
  - Verify priority levels (high, normal, low)
  - Test request queuing logic
  - Ensure frontend respects CoinGecko limits

- [ ] **Optimize frontend API calls**
  - Minimize CoinGecko API calls from frontend
  - Prefer backend manifest over direct CoinGecko calls
  - Only fetch from CoinGecko if manifest is missing data
  - Test cache hit rates

---

## Phase 4: Admin Panel Enhancements

### 4.1 Admin Panel Display
- [ ] **Add description field to asset cards** (CRITICAL - Currently Missing)
  - Add description section to `asset-card-view.tsx` component
  - Display full description text (HTML already stripped by backend)
  - Implement expand/collapse for long descriptions (> 200 chars)
  - Show "No description available" placeholder if missing
  - Add description to edit mode (use Textarea component)
  - Test with various description lengths
  - Ensure proper text wrapping and readability

- [ ] **Fix CoinGecko name display**
  - Ensure admin panel shows CoinGecko ID (e.g., `zero-gravity`) not display name
  - Add tooltip explaining CoinGecko ID vs display name
  - Test with various assets (0G, PEPE, etc.)
  - Update card view to show CoinGecko ID clearly

- [ ] **Improve status indicators**
  - Verify status badge logic (Complete, Missing Logo, No CoinGecko ID)
  - Test status calculation for various asset states
  - Ensure status updates correctly after refresh
  - Add visual feedback for recently refreshed assets

- [ ] **Enhance asset card display**
  - Show all required fields: Perp prefix, Asset name, Perp String, CoinGecko ID, **Description**, Website, Twitter
  - Test card layout with various data combinations
  - Ensure missing fields are clearly indicated
  - Add edit mode for manual corrections (including description editing)

### 4.2 Admin Actions
- [ ] **Test manual refresh**
  - Verify single asset refresh works correctly
  - Test refresh button updates asset data
  - Ensure refresh respects rate limits
  - Add loading state during refresh

- [ ] **Test bulk refresh**
  - Verify bulk refresh processes multiple assets
  - Test rate limiting during bulk refresh
  - Ensure progress feedback is shown
  - Test cancellation of bulk refresh

- [ ] **Test new asset detection**
  - Verify detection from Market Data symbols works correctly
  - Test detection handles various symbol formats
  - Ensure detection triggers CoinGecko enrichment automatically
  - Add detection progress feedback

---

## Phase 5: Performance Optimizations

### 5.1 Slide-Out Card Performance
- [ ] **Optimize card opening speed**
  - Ensure cached data displays immediately (< 200ms)
  - Test cache hit scenarios
  - Optimize manifest loading
  - Minimize API calls during card open

- [ ] **Improve data prefetching**
  - Test `prefetchAssetProfile()` on row hover
  - Ensure prefetch doesn't overwhelm API
  - Test prefetch cache behavior
  - Monitor prefetch hit rates

- [ ] **Optimize asset profile hook**
  - Review `useAssetProfile()` implementation
  - Ensure cache checks are efficient
  - Minimize re-renders
  - Test with various asset states

### 5.2 Backend Performance
- [ ] **Optimize database queries**
  - Review indexes on Asset table
  - Test query performance with large asset counts
  - Optimize manifest generation
  - Add query performance monitoring

- [ ] **Optimize API responses**
  - Ensure manifest API responds quickly (< 100ms)
  - Test manifest caching
  - Minimize response payload size
  - Add response time monitoring

---

## Phase 6: Error Handling & Resilience

### 6.1 CoinGecko API Error Handling
- [ ] **Test rate limit handling**
  - Simulate 429 errors
  - Verify exponential backoff works
  - Ensure refresh cycle continues after rate limit
  - Test recovery after rate limit period

- [ ] **Test not found handling**
  - Test 404 errors for missing assets
  - Ensure assets are marked appropriately
  - Verify admin can manually set CoinGecko ID
  - Test fallback to manual override

- [ ] **Test timeout handling**
  - Simulate timeout errors
  - Verify retry logic works
  - Ensure timeout doesn't break refresh cycle
  - Test with slow network conditions

### 6.2 Data Quality Error Handling
- [ ] **Handle missing logos**
  - Test fallback to placeholder
  - Ensure UI doesn't break with missing logo
  - Test logo conversion failures
  - Add retry logic for logo fetch

- [ ] **Handle missing descriptions**
  - Test placeholder text display
  - Ensure UI doesn't break with missing description
  - Test HTML stripping edge cases
  - Add validation for description quality

- [ ] **Handle invalid URLs**
  - Test URL validation logic
  - Ensure invalid URLs aren't stored
  - Test URL format edge cases
  - Add URL validation tests

---

## Phase 7: Testing (TDD Approach)

### 7.1 Unit Tests
- [ ] **Symbol normalization tests**
  - Test multiplier stripping (`1000PEPE` → `PEPE`)
  - Test case handling (uppercase conversion)
  - Test edge cases (numbers, special characters)
  - Test symbol matching logic

- [ ] **CoinGecko ID resolution tests**
  - Test search API response parsing
  - Test ranking logic (market cap, score)
  - Test exact vs fuzzy matching
  - Test fallback to stripped symbol

- [ ] **Data extraction tests**
  - Test profile parsing (name, description, logo, links)
  - Test HTML stripping logic
  - Test data URL conversion
  - Test edge cases (missing fields, null values)

- [ ] **Rate limiting tests**
  - Test request gap enforcement
  - Test exponential backoff
  - Test batch size limits
  - Test error recovery

### 7.2 Integration Tests
- [ ] **New asset detection tests**
  - Test detection from Market Data symbols
  - Test comparison logic (Market Data vs DB)
  - Test automatic asset creation
  - Test error handling

- [ ] **CoinGecko fetch tests**
  - Test search API integration
  - Test profile API integration
  - Test rate limiting integration
  - Test error handling integration

- [ ] **Database operation tests**
  - Test asset creation
  - Test asset updates
  - Test manifest generation
  - Test query performance

- [ ] **Manifest API tests**
  - Test manifest generation
  - Test manifest caching
  - Test response format
  - Test error handling

### 7.3 E2E Tests
- [ ] **Admin panel tests**
  - Test asset list display
  - Test asset refresh
  - Test asset edit
  - Test Binance sync
  - Test bulk operations

- [ ] **Slide-out card tests**
  - Test card opening
  - Test data display
  - Test cache behavior
  - Test error states
  - Test loading states

- [ ] **Cache behavior tests**
  - Test cache hit scenarios
  - Test cache miss scenarios
  - Test cache invalidation
  - Test cache expiration

---

## Phase 8: Documentation & Monitoring

### 8.1 Code Documentation
- [ ] **Add code comments**
  - Document complex logic (symbol matching, rate limiting)
  - Add JSDoc comments for public functions
  - Document error handling strategies
  - Document performance considerations

- [ ] **Update README**
  - Document asset enrichment system
  - Explain CoinGecko integration
  - Document admin panel usage
  - Add troubleshooting guide

### 8.2 Monitoring & Logging
- [ ] **Add comprehensive logging**
  - Log asset refresh operations
  - Log rate limit hits
  - Log errors with context
  - Log performance metrics

- [ ] **Add monitoring**
  - Monitor CoinGecko API usage
  - Monitor refresh cycle performance
  - Monitor cache hit rates
  - Monitor error rates

- [ ] **Add alerts**
  - Alert on high error rates
  - Alert on rate limit hits
  - Alert on refresh cycle failures
  - Alert on data quality issues

---

## Phase 9: Cleanup & Polish

### 9.1 Code Cleanup
- [ ] **Remove unused code**
  - Remove deprecated functions
  - Remove commented-out code
  - Remove unused imports
  - Clean up test files

- [ ] **Refactor complex functions**
  - Break down large functions
  - Extract common logic
  - Improve code readability
  - Add type safety

### 9.2 UI/UX Polish
- [ ] **Improve loading states**
  - Add skeleton loaders for card
  - Improve loading indicators
  - Add progress feedback for bulk operations
  - Test loading states on slow networks

- [ ] **Improve error messages**
  - Make error messages user-friendly
  - Add helpful error recovery suggestions
  - Test error message display
  - Ensure errors don't break UI

- [ ] **Improve admin panel UX**
  - Add keyboard shortcuts
  - Improve form validation
  - Add confirmation dialogs
  - Test admin panel on mobile

---

## Phase 10: Production Readiness

### 10.1 Pre-Production Checklist
- [ ] **Verify all tests pass**
  - Run unit tests
  - Run integration tests
  - Run E2E tests
  - Fix any failing tests

- [ ] **Performance testing**
  - Test with large asset counts (500+)
  - Test refresh cycle performance
  - Test API response times
  - Test cache performance

- [ ] **Security review**
  - Review API security
  - Review input validation
  - Review error handling
  - Review logging (no sensitive data)

### 10.2 Production Deployment
- [ ] **Deploy to staging**
  - Test on staging environment
  - Verify all features work
  - Test with production-like data
  - Monitor performance

- [ ] **Deploy to production**
  - Deploy backend changes
  - Deploy frontend changes
  - Monitor for errors
  - Verify asset enrichment works

- [ ] **Post-deployment monitoring**
  - Monitor CoinGecko API usage
  - Monitor error rates
  - Monitor refresh cycle performance
  - Monitor user feedback

---

## Priority Order

### High Priority (Must Fix)
1. **Add description field to admin panel asset cards** (CRITICAL - Currently Missing)
2. Fix Bitcoin logo missing
3. Fix SQD description missing
4. Improve logo quality (transparent backgrounds)
5. Fix CoinGecko name display in admin panel
6. Ensure new assets are detected and enriched

### Medium Priority (Should Fix)
1. Improve symbol matching (multipliers, variations)
2. Optimize rate limiting
3. Improve error handling
4. Add comprehensive logging
5. Optimize performance

### Low Priority (Nice to Have)
1. Add unit tests
2. Add integration tests
3. Add E2E tests
4. Improve UI/UX polish
5. Add monitoring and alerts

---

## Notes

- **Test-Driven Development**: Write tests before implementing features
- **Incremental Development**: Implement features in small, testable increments
- **Documentation**: Update documentation as features are implemented
- **Monitoring**: Monitor system behavior after each change
- **User Feedback**: Gather user feedback and iterate based on feedback

