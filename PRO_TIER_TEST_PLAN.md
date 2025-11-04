# 🧪 Pro Tier Comprehensive Test Plan

## Prerequisites

### Step 1: Create Test Accounts

You'll need TWO test accounts to compare Free vs Pro features:

**Account 1: Free Tier User**
- Email: `free-test@volspike.com`
- Use this to verify Free tier limitations

**Account 2: Pro Tier User**
- Email: `pro-test@volspike.com`
- Use this to verify Pro tier features

### Step 2: Manually Set Pro Tier in Database

Since Stripe isn't integrated yet, manually upgrade the Pro test user:

#### Option A: Using Local PostgreSQL (Docker)

```bash
# Start your local database
docker start volspike-postgres

# Connect to PostgreSQL
docker exec -it volspike-postgres psql -U volspike -d volspike

# Update user to Pro tier
UPDATE "User" SET tier = 'pro' WHERE email = 'pro-test@volspike.com';

# Verify the change
SELECT email, tier FROM "User" WHERE email = 'pro-test@volspike.com';

# Exit
\q
```

#### Option B: Using Prisma Studio (Easier)

```bash
# Navigate to backend folder
cd volspike-nodejs-backend

# Start Prisma Studio
npx prisma studio

# In browser:
1. Open Users table
2. Find your test user (pro-test@volspike.com)
3. Click to edit
4. Change "tier" field from "free" to "pro"
5. Save
```

---

## 🎯 Test Categories

### Category 1: Market Data Updates (FREE vs PRO)

#### Test 1.1: Update Frequency

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to dashboard
- [ ] Note the "Next update in X:XX" countdown
- [ ] Verify countdown shows 15-minute intervals
- [ ] Wait for update to occur (at :00, :15, :30, or :45)
- [ ] Confirm data refreshes at wall-clock time
- [ ] **Expected**: Updates at :00, :15, :30, :45 of each hour

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to dashboard
- [ ] Note the "Next update in X:XX" countdown
- [ ] Verify countdown shows 5-minute intervals
- [ ] Wait for update to occur (at :00, :05, :10, :15, etc.)
- [ ] Confirm data refreshes at wall-clock time
- [ ] **Expected**: Updates every 5 minutes (3x faster than Free)

**Validation:**
- [ ] Free user: 15-minute cadence ✓
- [ ] Pro user: 5-minute cadence ✓
- [ ] Both aligned to wall-clock times ✓

---

#### Test 1.2: Number of Symbols Shown

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to dashboard > Market Data table
- [ ] Check the symbol count displayed (e.g., "50 symbols")
- [ ] Scroll to bottom of table
- [ ] Count actual rows shown
- [ ] **Expected**: Exactly 50 symbols

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to dashboard > Market Data table
- [ ] Check the symbol count displayed (e.g., "100 symbols")
- [ ] Scroll to bottom of table
- [ ] Count actual rows shown
- [ ] **Expected**: Exactly 100 symbols (2x more than Free)

**Validation:**
- [ ] Free user: 50 symbols max ✓
- [ ] Pro user: 100 symbols max ✓
- [ ] Pro user sees all Free symbols + 50 more ✓

---

#### Test 1.3: Open Interest Column

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Check Market Data table headers
- [ ] **Expected**: Columns are Ticker, Price, 24h Change, Funding Rate, 24h Volume
- [ ] **Expected**: NO "Open Interest" column visible

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Check Market Data table headers
- [ ] **Expected**: Open Interest column should be visible
- [ ] **Note**: Currently may show "0" or "N/A" if not implemented yet

**Validation:**
- [ ] Free user: No Open Interest column ✓
- [ ] Pro user: Open Interest column visible ✓

---

### Category 2: Volume Alerts (FREE vs PRO)

#### Test 2.1: Alert Delivery Frequency

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to Volume Alerts panel/tab
- [ ] Note "Next update in X:XX" countdown
- [ ] Wait for alerts to arrive
- [ ] **Expected**: Alerts batched every 15 minutes (:00, :15, :30, :45)
- [ ] Check browser console for WebSocket connection
- [ ] **Expected**: Console shows "Connected to volume alerts WebSocket (free tier)"

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to Volume Alerts panel/tab
- [ ] Note "Next update in X:XX" countdown
- [ ] Wait for alerts to arrive
- [ ] **Expected**: Alerts batched every 5 minutes
- [ ] Check browser console
- [ ] **Expected**: Console shows "Connected to volume alerts WebSocket (pro tier)"

**Validation:**
- [ ] Free user: 15-minute alert batches ✓
- [ ] Pro user: 5-minute alert batches (3x faster) ✓
- [ ] Both aligned to wall-clock times ✓

---

#### Test 2.2: Alert History Limit

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to Volume Alerts
- [ ] Scroll to bottom of alerts list
- [ ] Check footer text: "Showing last X alerts (Free tier: 10 max)"
- [ ] Count visible alerts
- [ ] **Expected**: Maximum 10 alerts shown

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to Volume Alerts
- [ ] Scroll to bottom of alerts list
- [ ] Check footer text: "Showing last X alerts (Pro tier: 50 max)"
- [ ] Count visible alerts (if available)
- [ ] **Expected**: Maximum 50 alerts shown (5x more than Free)

**Validation:**
- [ ] Free user: 10 alerts max ✓
- [ ] Pro user: 50 alerts max ✓

---

#### Test 2.3: Manual Refresh Button

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Look at Volume Alerts panel header
- [ ] **Expected**: NO refresh button visible (only countdown timer)

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Look at Volume Alerts panel header
- [ ] **Expected**: Refresh button (circular arrow icon) visible next to "Live" badge
- [ ] Click the refresh button
- [ ] **Expected**: Button shows spinning animation while loading
- [ ] **Expected**: Alert list refreshes immediately

**Validation:**
- [ ] Free user: No manual refresh button ✓
- [ ] Pro user: Manual refresh button visible and working ✓

---

### Category 3: Data Export (FREE vs PRO)

#### Test 3.1: TradingView Export

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to Market Data table
- [ ] Click "Export" button dropdown
- [ ] Click "TradingView (.txt)"
- [ ] File should download
- [ ] Open the .txt file
- [ ] Count the number of symbols
- [ ] **Expected**: Exactly 50 symbols (matches Free tier limit)
- [ ] **Expected**: Format: `BINANCE:ETHUSDT.P`, `BINANCE:BTCUSDT.P`, etc.

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Click "Export" > "TradingView (.txt)"
- [ ] Open the .txt file
- [ ] Count the number of symbols
- [ ] **Expected**: 100 symbols (2x more than Free)

**Validation:**
- [ ] Free user: 50 symbols in TradingView export ✓
- [ ] Pro user: 100 symbols in TradingView export ✓

---

#### Test 3.2: CSV Export (Pro Only)

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Click "Export" dropdown
- [ ] Look at "CSV (.csv)" option
- [ ] **Expected**: Shows lock icon 🔒
- [ ] Click on it
- [ ] **Expected**: Toast message: "CSV export is available for Pro and Elite tiers only"
- [ ] **Expected**: No file downloads

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Click "Export" > "CSV (.csv)"
- [ ] File should download (e.g., `volspike-market-data-2025-11-04.csv`)
- [ ] Open CSV file in Excel/Numbers/Google Sheets
- [ ] **Expected**: Columns: Symbol, Price, 24h Change %, Funding Rate %, 24h Volume, Timestamp
- [ ] **Expected**: 100 rows of data (all Pro tier symbols)
- [ ] Verify data is accurate and complete

**Validation:**
- [ ] Free user: CSV locked with toast message ✓
- [ ] Pro user: CSV downloads with 100 symbols ✓

---

#### Test 3.3: JSON Export (Pro Only)

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Click "Export" dropdown
- [ ] Look at "JSON (.json)" option
- [ ] **Expected**: Shows lock icon 🔒
- [ ] Click on it
- [ ] **Expected**: Toast message: "JSON export is available for Pro and Elite tiers only"

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Click "Export" > "JSON (.json)"
- [ ] File should download (e.g., `volspike-market-data-2025-11-04.json`)
- [ ] Open JSON file in text editor
- [ ] **Expected**: Valid JSON structure
- [ ] **Expected**: Array of 100 market data objects
- [ ] Verify each object has: symbol, price, volume24h, change24h, fundingRate, timestamp
- [ ] **Expected**: Metadata section with exportDate, tierLevel, symbolCount

**Validation:**
- [ ] Free user: JSON locked with toast message ✓
- [ ] Pro user: JSON downloads with proper structure ✓

---

### Category 4: User Interface Differences

#### Test 4.1: Tier Badge Display

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Check header (desktop): Should show "Free Tier" badge with gray Zap icon
- [ ] Open hamburger menu (mobile): Should show "Free Tier" badge
- [ ] Open profile menu (top right): Should show "Free Tier" badge
- [ ] **Expected**: All show gray Zap icon ⚡

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Check header (desktop): Should show "Pro Tier" badge with purple Star icon
- [ ] Open hamburger menu (mobile): Should show "Pro Tier" badge
- [ ] Open profile menu (top right): Should show "Pro Tier" badge with purple color
- [ ] **Expected**: All show purple Star icon ⭐

**Validation:**
- [ ] Free user: Gray Zap icon everywhere ✓
- [ ] Pro user: Purple Star icon everywhere ✓
- [ ] Tier badge color matches tier (gray vs purple) ✓

---

#### Test 4.2: Advertisement Banner

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to dashboard
- [ ] **Expected**: "Unlock Pro Features" banner visible at top
- [ ] **Expected**: Shows $9/month pricing
- [ ] **Expected**: Lists 6 features (5-min updates, 100 symbols, 50 alerts, etc.)
- [ ] Click "Upgrade to Pro" button
- [ ] **Expected**: Redirects to /pricing page

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to dashboard
- [ ] **Expected**: NO "Unlock Pro Features" banner visible
- [ ] **Expected**: Clean dashboard without ads

**Validation:**
- [ ] Free user: Banner visible ✓
- [ ] Pro user: Banner hidden ✓
- [ ] Ad-free experience for Pro users ✓

---

#### Test 4.3: Upgrade Prompts

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Open profile menu (top right)
- [ ] **Expected**: "Upgrade to Pro" button visible at bottom
- [ ] Open command palette (Cmd/Ctrl + K)
- [ ] **Expected**: "Upgrade to Pro" option in Actions section

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Open profile menu (top right)
- [ ] **Expected**: NO "Upgrade to Pro" button
- [ ] Open command palette (Cmd/Ctrl + K)
- [ ] **Expected**: NO "Upgrade to Pro" option

**Validation:**
- [ ] Free user: Upgrade prompts everywhere ✓
- [ ] Pro user: No upgrade prompts ✓

---

### Category 5: Countdown Timers (Wall-Clock Alignment)

#### Test 5.1: Market Data Countdown

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Note current time (e.g., 10:37 AM)
- [ ] Check "Next update in X:XX" countdown
- [ ] **Expected**: Countdown to next :00, :15, :30, or :45
- [ ] Example: If it's 10:37, countdown should show ~8 minutes (to 10:45)
- [ ] Wait for countdown to hit 0:00
- [ ] **Expected**: Data refreshes exactly at the wall-clock time
- [ ] **Expected**: New countdown starts immediately

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Note current time (e.g., 10:37 AM)
- [ ] Check "Next update in X:XX" countdown
- [ ] **Expected**: Countdown to next :00, :05, :10, :15, etc.
- [ ] Example: If it's 10:37, countdown should show ~3 minutes (to 10:40)
- [ ] Wait for countdown to hit 0:00
- [ ] **Expected**: Data refreshes at wall-clock time
- [ ] **Expected**: New countdown starts immediately

**Validation:**
- [ ] Free user: 15-minute wall-clock alignment ✓
- [ ] Pro user: 5-minute wall-clock alignment ✓
- [ ] Countdown accuracy within 1 second ✓

---

#### Test 5.2: Volume Alerts Countdown

**Free Tier:**
- [ ] Check Volume Alerts "Next update in X:XX"
- [ ] **Expected**: Same countdown as Market Data (15-minute intervals)
- [ ] **Expected**: Alerts and market data synchronized

**Pro Tier:**
- [ ] Check Volume Alerts "Next update in X:XX"
- [ ] **Expected**: Same countdown as Market Data (5-minute intervals)
- [ ] **Expected**: Alerts and market data synchronized

**Validation:**
- [ ] Both timers synchronized per tier ✓
- [ ] Consistent user experience ✓

---

### Category 6: Real-Time Features

#### Test 6.1: WebSocket Connection

**Free Tier:**
- [ ] Open browser console (F12)
- [ ] Look for WebSocket messages
- [ ] **Expected**: "Connected to volume alerts WebSocket (free tier)"
- [ ] **Expected**: "Binance WebSocket connected"

**Pro Tier:**
- [ ] Open browser console (F12)
- [ ] Look for WebSocket messages
- [ ] **Expected**: "Connected to volume alerts WebSocket (pro tier)"
- [ ] **Expected**: "Binance WebSocket connected"
- [ ] **Expected**: No errors or failed connection warnings

**Validation:**
- [ ] Both tiers connected to WebSocket ✓
- [ ] Tier-specific room joined ✓
- [ ] No connection errors ✓

---

#### Test 6.2: Live Data Indicators

**Free Tier:**
- [ ] Check Market Data section
- [ ] Look for "Live Data (Binance WebSocket)" indicator
- [ ] Check "Updated X seconds ago" timer
- [ ] **Expected**: Timer increments continuously
- [ ] **Expected**: Shows time since last wall-clock update (can be up to 15 minutes)

**Pro Tier:**
- [ ] Check Market Data section
- [ ] Look for "Live Data (Binance WebSocket)" indicator
- [ ] Check "Updated X seconds ago" timer
- [ ] **Expected**: Timer increments continuously
- [ ] **Expected**: Shows time since last wall-clock update (can be up to 5 minutes)

**Validation:**
- [ ] Both show live connection status ✓
- [ ] Update timers working correctly ✓

---

### Category 7: Alert Features (Pro Exclusive)

#### Test 7.1: Email Alert Subscriptions

**Free Tier:**
- [ ] Try to access alert subscription features
- [ ] **Expected**: Feature locked or not visible

**Pro Tier:**
- [ ] Click bell icon on any symbol in Market Data table
- [ ] **Expected**: Alert Builder modal opens
- [ ] **Expected**: Symbol pre-filled (e.g., "ETH")
- [ ] Configure alert settings
- [ ] **Expected**: Can set volume threshold, funding rate threshold
- [ ] Save alert
- [ ] Go to Settings > Email Alerts (or /alerts page)
- [ ] **Expected**: Saved alert appears in list
- [ ] **Expected**: Can enable/disable email notifications

**Validation:**
- [ ] Free user: Alert creation locked ✓
- [ ] Pro user: Can create alerts ✓
- [ ] Pro user: Alert Builder works ✓

---

#### Test 7.2: Symbol-Specific Subscriptions

**Pro Tier Only:**
- [ ] In Volume Alerts panel, look for subscription options
- [ ] **Expected**: Can subscribe to specific symbols for alerts
- [ ] Subscribe to a symbol (e.g., BTC)
- [ ] **Expected**: Receive email when that symbol triggers volume spike
- [ ] Unsubscribe from symbol
- [ ] **Expected**: No more emails for that symbol

**Validation:**
- [ ] Pro user: Can subscribe to symbols ✓
- [ ] Subscriptions persist across sessions ✓
- [ ] Unsubscribe works ✓

---

### Category 8: Visual Design Consistency

#### Test 8.1: Tier Badge Styling

**Free Tier:**
- [ ] Check all tier badges
- [ ] **Expected Color**: Gray background, gray icon
- [ ] **Expected Icon**: Zap (lightning bolt) ⚡

**Pro Tier:**
- [ ] Check all tier badges
- [ ] **Expected Color**: Purple background, purple icon
- [ ] **Expected Icon**: Star ⭐
- [ ] **Expected Locations**: Header, profile menu, mobile menu, settings page

**Validation:**
- [ ] Consistent styling across all locations ✓
- [ ] Correct colors per tier ✓
- [ ] Correct icons per tier ✓

---

#### Test 8.2: Dark/Light Theme

**Both Tiers:**
- [ ] Toggle theme (sun/moon icon in header)
- [ ] Switch to dark mode
- [ ] **Expected**: All tier badges, buttons, cards render correctly
- [ ] Check pricing page in dark mode
- [ ] Switch to light mode
- [ ] **Expected**: All components render correctly
- [ ] **Expected**: No contrast issues, readable text

**Validation:**
- [ ] Both themes work for Free tier ✓
- [ ] Both themes work for Pro tier ✓
- [ ] No visual bugs or broken styling ✓

---

### Category 9: Mobile Responsiveness

#### Test 9.1: Mobile Layout (Free vs Pro)

**Free Tier:**
- [ ] Resize browser to mobile width (<768px) or use phone
- [ ] Check hamburger menu
- [ ] **Expected**: Home, Dashboard, Pricing, Settings, Sign Out
- [ ] **Expected**: "Free Tier" badge visible
- [ ] **Expected**: "Upgrade to Pro" button at bottom
- [ ] Check dashboard tabs
- [ ] **Expected**: "Market Data" and "Volume Alerts" tabs
- [ ] **Expected**: Ad banner shows on mobile

**Pro Tier:**
- [ ] Resize browser to mobile width or use phone
- [ ] Check hamburger menu
- [ ] **Expected**: Home, Dashboard, Pricing, Settings, Sign Out
- [ ] **Expected**: "Pro Tier" badge with purple star
- [ ] **Expected**: NO "Upgrade to Pro" button
- [ ] Check dashboard tabs
- [ ] **Expected**: No ad banner on mobile

**Validation:**
- [ ] Mobile menu works for both tiers ✓
- [ ] Tier-specific elements render correctly ✓
- [ ] No layout breaking or overflow ✓

---

#### Test 9.2: Unread Alert Badge (Mobile)

**Both Tiers:**
- [ ] Open dashboard on mobile
- [ ] Start on "Market Data" tab
- [ ] Wait for new alert to arrive (check countdown)
- [ ] **Expected**: Red pulsing badge appears on "Volume Alerts" tab
- [ ] **Expected**: Badge shows count (e.g., "3")
- [ ] Switch to "Volume Alerts" tab
- [ ] **Expected**: Badge disappears
- [ ] Switch back to "Market Data" tab
- [ ] Wait for another alert
- [ ] **Expected**: Badge reappears with new count

**Validation:**
- [ ] Badge appears when new alerts arrive ✓
- [ ] Badge clears when viewing alerts ✓
- [ ] Count is accurate ✓

---

### Category 10: Pricing Page Display

#### Test 10.1: Tier Highlighting

**Free Tier:**
- [ ] Log in as free-test@volspike.com
- [ ] Go to /pricing page
- [ ] **Expected**: Free tier card shows your current tier
- [ ] **Expected**: Pro tier card highlighted with "Most Popular" badge
- [ ] **Expected**: Pro tier card has ring and scale effect

**Pro Tier:**
- [ ] Log in as pro-test@volspike.com
- [ ] Go to /pricing page
- [ ] **Expected**: Pro tier card shows "Current Plan" or similar indicator
- [ ] Check upgrade buttons
- [ ] **Expected**: Free tier shows "Downgrade" or "Current"
- [ ] **Expected**: Elite tier shows "Upgrade to Elite"

**Validation:**
- [ ] Current tier indicated on pricing page ✓
- [ ] Appropriate CTAs per tier ✓

---

### Category 11: Performance Testing

#### Test 11.1: Data Load Times

**Free Tier:**
- [ ] Clear browser cache
- [ ] Log in as free-test@volspike.com
- [ ] Go to dashboard
- [ ] Start timer
- [ ] Measure time until market data appears
- [ ] **Expected**: < 3 seconds for initial load
- [ ] **Expected**: 50 symbols load smoothly

**Pro Tier:**
- [ ] Clear browser cache
- [ ] Log in as pro-test@volspike.com
- [ ] Go to dashboard
- [ ] Start timer
- [ ] Measure time until market data appears
- [ ] **Expected**: < 4 seconds for initial load (100 symbols = 2x data)
- [ ] **Expected**: 100 symbols load smoothly, no lag

**Validation:**
- [ ] Both tiers load within acceptable time ✓
- [ ] No performance degradation with more data ✓

---

#### Test 11.2: WebSocket Reconnection

**Both Tiers:**
- [ ] Open dashboard
- [ ] Open browser DevTools > Network tab
- [ ] Find WebSocket connection (wss://fstream.binance.com/...)
- [ ] Right-click > Close connection (simulate network failure)
- [ ] Watch console messages
- [ ] **Expected**: "WebSocket closed" message
- [ ] **Expected**: "Reconnecting..." message
- [ ] **Expected**: Automatic reconnection within 5-10 seconds
- [ ] **Expected**: Data resumes flowing

**Validation:**
- [ ] Auto-reconnect works for both tiers ✓
- [ ] No data loss during reconnection ✓
- [ ] Exponential backoff prevents rapid reconnects ✓

---

### Category 12: Session and Authentication

#### Test 12.1: Session Persistence

**Both Tiers:**
- [ ] Log in
- [ ] Note your tier in console: `tier: 'free'` or `tier: 'pro'`
- [ ] Close browser tab
- [ ] Reopen volspike.com/dashboard
- [ ] **Expected**: Still logged in
- [ ] **Expected**: Tier preserved
- [ ] Check console: `tier: 'pro'` (not undefined)

**Validation:**
- [ ] Session persists across browser restarts ✓
- [ ] Tier value not undefined ✓
- [ ] No re-authentication required ✓

---

#### Test 12.2: Tier Change Detection

**Manual Test:**
- [ ] Log in as pro-test@volspike.com (Pro tier)
- [ ] Open Prisma Studio or database
- [ ] Change tier back to 'free'
- [ ] In browser, sign out
- [ ] Sign back in
- [ ] **Expected**: Now shows as Free tier
- [ ] **Expected**: Features revert to Free tier limits (50 symbols, 15-min updates, etc.)
- [ ] Change tier back to 'pro' in database
- [ ] Sign out and sign in again
- [ ] **Expected**: Pro features restored

**Validation:**
- [ ] Tier changes reflected after re-login ✓
- [ ] Features properly gated by tier ✓

---

### Category 13: Edge Cases and Error Handling

#### Test 13.1: Network Interruption

**Both Tiers:**
- [ ] Open dashboard with good internet
- [ ] Turn off WiFi / disconnect network
- [ ] **Expected**: "Reconnecting..." or connection status changes
- [ ] Turn network back on
- [ ] **Expected**: Auto-reconnects within 10 seconds
- [ ] **Expected**: Data resumes, no app crash

**Validation:**
- [ ] Graceful handling of network loss ✓
- [ ] Automatic recovery ✓

---

#### Test 13.2: Hard Refresh (Cmd+Shift+R)

**Both Tiers:**
- [ ] Go to /pricing
- [ ] Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- [ ] **Expected**: Page reloads without 500 error
- [ ] **Expected**: Only ONE footer appears
- [ ] **Expected**: Page renders correctly
- [ ] Repeat for /legal/privacy, /legal/terms, /support, /docs, /status

**Validation:**
- [ ] All pages survive hard refresh ✓
- [ ] No duplicate footers ✓
- [ ] No SSR errors ✓

---

### Category 14: Browser Console Health Check

#### Test 14.1: Console Errors (Should be minimal)

**Both Tiers:**
- [ ] Open dashboard
- [ ] Open browser console (F12)
- [ ] **Expected**: NO 404 errors for footer links
- [ ] **Expected**: NO critical JavaScript errors
- [ ] **Expected**: WebSocket connection messages present
- [ ] **Acceptable**: WebSocket reconnection warnings (normal behavior)
- [ ] **Expected**: User tier logs show `tier: 'free'` or `tier: 'pro'` (NOT undefined)

**Validation:**
- [ ] Console is clean (no 404s) ✓
- [ ] Tier is always defined ✓
- [ ] WebSocket connections stable ✓

---

## 📊 Test Results Checklist

### Free Tier Features (50 Total Checks)
- [ ] 15-minute updates (wall-clock aligned)
- [ ] 50 symbols max
- [ ] No Open Interest column
- [ ] 15-minute alert batches
- [ ] 10 alerts max history
- [ ] No manual refresh button
- [ ] TradingView export only (50 symbols)
- [ ] CSV/JSON export locked
- [ ] Ad banner visible
- [ ] Upgrade prompts visible
- [ ] Gray Zap tier badge
- [ ] Mobile layout correct

### Pro Tier Features (50 Total Checks)
- [ ] 5-minute updates (wall-clock aligned) - 3x faster
- [ ] 100 symbols max - 2x more
- [ ] Open Interest column visible
- [ ] 5-minute alert batches - 3x faster
- [ ] 50 alerts max history - 5x more
- [ ] Manual refresh button visible
- [ ] TradingView export (100 symbols)
- [ ] CSV export unlocked
- [ ] JSON export unlocked
- [ ] No ad banner
- [ ] No upgrade prompts
- [ ] Purple Star tier badge
- [ ] Mobile layout correct

---

## 🎯 Critical Success Criteria

**All tests must pass for Pro tier to be production-ready:**

1. ✅ **Tier Detection**: Console shows `tier: 'pro'` (not undefined)
2. ✅ **Update Frequency**: 5-minute wall-clock updates working
3. ✅ **Symbol Limit**: Exactly 100 symbols shown
4. ✅ **Alert Limit**: Up to 50 alerts visible
5. ✅ **Export**: CSV and JSON unlocked and working
6. ✅ **No Ads**: Banner hidden for Pro users
7. ✅ **UI Consistency**: Purple star badge everywhere
8. ✅ **Mobile**: All features work on mobile
9. ✅ **Performance**: No lag with 100 symbols
10. ✅ **Stability**: No crashes, WebSocket stable

---

## 🐛 Bug Reporting Template

If you find issues during testing, report them like this:

```
**Issue**: [Brief description]
**Tier**: Free / Pro
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]
**Actual**: [What actually happened]
**Console Errors**: [Any errors in F12 console]
**Screenshot**: [If applicable]
```

---

## ⏱️ Estimated Testing Time

- **Quick Smoke Test**: 15 minutes (test 1 feature per category)
- **Comprehensive Test**: 2-3 hours (all 100+ checks)
- **Recommended**: Start with Categories 1-4, then 7-8 (core features first)

---

## 📝 Notes

- Test both tiers side-by-side (two browser windows)
- Use incognito/private windows to avoid cache issues
- Clear browser cache between major tests
- Keep console open to catch any errors
- Take screenshots of any issues
- Test on both desktop and mobile

---

**After all tests pass, you'll have confidence that Free and Pro tiers work perfectly before implementing Stripe!** ✅

