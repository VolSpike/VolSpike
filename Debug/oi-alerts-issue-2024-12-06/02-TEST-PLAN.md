# OI Alerts Issue - Comprehensive Test Plan

**Date**: December 6, 2024

---

## Test Scenarios

### Scenario 1: Admin User - Desktop
**Account**: nsitnikov1@gmail.com (ADMIN role, Pro tier)
**Device**: Desktop Chrome

**Expected Behavior**:
- ✅ Should fetch OI alerts successfully
- ✅ Should display historical OI alerts
- ✅ Should receive new OI alerts via WebSocket
- ✅ WebSocket should stay connected (no reconnection loops)
- ✅ Should see: "Connected to OI alerts WebSocket (admin)"
- ✅ Should get 100 alerts (admin limit)
- ✅ Sound should play on new alerts

**Current Behavior**:
- ❌ "Authentication required" error
- ❌ Failed to fetch OI alerts
- ❌ WebSocket reconnection loop
- ✅ Connects briefly, then disconnects immediately

**Test Steps**:
1. Open `/alerts` page
2. Click "Open Interest" tab
3. Observe console logs
4. Check Network tab for API calls
5. Wait for new OI alert to arrive
6. Check if sound plays

---

### Scenario 2: Admin User - Mobile
**Account**: nsitnikov1@gmail.com (ADMIN role, Pro tier)
**Device**: Mobile Safari

**Expected Behavior**:
- ✅ Same as Scenario 1

**Current Behavior**:
- ✅ Works fine!
- ✅ OI alerts display
- ✅ WebSocket stable

**Test Steps**:
1. Same as Scenario 1
2. Compare console logs with desktop

---

### Scenario 3: Pro User - Desktop
**Account**: colin.paran@gmail.com (USER role, Pro tier)
**Device**: Desktop Chrome

**Expected Behavior**:
- ✅ Should fetch OI alerts successfully
- ✅ Should display historical OI alerts
- ✅ Should receive new OI alerts via WebSocket
- ✅ WebSocket should stay connected
- ✅ Should see: "Connected to OI alerts WebSocket (pro tier)"
- ✅ Should get 50 alerts (pro limit)

**Current Behavior**:
- ✅ Everything works!

**Test Steps**:
1. Same as Scenario 1

---

### Scenario 4: Test Account - Multi-Device
**Account**: pro-test@volspike.com (USER role, Pro tier)
**Devices**: Desktop 1 (User) + Desktop 2 (Friend)

**Expected Behavior**:
- ✅ Device 1 logs in successfully
- ✅ OI alerts work on Device 1
- ✅ Device 2 logs in
- ✅ Device 1 should be FORCE LOGGED OUT (single-session enforcement)
- ✅ OI alerts work on Device 2

**Current Behavior**:
- ✅ Device 1 logs in successfully
- ⚠️ OI alerts work on Device 1 (but WebSocket bouncing)
- ✅ Device 2 logs in
- ❌ Device 1 does NOT get logged out (SESSION BUG!)
- ❌ OI alerts don't work on Device 2

**Test Steps**:
1. Device 1: Log in with pro-test@volspike.com
2. Device 1: Open OI alerts tab
3. Device 1: Verify alerts display
4. Device 2: Log in with same account
5. Device 1: Should see force logout message and be redirected
6. Device 2: Open OI alerts tab
7. Device 2: Verify alerts display

---

### Scenario 5: Regular Account - Multi-Device
**Account**: colin.paran@gmail.com (USER role, Pro tier)
**Devices**: Desktop 1 + Desktop 2

**Expected Behavior**:
- ✅ Single-session enforcement works
- ✅ Device 2 login forces Device 1 logout

**Current Behavior**:
- ✅ Works correctly!

**Test Steps**:
1. Same as Scenario 4

---

### Scenario 6: Free User - OI Alerts Access
**Account**: free-test@volspike.com (USER role, Free tier)
**Device**: Desktop Chrome

**Expected Behavior**:
- ✅ Should see "Pro or Elite subscription required" message
- ✅ Should NOT fetch OI alerts
- ✅ Should NOT connect to OI WebSocket

**Current Behavior**:
- ⏳ NEEDS TESTING

**Test Steps**:
1. Log in as free user
2. Try to access OI alerts
3. Verify appropriate error message

---

### Scenario 7: Volume Alerts (Control Test)
**Account**: All accounts
**Device**: All devices

**Expected Behavior**:
- ✅ Should work for all users
- ✅ Should fetch alerts without authentication
- ✅ WebSocket should be stable
- ✅ Should show correct tier in console

**Current Behavior**:
- ✅ Works perfectly for all users!

**Test Steps**:
1. Open Volume Alerts tab
2. Verify alerts display
3. Check WebSocket connection
4. Verify console logs show correct tier

---

## API Endpoint Tests

### Test 1: GET /api/open-interest-alerts (Current - With Auth)
**Request**:
```bash
curl -X GET 'http://localhost:3001/api/open-interest-alerts?limit=50' \
  -H 'Authorization: Bearer USER_JWT_TOKEN'
```

**Expected**: 200 OK with alerts
**Current**: 401 Unauthorized for admin users

### Test 2: GET /api/open-interest-alerts (Proposed - Without Auth)
**Request**:
```bash
curl -X GET 'http://localhost:3001/api/open-interest-alerts?tier=pro&limit=50'
```

**Expected**: 200 OK with alerts
**Current**: ⏳ NEEDS TESTING

### Test 3: GET /api/volume-alerts (Control - Working)
**Request**:
```bash
curl -X GET 'http://localhost:3001/api/volume-alerts?tier=pro&limit=50'
```

**Expected**: 200 OK with alerts
**Current**: ✅ Works!

---

## WebSocket Connection Tests

### Test 1: Volume Alerts WebSocket (Control)
**Connection**:
```javascript
io('http://localhost:3001', {
  auth: { token: 'user@example.com' },
  transports: ['websocket', 'polling']
})
```

**Expected**: Connects, joins tier-based room, receives alerts
**Current**: ✅ Works!

### Test 2: OI Alerts WebSocket (Broken)
**Connection**:
```javascript
io('http://localhost:3001', {
  auth: { token: 'admin@example.com' },
  transports: ['websocket', 'polling']
})
```

**Expected**: Connects, joins role-admin room, receives alerts
**Current**: ❌ Reconnection loop for admin users

---

## Session Enforcement Tests

### Test 1: Regular Account (Control)
**Account**: colin.paran@gmail.com
1. Device 1: Log in
2. Device 2: Log in with same account
3. Device 1: Should be force logged out
4. Result: ✅ Works!

### Test 2: Test Account (Broken)
**Account**: pro-test@volspike.com
1. Device 1: Log in
2. Device 2: Log in with same account
3. Device 1: Should be force logged out
4. Result: ❌ BROKEN - both stay logged in!

---

## Root Cause Investigation Tests

### Test 1: Check Session Table
```sql
SELECT * FROM "Session" WHERE "userId" = (
  SELECT id FROM "User" WHERE email = 'pro-test@volspike.com'
);
```
**Expected**: Only 1 active session
**Check**: Are there multiple active sessions?

### Test 2: Check Admin Role Detection
```sql
SELECT id, email, role, tier FROM "User" WHERE email = 'nsitnikov1@gmail.com';
```
**Expected**: role = 'ADMIN', tier = 'pro'
**Check**: Is role correctly set?

### Test 3: Check WebSocket Auth Logic
**File**: `volspike-nodejs-backend/src/websocket/handlers.ts`
**Lines**: 138-150
**Check**: Does admin room join logic work correctly?

### Test 4: Check Auth Middleware Behavior
**File**: `volspike-nodejs-backend/src/middleware/auth.ts`
**Check**: Does it treat admin users differently?

---

## Acceptance Criteria

All tests must pass before declaring issue resolved:

- [ ] Admin user can fetch OI alerts on desktop
- [ ] Admin user WebSocket connection is stable (no loops)
- [ ] Pro user continues to work
- [ ] Test account session enforcement works
- [ ] All users show correct tier/role in WebSocket logs
- [ ] Volume alerts continue to work (regression test)
- [ ] Free users cannot access OI alerts
- [ ] Sound plays on new alerts
- [ ] Mobile continues to work

---

## Test Execution Log

| Test | Status | Notes |
|------|--------|-------|
| Scenario 1 | ❌ FAIL | Admin user authentication failed |
| Scenario 2 | ✅ PASS | Mobile works |
| Scenario 3 | ✅ PASS | Pro user works |
| Scenario 4 | ❌ FAIL | Session enforcement broken |
| Scenario 5 | ✅ PASS | Regular session enforcement works |
| Scenario 6 | ⏳ PENDING | Needs testing |
| Scenario 7 | ✅ PASS | Volume alerts work (control) |
| API Test 1 | ❌ FAIL | 401 for admin |
| API Test 2 | ⏳ PENDING | Not implemented yet |
| API Test 3 | ✅ PASS | Volume alerts API works |
| WS Test 1 | ✅ PASS | Volume alerts WS works |
| WS Test 2 | ❌ FAIL | OI alerts WS reconnection loop |
| Session Test 1 | ✅ PASS | Regular account works |
| Session Test 2 | ❌ FAIL | Test account broken |

---

## DO NOT PROCEED WITH FIXES UNTIL ALL ROOT CAUSES ARE IDENTIFIED
