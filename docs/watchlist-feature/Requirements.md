# Watchlist Feature - Requirements Specification

**Feature:** User Watchlists with Tier-Based Limits  
**Last Updated:** December 2025  
**Status:** Requirements Gathering

---

## Overview

Users can create personal watchlists to track specific cryptocurrency symbols, independent of the main Market Data table's volume-based filtering. Watchlists allow users to monitor symbols that may fall outside their tier's visible symbol limit (e.g., Free tier's top 50).

---

## Functional Requirements

### FR1: Watchlist Creation

**FR1.1** Users can create watchlists with custom names  
**FR1.2** Watchlist names must be 1-100 characters  
**FR1.3** Watchlist names must be unique per user  
**FR1.4** Users cannot create duplicate watchlists with the same name

**Tier Limits:**
- **Free Tier:** Maximum 1 watchlist per user
- **Pro Tier:** Maximum 3 watchlists per user
- **Elite Tier:** Maximum 50 watchlists per user

### FR2: Adding Symbols to Watchlists

**FR2.1** Users can add any valid Binance symbol to a watchlist  
**FR2.2** Users can add symbols that are not currently visible in their tier's Market Data table  
**FR2.3** Duplicate symbols cannot be added to the same watchlist  
**FR2.4** Symbols can be added to multiple watchlists

**Tier Limits:**
- **Free Tier:** Maximum 10 unique symbols total across all watchlists
- **Pro Tier:** Maximum 30 unique symbols total across all watchlists
- **Elite Tier:** Unlimited symbols (no hard limit, but reasonable usage expected)

**FR2.5** When adding a symbol, system must check:
- If user has reached watchlist creation limit
- If user has reached symbol limit (counting unique symbols across all watchlists)
- If symbol already exists in the target watchlist

### FR3: Removing Symbols from Watchlists

**FR3.1** Users can remove symbols from watchlists  
**FR3.2** Removing a symbol does not affect other watchlists containing the same symbol  
**FR3.3** Removing symbols frees up space in the user's symbol limit quota

### FR4: Watchlist Management

**FR4.1** Users can view all their watchlists  
**FR4.2** Users can view symbols within each watchlist  
**FR4.3** Users can rename watchlists  
**FR4.4** Users can delete watchlists  
**FR4.5** Deleting a watchlist removes all symbols from that watchlist  
**FR4.6** Deleting a watchlist frees up space in the user's watchlist creation limit

### FR5: Watchlist Filtering in Market Data Table

**FR5.1** Users can filter Market Data table by watchlist  
**FR5.2** When filtered by watchlist, table shows only symbols in that watchlist  
**FR5.3** Watchlist-filtered view fetches individual symbol data (not volume-ranked list)  
**FR5.4** Watchlist-filtered view shows symbols even if they're outside tier's normal visibility  
**FR5.5** Users can switch back to "All Symbols" view  
**FR5.6** Filter dropdown shows all user's watchlists

### FR6: Visual Indicators

**FR6.1** Market Data table shows which symbols are in watchlists (star icon)  
**FR6.2** Symbols in watchlists show filled star icon  
**FR6.3** Symbols not in watchlists show outline star icon  
**FR6.4** Clicking star icon opens watchlist selector  
**FR6.5** Watchlist selector shows which watchlists already contain the symbol

### FR7: Export Functionality

**FR7.1** Users can export watchlists to TradingView format  
**FR7.2** Export respects tier limits (Free: top 50, Pro/Elite: all symbols)  
**FR7.3** Export includes only symbols currently in the watchlist

---

## Non-Functional Requirements

### NFR1: Performance

**NFR1.1** Watchlist operations (add/remove) must complete in <500ms  
**NFR1.2** Watchlist filtering must load in <1s  
**NFR1.3** Individual symbol data fetching must be batched efficiently  
**NFR1.4** Watchlist queries must not impact main Market Data table performance

### NFR2: Scalability

**NFR2.1** System must handle 10,000+ users with watchlists  
**NFR2.2** Database queries must be optimized with proper indexes  
**NFR2.3** API endpoints must handle concurrent requests

### NFR3: Security

**NFR3.1** Users can only access their own watchlists  
**NFR3.2** All watchlist operations require authentication  
**NFR3.3** Tier limits enforced on both frontend and backend  
**NFR3.4** Backend validation must prevent limit bypassing

### NFR4: User Experience

**NFR4.1** Clear error messages when limits are reached  
**NFR4.2** Visual feedback for limit status (e.g., "8/10 symbols used")  
**NFR4.3** Intuitive UI for watchlist management  
**NFR4.4** Loading states during watchlist operations

---

## Business Rules

### BR1: Tier Limits Enforcement

**BR1.1** Limits are enforced per user, not per session  
**BR1.2** Limits are checked before allowing operations  
**BR1.3** Limits apply to unique symbols (same symbol in multiple watchlists counts as 1)  
**BR1.4** Limits are cumulative across all watchlists

### BR2: Symbol Counting

**BR2.1** Unique symbols are counted across all user's watchlists  
**BR2.2** Adding BTCUSDT to Watchlist A and Watchlist B counts as 1 symbol  
**BR2.3** Removing BTCUSDT from Watchlist A (but still in Watchlist B) does not free quota  
**BR2.4** Only when symbol is removed from ALL watchlists does quota free up

### BR3: Watchlist Limits

**BR3.1** Watchlist count limit is independent of symbol limit  
**BR3.2** User can have 1 watchlist with 10 symbols (Free tier)  
**BR3.3** User can have 3 watchlists with 10 symbols each (Pro tier, if under 30 total)

---

## Edge Cases

### EC1: Limit Reached Scenarios

**EC1.1** User tries to create watchlist when at limit  
**EC1.2** User tries to add symbol when at symbol limit  
**EC1.3** User tries to add duplicate symbol to same watchlist  
**EC1.4** User upgrades tier and gains more limits  
**EC1.5** User downgrades tier and exceeds new limits → **All watchlists deleted, user starts from scratch**

### EC2: Symbol Edge Cases

**EC2.1** Symbol no longer exists on Binance  
**EC2.2** Symbol has zero volume  
**EC2.3** Symbol name changes on Binance  
**EC2.4** Invalid symbol format entered

### EC3: Data Consistency

**EC3.1** User deletes account - watchlists should be deleted (cascade)  
**EC3.2** Contract record deleted - watchlist items should handle gracefully  
**EC3.3** Concurrent modifications to same watchlist

### EC4: Migration

**EC4.1** Existing users with watchlists (if any) need limit enforcement  
**EC4.2** Users exceeding new limits need handling strategy

---

## Acceptance Criteria

### AC1: Watchlist Creation

**Given** a Free tier user with 0 watchlists  
**When** they create a watchlist named "My Favorites"  
**Then** watchlist is created successfully  
**And** they can add symbols to it

**Given** a Free tier user with 1 watchlist  
**When** they try to create a second watchlist  
**Then** error message: "Free tier limit: Maximum 1 watchlist. Upgrade to Pro for 3 watchlists."

### AC2: Adding Symbols

**Given** a Free tier user with 1 watchlist containing 9 symbols  
**When** they add a 10th unique symbol  
**Then** symbol is added successfully

**Given** a Free tier user with 1 watchlist containing 10 symbols  
**When** they try to add an 11th unique symbol  
**Then** error message: "Free tier limit: Maximum 10 symbols. Upgrade to Pro for 30 symbols."

**Given** a Pro tier user with 2 watchlists containing 29 unique symbols total  
**When** they try to add a 30th unique symbol  
**Then** symbol is added successfully

**Given** a Pro tier user with 3 watchlists containing 30 unique symbols total  
**When** they try to add a 31st unique symbol  
**Then** error message: "Pro tier limit: Maximum 30 symbols. Upgrade to Elite for unlimited symbols."

### AC3: Watchlist Filtering

**Given** a Free tier user with a watchlist containing "DOGEUSDT" (ranked #200)  
**When** they filter Market Data table by that watchlist  
**Then** DOGEUSDT appears in the table  
**And** market data is fetched individually for DOGEUSDT  
**And** table shows only symbols from that watchlist

### AC4: Visual Indicators

**Given** a user viewing Market Data table  
**When** a symbol is in at least one watchlist  
**Then** filled star icon is displayed  
**And** clicking star opens watchlist selector  
**And** selector shows which watchlists contain the symbol

---

## Test Scenarios (TDD Approach)

### Test Suite 1: Watchlist Creation Limits

1. **Test:** Free tier user creates first watchlist → Success
2. **Test:** Free tier user creates second watchlist → Error (limit reached)
3. **Test:** Pro tier user creates 3 watchlists → Success
4. **Test:** Pro tier user creates 4th watchlist → Error (limit reached)
5. **Test:** User upgrades from Free to Pro → Can create 2 more watchlists

### Test Suite 2: Symbol Addition Limits

1. **Test:** Free tier user adds 10 unique symbols → Success
2. **Test:** Free tier user adds 11th unique symbol → Error (limit reached)
3. **Test:** Free tier user adds same symbol to different watchlist → Success (counts as 1)
4. **Test:** Pro tier user adds 30 unique symbols → Success
5. **Test:** Pro tier user adds 31st unique symbol → Error (limit reached)
6. **Test:** User removes symbol from one watchlist (still in another) → Quota not freed
7. **Test:** User removes symbol from all watchlists → Quota freed

### Test Suite 3: Watchlist Filtering

1. **Test:** Filter by watchlist shows only watchlist symbols
2. **Test:** Filter shows symbols outside tier's normal visibility
3. **Test:** Individual symbol data fetched correctly
4. **Test:** Switching back to "All Symbols" shows normal view
5. **Test:** Empty watchlist shows empty state message

### Test Suite 4: Edge Cases

1. **Test:** Add invalid symbol → Error
2. **Test:** Add symbol that no longer exists → Handle gracefully
3. **Test:** Concurrent watchlist modifications → No data corruption
4. **Test:** Delete watchlist frees watchlist quota
5. **Test:** Delete watchlist does not free symbol quota if symbol in other watchlists

---

## Open Questions

1. ~~**Q:** What are Elite tier limits?~~ **A:** 50 watchlists max, unlimited symbols
2. ~~**Q:** When user downgrades tier and exceeds new limits~~ **A:** Force deletion - all watchlists deleted, user starts from scratch
3. **Q:** Should watchlist limits be displayed in UI proactively or only on error? **A:** Display proactively for better UX
4. ~~**Q:** Should we allow bulk operations~~ **A:** Not in initial implementation, add later
5. ~~**Q:** Should watchlists be shareable~~ **A:** Future feature, not included now

---

## Success Metrics

- **Adoption Rate:** % of users who create at least one watchlist
- **Usage Rate:** Average watchlists per user
- **Symbols per Watchlist:** Average symbols per watchlist
- **Filter Usage:** % of users who use watchlist filtering
- **Error Rate:** % of failed operations due to limits
- **Performance:** Average response time for watchlist operations

---

**Document Version:** 1.0  
**Next Steps:** Review requirements, confirm Elite tier limits, proceed to Design phase

