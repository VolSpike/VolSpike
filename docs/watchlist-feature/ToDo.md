# Watchlist Feature - Implementation To-Do List

**Feature:** User Watchlists with Tier-Based Limits  
**Last Updated:** December 2025  
**Status:** Planning Phase

---

## Implementation Phases

### Phase 1: Backend Foundation (TDD)
### Phase 2: Backend API Endpoints
### Phase 3: Frontend Components
### Phase 4: Integration & Testing
### Phase 5: Polish & Documentation

---

## Phase 1: Backend Foundation (TDD)

### 1.1 Write Tests for WatchlistService

**File:** `volspike-nodejs-backend/src/__tests__/services/watchlist-service.test.ts`

**Test Cases:**

- [ ] **Test:** `getLimits()` returns correct limits for Free tier
  - Free: watchlistLimit = 1, symbolLimit = 10
- [ ] **Test:** `getLimits()` returns correct limits for Pro tier
  - Pro: watchlistLimit = 3, symbolLimit = 30
- [ ] **Test:** `getLimits()` returns correct limits for Elite tier
  - Elite: watchlistLimit = 50 (or unlimited), symbolLimit = 500 (or unlimited)
- [ ] **Test:** `countUniqueSymbols()` counts unique symbols across all watchlists
  - User has BTCUSDT in Watchlist A and Watchlist B → count = 1
- [ ] **Test:** `countUniqueSymbols()` handles empty watchlists
  - User has no watchlists → count = 0
- [ ] **Test:** `countWatchlists()` returns correct count
  - User has 2 watchlists → count = 2
- [ ] **Test:** `canCreateWatchlist()` allows creation when under limit
  - Free tier user with 0 watchlists → allowed = true
- [ ] **Test:** `canCreateWatchlist()` prevents creation when at limit
  - Free tier user with 1 watchlist → allowed = false, reason provided
- [ ] **Test:** `canAddSymbol()` allows addition when under limit
  - Free tier user with 9 unique symbols → allowed = true
- [ ] **Test:** `canAddSymbol()` prevents addition when at limit
  - Free tier user with 10 unique symbols → allowed = false
- [ ] **Test:** `canAddSymbol()` detects duplicate in same watchlist
  - Symbol already in watchlist → isDuplicate = true, allowed = false
- [ ] **Test:** `canAddSymbol()` allows same symbol in different watchlist
  - Symbol in Watchlist A, adding to Watchlist B → allowed = true (counts as 1)
- [ ] **Test:** `getLimitStatus()` returns correct status
  - Includes limits, usage, remaining counts

### 1.2 Implement WatchlistService

**File:** `volspike-nodejs-backend/src/services/watchlist-service.ts`

- [ ] Implement `getLimits()` method
- [ ] Implement `countUniqueSymbols()` method
  - Use efficient SQL query with DISTINCT
  - Cache result if needed
- [ ] Implement `countWatchlists()` method
- [ ] Implement `canCreateWatchlist()` method
- [ ] Implement `canAddSymbol()` method
  - Check symbol limit
  - Check duplicate in watchlist
  - Check if symbol exists in other watchlists
- [ ] Implement `getLimitStatus()` method
- [ ] Add error handling
- [ ] Add logging

### 1.3 Write Tests for Limit Validation

**File:** `volspike-nodejs-backend/src/__tests__/routes/watchlist.test.ts`

- [ ] **Test:** POST /api/watchlist validates watchlist limit
- [ ] **Test:** POST /api/watchlist/:id/symbols validates symbol limit
- [ ] **Test:** POST /api/watchlist/:id/symbols prevents duplicate symbols
- [ ] **Test:** DELETE /api/watchlist/:id frees watchlist quota
- [ ] **Test:** DELETE /api/watchlist/:id/symbols/:symbol frees symbol quota only if not in other watchlists

---

## Phase 2: Backend API Endpoints

### 2.1 Enhance Watchlist Routes

**File:** `volspike-nodejs-backend/src/routes/watchlist.ts`

- [ ] Add limit checking to `POST /api/watchlist`
  - Call `WatchlistService.canCreateWatchlist()`
  - Return error if limit reached
  - Include limit info in response
- [ ] Add limit checking to `POST /api/watchlist/:id/symbols`
  - Call `WatchlistService.canAddSymbol()`
  - Return error if limit reached
  - Return error if duplicate
  - Include limit info in response
- [ ] Update `GET /api/watchlist` to include limit status
  - Add limits object to response
  - Include current usage counts
- [ ] Add `GET /api/watchlist/limits` endpoint
  - Return tier, limits, usage, remaining counts
- [ ] Add `PATCH /api/watchlist/:id` endpoint
  - Allow renaming watchlists
  - Validate name uniqueness
- [ ] Add validation for symbol format
  - Use regex: `/^[A-Z0-9]+USDT$/`
- [ ] Add error handling middleware
  - Consistent error response format
  - User-friendly error messages

### 2.2 Create Market Data Endpoints for Watchlists

**File:** `volspike-nodejs-backend/src/routes/market.ts`

- [ ] Add `GET /api/market/symbol/:symbol` endpoint
  - Fetch individual symbol data from Binance
  - Cache response if needed
  - Handle invalid symbols gracefully
- [ ] Add `GET /api/market/watchlist/:id` endpoint
  - Get all symbols in watchlist
  - Fetch individual market data for each symbol
  - Batch fetch for performance
  - Return array of MarketData
- [ ] Add error handling
  - Symbol not found
  - Watchlist not found
  - User doesn't own watchlist

### 2.3 Update Existing Routes

**File:** `volspike-nodejs-backend/src/routes/watchlist.ts`

- [ ] Update `DELETE /api/watchlist/:id` to return updated limits
- [ ] Update `DELETE /api/watchlist/:id/symbols/:symbol` to return updated limits
- [ ] Ensure all endpoints return consistent response format

### 2.4 Register Routes

**File:** `volspike-nodejs-backend/src/index.ts`

- [ ] Ensure watchlist routes are registered
- [ ] Ensure market routes include new endpoints
- [ ] Add route documentation

---

## Phase 3: Frontend Components

### 3.1 Create Watchlist Hooks

**File:** `volspike-nextjs-frontend/src/hooks/use-watchlists.ts`

- [ ] Create `useWatchlists()` hook
  - Fetch watchlists with React Query
  - Mutations for create/delete/rename
  - Mutations for add/remove symbols
  - Cache management
- [ ] Create `useWatchlistLimits()` hook
  - Fetch limit status
  - Provide helper functions
  - Update on watchlist changes

### 3.2 Create WatchlistSelector Component

**File:** `volspike-nextjs-frontend/src/components/watchlist-selector.tsx`

- [ ] Create component structure
- [ ] Fetch user's watchlists
- [ ] Display watchlist selection UI
  - Radio buttons for existing watchlists
  - Create new watchlist option
  - Show which watchlists contain symbol
- [ ] Implement create watchlist flow
  - Input field for name
  - Validation
  - API call
- [ ] Implement add symbol flow
  - API call to add symbol
  - Error handling
  - Success feedback
- [ ] Display limit status
  - Show current usage
  - Show remaining capacity
  - Disable when at limit
- [ ] Handle errors gracefully
  - Limit reached errors
  - Duplicate symbol errors
  - Network errors
- [ ] Add loading states
- [ ] Add success/error toasts

### 3.3 Create WatchlistFilter Component

**File:** `volspike-nextjs-frontend/src/components/watchlist-filter.tsx`

- [ ] Create dropdown component
- [ ] Fetch user's watchlists
- [ ] Display "All Symbols" option
- [ ] Display list of watchlists
- [ ] Handle selection
- [ ] Show current selection
- [ ] Fetch watchlist data when selected
- [ ] Handle empty watchlists

### 3.4 Create WatchlistManagement Page

**File:** `volspike-nextjs-frontend/src/app/watchlists/page.tsx`

- [ ] Create page layout
- [ ] Display all watchlists
- [ ] Show symbols in each watchlist
- [ ] Implement create watchlist
- [ ] Implement rename watchlist
- [ ] Implement delete watchlist
- [ ] Implement remove symbol
- [ ] Display limit status
- [ ] Add empty states
- [ ] Add loading states

### 3.5 Enhance Market Table Component

**File:** `volspike-nextjs-frontend/src/components/market-table.tsx`

- [ ] Add watchlist filter dropdown
  - Integrate WatchlistFilter component
  - Handle filter state
  - Fetch watchlist data when filtered
- [ ] Add star icon indicators
  - Show filled/outline based on watchlist membership
  - Click handler to open WatchlistSelector
  - Hover tooltip showing which watchlists
- [ ] Update data fetching logic
  - Normal: use existing market data hook
  - Filtered: fetch watchlist symbols individually
- [ ] Update `handleAddToWatchlist` function
  - Open WatchlistSelector
  - Pass symbol to selector
- [ ] Handle watchlist-filtered view
  - Different data source
  - Show "Filtered by: Watchlist Name" badge
  - Allow clearing filter

### 3.6 Update Dashboard Component

**File:** `volspike-nextjs-frontend/src/components/dashboard.tsx`

- [ ] Pass watchlist props to MarketTable
- [ ] Handle watchlist filter state
- [ ] Update data fetching based on filter

---

## Phase 4: Integration & Testing

### 4.1 Integration Testing

- [ ] Test full flow: Create watchlist → Add symbols → Filter table
- [ ] Test limit enforcement end-to-end
- [ ] Test error handling flows
- [ ] Test edge cases
  - Symbol outside tier visibility
  - Empty watchlists
  - Concurrent operations

### 4.2 E2E Testing

- [ ] **Test:** Free tier user creates watchlist and adds 10 symbols
- [ ] **Test:** Free tier user tries to add 11th symbol → Error
- [ ] **Test:** Free tier user tries to create 2nd watchlist → Error
- [ ] **Test:** Pro tier user creates 3 watchlists with 30 symbols total
- [ ] **Test:** User filters table by watchlist → Shows only watchlist symbols
- [ ] **Test:** User filters by watchlist with symbol outside top 50 → Symbol appears
- [ ] **Test:** User removes symbol from watchlist → Quota updates correctly

### 4.3 Performance Testing

- [ ] Test watchlist filtering performance
- [ ] Test individual symbol fetching performance
- [ ] Test limit calculation performance
- [ ] Optimize slow queries

### 4.4 Security Testing

- [ ] Test authentication requirements
- [ ] Test authorization (users can't access others' watchlists)
- [ ] Test limit bypass attempts
- [ ] Test input validation

---

## Phase 5: Polish & Documentation

### 5.1 UI/UX Polish

- [ ] Add loading skeletons
- [ ] Add empty states
- [ ] Add error states
- [ ] Improve error messages
- [ ] Add tooltips
- [ ] Add keyboard shortcuts
- [ ] Improve mobile responsiveness

### 5.2 Documentation

- [ ] Update API documentation
- [ ] Add component documentation
- [ ] Update user guide
- [ ] Add inline code comments
- [ ] Update README if needed

### 5.3 Monitoring & Analytics

- [ ] Add error tracking
- [ ] Add usage analytics
- [ ] Monitor limit hit rates
- [ ] Monitor performance metrics

---

## Test-Driven Development Checklist

### Before Writing Code

- [ ] Write test for feature
- [ ] Run test (should fail - Red)
- [ ] Write minimal code to pass test
- [ ] Run test (should pass - Green)
- [ ] Refactor if needed
- [ ] Repeat

### Test Coverage Goals

- [ ] Backend service layer: 90%+ coverage
- [ ] Backend routes: 80%+ coverage
- [ ] Frontend components: 70%+ coverage
- [ ] Critical paths: 100% coverage

---

## Implementation Order (Recommended)

1. **Backend Service Layer** (TDD)
   - Write tests first
   - Implement WatchlistService
   - Ensure all tests pass

2. **Backend API Endpoints**
   - Add limit checking
   - Add new endpoints
   - Test with integration tests

3. **Frontend Hooks**
   - Create useWatchlists hook
   - Create useWatchlistLimits hook
   - Test hooks

4. **Frontend Components**
   - WatchlistSelector
   - WatchlistFilter
   - WatchlistManagement page

5. **Market Table Integration**
   - Add filter dropdown
   - Add star icons
   - Update data fetching

6. **Testing & Polish**
   - E2E tests
   - Performance optimization
   - UI polish

---

## Open Questions to Resolve

- [ ] **Elite Tier Limits:** Confirm unlimited or set reasonable limits
- [ ] **Downgrade Handling:** How to handle users who downgrade and exceed limits?
- [ ] **Existing Users:** Grandfather existing watchlists or enforce limits immediately?
- [ ] **Bulk Operations:** Allow adding multiple symbols at once?
- [ ] **Watchlist Sharing:** Future feature or include now?

---

## Definition of Done

- [ ] All tests passing (unit, integration, E2E)
- [ ] Limit enforcement working on backend and frontend
- [ ] Watchlist filtering working correctly
- [ ] Symbols outside tier visibility appear in watchlist view
- [ ] Error handling comprehensive
- [ ] Performance acceptable (<1s for operations)
- [ ] UI/UX polished
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Deployed to production

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Next Steps:** Begin Phase 1 - Backend Foundation (TDD)

