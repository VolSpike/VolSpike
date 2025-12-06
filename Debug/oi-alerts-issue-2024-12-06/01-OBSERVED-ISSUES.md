# OI Alerts Critical Issues - Observed Symptoms

**Date**: December 6, 2024
**Severity**: CRITICAL - Production Issue
**Affected Users**: Admin users, inconsistent behavior across accounts

---

## Issue Summary

Open Interest (OI) alerts are experiencing multiple critical failures:
1. Authentication failures for admin users
2. WebSocket reconnection loops
3. Session enforcement not working correctly
4. Inconsistent behavior between Pro and Admin users

---

## Observed Issues

### 1. Admin User Authentication Failure

**User**: nsitnikov1@gmail.com (ADMIN role, Pro tier)
**Device**: Desktop
**Symptoms**:
- ❌ "Authentication required" error message displayed
- ❌ Failed to fetch OI alerts
- ❌ Constant WebSocket connect/disconnect loop
- ✅ Volume alerts work perfectly fine
- ✅ Same account works fine on mobile

**Console Logs**:
```
Failed to fetch OI alerts: Error: Failed to fetch OI alerts:
Authentication required
WebSocket connection to '<URL>' failed: WebSocket is closed before the connection is established
✅ Connected to OI alerts WebSocket (admin)
❌ Disconnected from OI alerts WebSocket
✅ Connected to OI alerts WebSocket (admin)
❌ Disconnected from OI alerts WebSocket
[... repeating]
```

**Browser Console**:
```
✅ Connected to volume alerts WebSocket (pro tier)  // Works fine
✅ Connected to OI alerts WebSocket (admin)          // Connects
❌ Disconnected from OI alerts WebSocket             // Immediately disconnects
```

### 2. Pro User Works Fine

**User**: colin.paran@gmail.com (USER role, Pro tier)
**Device**: Desktop
**Symptoms**:
- ✅ OI alerts fetch successfully
- ✅ OI alerts display correctly
- ✅ WebSocket connection stable
- ✅ No authentication errors

**Observation**: Pro users work, Admin users don't. This suggests role-specific bug.

### 3. Test Account Behavior

**User**: pro-test@volspike.com (USER role, Pro tier)
**Device 1** (User's computer):
- ✅ OI alerts work fine
- ⚠️ WebSocket shows "(admin)" but should show "(pro tier)"
- ⚠️ Still experiencing WebSocket reconnection bouncing

**Device 2** (Friend's computer, same account):
- ❌ OI alerts not working
- ❌ Authentication issues

**Critical Observation**: Single-session enforcement is NOT working! Both devices stayed logged in simultaneously, which violates the "only 1 device allowed" requirement.

### 4. Session Enforcement Broken

**Test with colin.paran@gmail.com**:
- ✅ Logging in from Device 2 **correctly** logs out Device 1
- ✅ Single-session enforcement works

**Test with pro-test@volspike.com**:
- ❌ Logging in from Device 2 does **NOT** log out Device 1
- ❌ Both devices stay logged in simultaneously
- ❌ Session enforcement completely broken for this account

### 5. WebSocket Label Inconsistency

**Volume Alerts**:
- Shows: "Connected to volume alerts WebSocket (pro tier)" ✅

**OI Alerts**:
- Admin user shows: "Connected to OI alerts WebSocket (admin)" ⚠️
- Pro user should show: "Connected to OI alerts WebSocket (pro tier)" ⚠️

This suggests the WebSocket connection is using different authentication logic or is detecting admin role incorrectly.

---

## Timeline of Issues

1. **Earlier today (morning)**: Everything worked fine for all users
2. **This afternoon**: Issues started appearing
3. **Current state**:
   - Admin users completely broken
   - Pro users work but have session enforcement issues
   - WebSocket reconnection loops for admin

---

## Comparison: What Works vs What Doesn't

### Volume Alerts (WORKING ✅)
- Fetches without authentication
- Uses tier query parameter: `?tier=pro`
- WebSocket connects stably
- Shows correct tier in console logs
- No reconnection loops

### OI Alerts (BROKEN ❌)
- Requires authentication (or did before our changes)
- Fails for admin users
- WebSocket reconnection loops
- Session enforcement broken for some accounts
- Inconsistent behavior between Pro and Admin

---

## Code Changes Made (That May Have Broken Things)

### Change 1: Removed Bearer Token Auth
**File**: `volspike-nextjs-frontend/src/hooks/use-oi-alerts.ts`
**What**: Removed `Authorization: Bearer ${accessToken}` header
**Why**: Thought it was using non-existent accessToken field
**Result**: Now getting "Authentication required" errors

### Change 2: Fixed useEffect Dependencies
**File**: `volspike-nextjs-frontend/src/hooks/use-oi-alerts.ts`
**What**: Changed dependencies from `[session, canAccessOI, onNewAlert, maxAlerts]` to `[session, canAccessOI, onNewAlert, userTier, isAdmin]`
**Why**: To prevent reconnection loops from unstable `maxAlerts` value
**Result**: May have introduced new bugs

### Change 3: Removed Auth Middleware (Just Now)
**File**: `volspike-nodejs-backend/src/index.ts`
**What**: Removed `authMiddleware` from OI alerts route
**Why**: Trying to make it public like volume alerts
**Result**: NOT TESTED YET - may have broken things further

---

## Questions to Answer

1. **Why does it work for Pro users but not Admin users?**
   - Is there admin-specific authentication logic?
   - Is the backend treating admin users differently?

2. **Why is session enforcement broken for pro-test@volspike.com?**
   - Is this related to the email domain (@volspike.com)?
   - Is there a bug in session validation for test accounts?
   - Are WebSocket connections bypassing session checks?

3. **Why does mobile work but desktop doesn't for the same user?**
   - Different browser/cookie behavior?
   - Different session IDs?
   - Different WebSocket connection logic?

4. **Why was it working this morning but broke this afternoon?**
   - What changed?
   - Was there a deployment?
   - Did something timeout or expire?

5. **Why is OI WebSocket showing "(admin)" for all users?**
   - Is the backend detecting admin role incorrectly?
   - Is there a bug in the WebSocket authentication?

---

## Next Steps

1. ✅ Create this documentation
2. ⏳ Create comprehensive test plan
3. ⏳ Review all authentication code paths
4. ⏳ Identify root causes
5. ⏳ Implement fixes with tests
6. ⏳ Verify fixes work for all scenarios

---

## DO NOT PROCEED WITH FIXES UNTIL:
- [ ] All code paths are reviewed
- [ ] Root causes are identified
- [ ] Test plan is complete
- [ ] Fixes are designed and reviewed
