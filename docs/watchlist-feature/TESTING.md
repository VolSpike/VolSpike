# Watchlist Feature - Web Interface Testing Guide

## Overview
This document provides comprehensive test scenarios for the tier-based watchlist feature. All tests should be performed in a browser environment with proper authentication.

## Prerequisites
- User accounts for each tier: Free, Pro, Elite
- Browser DevTools open for network monitoring
- Database access for verification (optional)

---

## Test Suite 1: Watchlist Creation & Management

### TC-1.1: Create First Watchlist (Free Tier)
**Objective:** Verify Free tier users can create their first watchlist

**Steps:**
1. Sign in as Free tier user
2. Navigate to Market Data table
3. Click on any symbol's star icon (or "Add to Watchlist" button)
4. In the WatchlistSelector dialog, click "Create New Watchlist"
5. Enter watchlist name: "My Favorites"
6. Click "Create Watchlist"

**Expected Results:**
- ✅ Watchlist created successfully
- ✅ Success toast notification appears
- ✅ Dialog shows new watchlist in list
- ✅ Limit status shows: "Watchlists: 1 / 1"
- ✅ "Create New Watchlist" button is disabled
- ✅ Watchlist appears in WatchlistFilter dropdown

**Validation:**
- Check Network tab: `POST /api/watchlist` returns 200
- Verify limit status: `remainingWatchlists: 0`

---

### TC-1.2: Attempt to Create Second Watchlist (Free Tier - Should Fail)
**Objective:** Verify Free tier limit enforcement

**Steps:**
1. As Free tier user with 1 watchlist
2. Click "Add to Watchlist" on any symbol
3. Click "Create New Watchlist"
4. Enter name: "Second List"
5. Click "Create Watchlist"

**Expected Results:**
- ❌ Error toast: "FREE tier limit: Maximum 1 watchlist. You have 1/1 watchlists."
- ❌ Watchlist not created
- ❌ Dialog remains open
- ✅ "Create New Watchlist" button shows limit message

**Validation:**
- Check Network tab: `POST /api/watchlist` returns 403
- Error response contains limit information

---

### TC-1.3: Create Multiple Watchlists (Pro Tier)
**Objective:** Verify Pro tier users can create up to 3 watchlists

**Steps:**
1. Sign in as Pro tier user
2. Create watchlist: "DeFi Coins"
3. Create watchlist: "Meme Coins"
4. Create watchlist: "Blue Chips"
5. Attempt to create 4th watchlist: "Test"

**Expected Results:**
- ✅ First 3 watchlists created successfully
- ✅ Limit status updates: "Watchlists: 3 / 3"
- ✅ After 3rd watchlist, "Create New Watchlist" button disabled
- ❌ 4th watchlist creation fails with limit error
- ✅ All 3 watchlists visible in WatchlistFilter dropdown

**Validation:**
- Verify each creation returns 200
- 4th attempt returns 403
- Check limit status after each creation

---

### TC-1.4: Edit Watchlist Name
**Objective:** Verify watchlist renaming functionality

**Steps:**
1. Create a watchlist: "Old Name"
2. Click edit icon (pencil) next to watchlist name
3. Change name to "New Name"
4. Click checkmark to save

**Expected Results:**
- ✅ Watchlist name updates immediately
- ✅ Success toast: "Watchlist updated"
- ✅ Updated name appears in WatchlistFilter dropdown
- ✅ Edit mode closes after save

**Validation:**
- Check Network tab: `PATCH /api/watchlist/:id` returns 200
- Verify name change persists after page refresh

---

### TC-1.5: Delete Watchlist
**Objective:** Verify watchlist deletion

**Steps:**
1. Create a watchlist with symbols
2. Click delete icon (trash) next to watchlist
3. Confirm deletion in browser prompt
4. Verify watchlist removed

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Watchlist deleted after confirmation
- ✅ Success toast: "Watchlist deleted"
- ✅ Watchlist removed from list
- ✅ Watchlist removed from WatchlistFilter dropdown
- ✅ Limit status updates (remaining count increases)

**Validation:**
- Check Network tab: `DELETE /api/watchlist/:id` returns 200
- Verify symbols in deleted watchlist are not affected (they remain in other watchlists if present)

---

## Test Suite 2: Adding Symbols to Watchlists

### TC-2.1: Add Symbol to Empty Watchlist (Free Tier)
**Objective:** Verify symbol addition within limits

**Steps:**
1. As Free tier user with 1 empty watchlist
2. Click star icon on BTCUSDT symbol
3. Select watchlist from dialog
4. Click "Add BTCUSDT"

**Expected Results:**
- ✅ Symbol added successfully
- ✅ Success toast: "Added BTCUSDT to watchlist"
- ✅ Dialog closes
- ✅ Star icon becomes filled (indicates symbol in watchlist)
- ✅ Limit status: "Symbols: 1 / 10"

**Validation:**
- Check Network tab: `POST /api/watchlist/:id/symbols` returns 200
- Verify symbol appears in watchlist when filtered
- Star icon state persists after page refresh

---

### TC-2.2: Add Multiple Symbols (Free Tier - Up to Limit)
**Objective:** Verify Free tier can add up to 10 unique symbols

**Steps:**
1. As Free tier user with 1 watchlist
2. Add symbols: BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, DOTUSDT, LINKUSDT, MATICUSDT, AVAXUSDT, ATOMUSDT, ALGOUSDT
3. Verify limit status after each addition
4. Attempt to add 11th symbol: BNBUSDT

**Expected Results:**
- ✅ First 10 symbols added successfully
- ✅ Limit status updates: "Symbols: 10 / 10"
- ✅ After 10th symbol, limit reached
- ❌ 11th symbol addition fails
- ❌ Error toast: "FREE tier limit: Maximum 10 symbols. You have 10/10 symbols."

**Validation:**
- Check limit status after each addition
- Verify 11th attempt returns 403
- All 10 symbols visible in watchlist filter

---

### TC-2.3: Add Same Symbol to Different Watchlists (Pro Tier)
**Objective:** Verify same symbol can exist in multiple watchlists (counts as 1 unique symbol)

**Steps:**
1. As Pro tier user with 2 watchlists: "List A" and "List B"
2. Add BTCUSDT to "List A"
3. Add BTCUSDT to "List B"
4. Check limit status

**Expected Results:**
- ✅ BTCUSDT added to both watchlists successfully
- ✅ Limit status shows: "Symbols: 1 / 30" (not 2)
- ✅ Both watchlists contain BTCUSDT
- ✅ Star icon shows filled state (symbol is in at least one watchlist)

**Validation:**
- Verify symbol count is 1, not 2
- Both watchlists show BTCUSDT when filtered
- Limit allows 29 more unique symbols

---

### TC-2.4: Attempt to Add Duplicate Symbol to Same Watchlist
**Objective:** Verify duplicate prevention within same watchlist

**Steps:**
1. Add BTCUSDT to watchlist "My List"
2. Click star icon on BTCUSDT again
3. Select same watchlist "My List"
4. Attempt to add

**Expected Results:**
- ❌ Error toast: "This symbol is already in this watchlist."
- ❌ Symbol not added again
- ✅ Watchlist unchanged
- ✅ Network request returns 409 (Conflict)

**Validation:**
- Check Network tab: `POST /api/watchlist/:id/symbols` returns 409
- Verify watchlist still contains only one BTCUSDT entry

---

### TC-2.5: Add Symbol from Asset Detail Drawer
**Objective:** Verify "Add to Watchlist" button in detail drawer

**Steps:**
1. Click on any symbol row to open detail drawer
2. Click "Add to Watchlist" button
3. Select watchlist or create new one
4. Add symbol

**Expected Results:**
- ✅ WatchlistSelector dialog opens
- ✅ Symbol pre-filled in dialog
- ✅ After selection, symbol added successfully
- ✅ Drawer remains open (or closes based on UX)
- ✅ Star icon updates to filled state

**Validation:**
- Verify same functionality as star icon method
- Check button text changes to "Manage in Watchlist" if symbol already in watchlist

---

## Test Suite 3: Watchlist Filtering

### TC-3.1: Filter Market Table by Watchlist
**Objective:** Verify watchlist filtering displays only watchlist symbols

**Steps:**
1. Create watchlist with 3 symbols: BTCUSDT, ETHUSDT, SOLUSDT
2. Add these symbols to watchlist
3. Click WatchlistFilter dropdown
4. Select the watchlist
5. Verify table content

**Expected Results:**
- ✅ Table shows only 3 symbols (BTCUSDT, ETHUSDT, SOLUSDT)
- ✅ Filter badge shows watchlist name and count (3)
- ✅ Clear filter button (X) appears
- ✅ All symbols visible regardless of volume ranking
- ✅ Sorting still works on filtered data

**Validation:**
- Check Network tab: `GET /api/market/watchlist/:id` called
- Verify response contains only watchlist symbols
- Symbols outside tier limits (e.g., low volume) still visible

---

### TC-3.2: Clear Watchlist Filter
**Objective:** Verify clearing filter returns to full table

**Steps:**
1. Apply watchlist filter (from TC-3.1)
2. Click clear filter button (X) or select "All Symbols"
3. Verify table content

**Expected Results:**
- ✅ Filter cleared
- ✅ Table shows all symbols (respecting tier limits)
- ✅ Clear button disappears
- ✅ Filter dropdown shows "All Symbols"

**Validation:**
- Verify full market data endpoint called again
- Table returns to normal tier-based display

---

### TC-3.3: Filter Empty Watchlist
**Objective:** Verify empty watchlist handling

**Steps:**
1. Create empty watchlist
2. Select watchlist in filter
3. Verify table display

**Expected Results:**
- ✅ Empty state message: "This watchlist is empty."
- ✅ Message: "Add symbols from the market table to get started."
- ✅ No symbols displayed
- ✅ Filter still shows watchlist name

**Validation:**
- Check Network tab: `GET /api/market/watchlist/:id` returns empty array
- Empty state UI displays correctly

---

### TC-3.4: Filter with Symbols Outside Tier Limits
**Objective:** Verify symbols outside normal tier visibility are shown in watchlist

**Steps:**
1. As Free tier user (normally sees top 50)
2. Add a symbol ranked #100 by volume to watchlist
3. Filter by watchlist
4. Verify symbol appears

**Expected Results:**
- ✅ Symbol #100 appears in filtered view
- ✅ Individual symbol data fetched successfully
- ✅ All watchlist symbols visible regardless of ranking

**Validation:**
- Check Network tab: Individual symbol fetches occur
- Verify symbol data loads correctly

---

## Test Suite 4: Star Icon States & Visual Feedback

### TC-4.1: Star Icon - Not in Watchlist
**Objective:** Verify empty star icon for symbols not in watchlist

**Steps:**
1. Ensure symbol (e.g., BTCUSDT) is not in any watchlist
2. Hover over symbol row
3. Observe star icon

**Expected Results:**
- ✅ Star icon appears on hover (empty/unfilled)
- ✅ Tooltip: "Add to watchlist"
- ✅ Icon clickable

**Validation:**
- Verify icon CSS class does not include "fill-current"
- Icon color matches design system

---

### TC-4.2: Star Icon - In Watchlist
**Objective:** Verify filled star icon for symbols in watchlist

**Steps:**
1. Add BTCUSDT to any watchlist
2. Hover over BTCUSDT row
3. Observe star icon

**Expected Results:**
- ✅ Star icon appears filled (solid)
- ✅ Icon color: brand-600 (or brand color)
- ✅ Tooltip: "Manage in watchlist"
- ✅ Icon clickable

**Validation:**
- Verify icon CSS class includes "fill-current"
- Icon visible without hover (always shown when filled)

---

### TC-4.3: Star Icon State Persistence
**Objective:** Verify star icon state persists across page interactions

**Steps:**
1. Add BTCUSDT to watchlist
2. Refresh page
3. Filter by different watchlist
4. Clear filter
5. Verify star icon state

**Expected Results:**
- ✅ Star icon remains filled after refresh
- ✅ Star icon state correct after filter changes
- ✅ State updates immediately when symbol added/removed

**Validation:**
- Verify watchlist data fetched on page load
- Icon state syncs with watchlist data

---

## Test Suite 5: Limit Status Display

### TC-5.1: Limit Status in WatchlistSelector Dialog
**Objective:** Verify limit status displays correctly

**Steps:**
1. Open WatchlistSelector dialog
2. Observe limit status section
3. Add symbols/watchlists
4. Verify status updates

**Expected Results:**
- ✅ Shows current tier
- ✅ Watchlists: "X / Y" format
- ✅ Symbols: "X / Y" format (or "X / ∞" for Elite)
- ✅ Updates in real-time after operations
- ✅ Clear visual indication of remaining capacity

**Validation:**
- Verify numbers match actual counts
- Status updates without page refresh

---

### TC-5.2: Limit Warnings
**Objective:** Verify limit warnings appear appropriately

**Steps:**
1. As Free tier user, add 9 symbols
2. Open WatchlistSelector
3. Observe limit status
4. Attempt to add 10th symbol

**Expected Results:**
- ✅ Limit status shows: "Symbols: 9 / 10"
- ✅ "Remaining: 1" displayed
- ✅ Clear warning when at limit
- ✅ Error message when limit exceeded

**Validation:**
- Verify warning messages are user-friendly
- Warnings appear before limit reached (proactive)

---

## Test Suite 6: Tier Downgrade Behavior

### TC-6.1: Watchlist Deletion on Tier Downgrade
**Objective:** Verify watchlists deleted when user downgrades

**Steps:**
1. As Pro tier user, create 2 watchlists with symbols
2. Downgrade to Free tier (via admin or subscription cancellation)
3. Sign in as Free tier user
4. Check watchlists

**Expected Results:**
- ✅ All watchlists deleted automatically
- ✅ No watchlists visible
- ✅ Can create new watchlist from scratch
- ✅ Limit status: "Watchlists: 0 / 1"

**Validation:**
- Check database: No watchlists for user
- Verify deletion happens on tier change webhook
- User can start fresh

---

### TC-6.2: Watchlist Preservation on Tier Upgrade
**Objective:** Verify watchlists preserved when upgrading

**Steps:**
1. As Free tier user, create 1 watchlist with 5 symbols
2. Upgrade to Pro tier
3. Verify watchlists

**Expected Results:**
- ✅ Existing watchlist preserved
- ✅ All symbols intact
- ✅ Can create 2 more watchlists (total 3)
- ✅ Can add 25 more symbols (total 30)

**Validation:**
- Verify watchlist data unchanged
- New limits apply immediately
- Can use additional capacity

---

## Test Suite 7: Error Handling & Edge Cases

### TC-7.1: Network Error Handling
**Objective:** Verify graceful error handling

**Steps:**
1. Open browser DevTools → Network tab
2. Set network to "Offline"
3. Attempt to create watchlist
4. Attempt to add symbol

**Expected Results:**
- ✅ Error toast appears
- ✅ User-friendly error message
- ✅ UI remains functional
- ✅ Can retry after network restored

**Validation:**
- Verify error messages are clear
- No UI crashes or broken states

---

### TC-7.2: Concurrent Operations
**Objective:** Verify handling of rapid operations

**Steps:**
1. Rapidly click "Add to Watchlist" multiple times
2. Rapidly create/delete watchlists
3. Verify state consistency

**Expected Results:**
- ✅ No duplicate entries
- ✅ State updates correctly
- ✅ Loading states prevent double-submission
- ✅ Final state is correct

**Validation:**
- Verify API called only once per action
- State matches server state

---

### TC-7.3: Invalid Symbol Handling
**Objective:** Verify invalid symbol rejection

**Steps:**
1. Attempt to add invalid symbol (e.g., "INVALID")
2. Attempt to add symbol with wrong format
3. Verify error handling

**Expected Results:**
- ❌ Invalid symbol rejected
- ✅ Error toast with clear message
- ✅ Validation happens before API call

**Validation:**
- Check client-side validation
- Verify backend also validates

---

### TC-7.4: Empty Watchlist Name
**Objective:** Verify watchlist name validation

**Steps:**
1. Attempt to create watchlist with empty name
2. Attempt to create watchlist with only spaces
3. Attempt to rename to empty name

**Expected Results:**
- ❌ Empty name rejected
- ✅ Error toast: "Please enter a watchlist name"
- ✅ Create button disabled for empty name

**Validation:**
- Verify client and server validation
- Clear error messages

---

## Test Suite 8: Mobile & Responsive Design

### TC-8.1: Mobile WatchlistSelector Dialog
**Objective:** Verify mobile-friendly dialog

**Steps:**
1. Open app on mobile device (or resize browser)
2. Open WatchlistSelector dialog
3. Test all interactions

**Expected Results:**
- ✅ Dialog fits screen
- ✅ Touch targets adequate size
- ✅ Scrolling works smoothly
- ✅ All buttons accessible

**Validation:**
- Test on actual mobile device
- Verify responsive breakpoints

---

### TC-8.2: Mobile WatchlistFilter
**Objective:** Verify filter dropdown on mobile

**Steps:**
1. Open app on mobile
2. Use WatchlistFilter dropdown
3. Select watchlist
4. Verify table display

**Expected Results:**
- ✅ Dropdown opens correctly
- ✅ Options selectable
- ✅ Filter applies correctly
- ✅ Clear button accessible

**Validation:**
- Test touch interactions
- Verify mobile-specific UI adjustments

---

## Test Suite 9: Performance & Loading States

### TC-9.1: Loading States
**Objective:** Verify loading indicators

**Steps:**
1. Create watchlist (observe loading)
2. Add symbol (observe loading)
3. Filter by watchlist (observe loading)
4. Verify loading states

**Expected Results:**
- ✅ Loading indicators appear during operations
- ✅ Buttons show "Creating...", "Adding..." etc.
- ✅ UI remains responsive
- ✅ Loading clears on completion

**Validation:**
- Verify no flickering
- Loading states are clear

---

### TC-9.2: Large Watchlist Performance
**Objective:** Verify performance with many symbols

**Steps:**
1. As Elite tier user, create watchlist
2. Add 50+ symbols
3. Filter by watchlist
4. Verify performance

**Expected Results:**
- ✅ Table renders smoothly
- ✅ No lag when scrolling
- ✅ Filtering is fast
- ✅ Star icons update quickly

**Validation:**
- Check render times
- Verify no memory leaks
- Test with 100+ symbols

---

## Test Suite 10: Integration with Existing Features

### TC-10.1: Watchlist + Market Data Sorting
**Objective:** Verify sorting works with watchlist filter

**Steps:**
1. Filter by watchlist
2. Sort by volume
3. Sort by price
4. Sort by change

**Expected Results:**
- ✅ Sorting works on filtered data
- ✅ Sort order persists
- ✅ All sort options functional

**Validation:**
- Verify sorted order is correct
- No conflicts between filter and sort

---

### TC-10.2: Watchlist + Guest Mode
**Objective:** Verify watchlists hidden for guests

**Steps:**
1. Sign out
2. View Market Data table as guest
3. Verify watchlist features

**Expected Results:**
- ✅ WatchlistFilter not visible
- ✅ Star icons not visible
- ✅ "Add to Watchlist" button not visible
- ✅ Guest preview works normally

**Validation:**
- Verify guest mode detection
- No watchlist-related UI for guests

---

## Test Suite 11: API Response Validation

### TC-11.1: Watchlist API Responses
**Objective:** Verify API response structure

**Steps:**
1. Open DevTools → Network tab
2. Perform watchlist operations
3. Inspect API responses

**Expected Results:**
- ✅ `GET /api/watchlist` returns `{ watchlists: [], limits: {} }`
- ✅ `POST /api/watchlist` returns `{ watchlist: {}, limits: {} }`
- ✅ `GET /api/watchlist/limits` returns limit status
- ✅ `GET /api/market/watchlist/:id` returns `{ symbols: [], watchlistId, watchlistName }`

**Validation:**
- Verify response structure matches frontend expectations
- All required fields present

---

### TC-11.2: Error Response Handling
**Objective:** Verify error responses handled correctly

**Steps:**
1. Trigger various error scenarios
2. Inspect error responses
3. Verify frontend handling

**Expected Results:**
- ✅ 403 errors show limit messages
- ✅ 409 errors show duplicate messages
- ✅ 404 errors show not found messages
- ✅ 500 errors show generic error

**Validation:**
- Verify error messages are user-friendly
- Appropriate HTTP status codes

---

## Test Suite 12: Data Persistence

### TC-12.1: Data Persistence Across Sessions
**Objective:** Verify watchlists persist

**Steps:**
1. Create watchlists and add symbols
2. Sign out
3. Sign back in
4. Verify watchlists

**Expected Results:**
- ✅ All watchlists present
- ✅ All symbols intact
- ✅ Limit status correct
- ✅ Star icons show correct state

**Validation:**
- Verify database persistence
- Data loads correctly on login

---

### TC-12.2: Cross-Device Consistency
**Objective:** Verify watchlists sync across devices

**Steps:**
1. Create watchlist on Device A
2. Sign in on Device B
3. Verify watchlists

**Expected Results:**
- ✅ Watchlists visible on Device B
- ✅ Same symbols present
- ✅ Limit status consistent

**Validation:**
- Test on multiple browsers/devices
- Verify server-side storage

---

## Test Checklist Summary

### Critical Path Tests (Must Pass)
- [ ] TC-1.1: Create first watchlist (Free tier)
- [ ] TC-1.2: Limit enforcement (Free tier)
- [ ] TC-2.1: Add symbol to watchlist
- [ ] TC-2.2: Symbol limit enforcement
- [ ] TC-3.1: Filter by watchlist
- [ ] TC-4.2: Star icon filled state
- [ ] TC-6.1: Watchlist deletion on downgrade

### Important Tests (Should Pass)
- [ ] TC-1.3: Multiple watchlists (Pro tier)
- [ ] TC-1.4: Edit watchlist name
- [ ] TC-1.5: Delete watchlist
- [ ] TC-2.3: Same symbol in multiple watchlists
- [ ] TC-2.4: Duplicate prevention
- [ ] TC-3.2: Clear filter
- [ ] TC-5.1: Limit status display

### Edge Case Tests (Nice to Have)
- [ ] TC-7.1: Network error handling
- [ ] TC-7.2: Concurrent operations
- [ ] TC-8.1: Mobile responsiveness
- [ ] TC-9.2: Large watchlist performance

---

## Test Environment Setup

### Required Test Accounts
1. **Free Tier User**
   - Email: `free-test@volspike.com`
   - Tier: `free`
   - Limits: 1 watchlist, 10 symbols

2. **Pro Tier User**
   - Email: `pro-test@volspike.com`
   - Tier: `pro`
   - Limits: 3 watchlists, 30 symbols

3. **Elite Tier User** (if available)
   - Email: `elite-test@volspike.com`
   - Tier: `elite`
   - Limits: 50 watchlists, unlimited symbols

### Browser Testing Matrix
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Test Data Preparation
Before testing, ensure:
- Test accounts exist and are properly tiered
- Market data is available (Binance API accessible)
- Database is clean or test data is isolated

---

## Reporting Issues

When reporting bugs, include:
1. Test case number (e.g., TC-1.1)
2. Steps to reproduce
3. Expected vs actual results
4. Browser/device information
5. Network tab screenshots (if API errors)
6. Console errors (if any)
7. Screenshots/videos

---

## Notes

- All tests assume user is authenticated unless specified
- Guest mode tests should verify watchlist features are hidden
- Tier limits are enforced server-side, but UI should prevent invalid actions
- Watchlist data should persist across page refreshes
- Real-time updates should reflect watchlist changes immediately

