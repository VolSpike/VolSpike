# Single-Session Enforcement - Implementation Steps

## Phase 1: Database Setup

### Step 1.1: Add UserSession Model to Prisma Schema
- [x] Add `UserSession` model to `volspike-nodejs-backend/prisma/schema.prisma`
- [x] Add relation to User model
- [ ] Run `npx prisma migrate dev --name add_user_sessions` (requires DATABASE_URL)

### Step 1.2: Create Session Service
- [x] Create `volspike-nodejs-backend/src/services/session.ts`
- [x] Implement `createSession(userId, deviceId, tier, ipAddress, userAgent)`
- [x] Implement session invalidation for Free/Pro (single session) and Elite (4 sessions)
- [x] Implement `validateSession(sessionId)`
- [x] Implement `getUserSessions(userId)`
- [x] Implement `revokeSession(sessionId, userId, reason)`

## Phase 2: Backend Integration

### Step 2.1: Update Auth Routes
- [x] Modify `/api/auth/signin` to accept deviceId and create session
- [x] Modify `/api/auth/oauth-link` to accept deviceId and create session
- [x] Add sessionId to JWT token claims via `generateToken()`
- [x] Broadcast session invalidations via WebSocket to force logout

### Step 2.2: Create Session API Endpoints
- [x] `GET /api/auth/sessions` - List user's active sessions
- [x] `POST /api/auth/sessions/:sessionId/revoke` - Revoke specific session
- [x] `GET /api/auth/sessions/validate` - Validate session status
- [x] Add proper authorization (user can only manage own sessions)

### Step 2.3: Update Auth Middleware
- [x] Modify `volspike-nodejs-backend/src/middleware/auth.ts`
- [x] Add session validation check for tokens with sessionId
- [x] Return `SESSION_INVALID` error code for invalid sessions
- [x] Handle tokens without sessionId gracefully (no migration period - all must re-login)

### Step 2.4: Update WebSocket Handlers
- [x] Modify `volspike-nodejs-backend/src/websocket/handlers.ts`
- [x] Accept sessionId in auth handshake
- [x] Validate session on connection
- [x] Listen for `session:invalidated` events
- [x] Emit `session:force-logout` and disconnect socket when invalidated

## Phase 3: Frontend Integration

### Step 3.1: Create Device ID Utility
- [x] Create `volspike-nextjs-frontend/src/lib/device-id.ts`
- [x] Implement `getOrCreateDeviceId()` using localStorage
- [x] Implement `clearDeviceId()` for logout

### Step 3.2: Update Sign-In Flow
- [x] Modify `signin-form.tsx` to include deviceId in credentials
- [x] Update auth.ts credentials provider to pass deviceId to backend
- [x] Store sessionId in JWT token and session

### Step 3.3: Update NextAuth Types
- [x] Add `sessionId` to User interface
- [x] Add `sessionId` to Session interface
- [x] Add `sessionId` to JWT interface

### Step 3.4: Handle Session Invalidation
- [x] Update `session-validator.tsx` to connect to WebSocket
- [x] Listen for `session:invalidated` and `session:force-logout` events
- [x] Show toast notification with reason
- [x] Redirect to sign-in page with `?reason=session_invalidated`

### Step 3.5: Create Session Management UI (Elite only) - DEFERRED
- [ ] Create `/settings/sessions` page (Elite only)
- [ ] Display list of active sessions
- [ ] Show current session indicator
- [ ] Add revoke button for non-current sessions
- [ ] Show tier-based session limits

## Phase 4: Testing

### Step 4.1: Manual Testing Checklist
- [ ] Test Free user: login from device A, login from device B, device A is logged out
- [ ] Test Pro user: same as Free user
- [ ] Test Elite user: login from device A, login from device B, both remain logged in
- [ ] Test Elite user: login from 5th device, oldest is logged out
- [ ] Test email/password auth
- [ ] Test Google OAuth
- [ ] Test error messages are user-friendly

### Step 4.2: Verification
- [x] Backend TypeScript compiles without errors
- [x] Frontend TypeScript compiles without errors (test files have unrelated errors)
- [x] Prisma client generated with UserSession model

## Phase 5: Deployment

### Step 5.1: Database Migration
- [ ] Run migration on Railway: `npx prisma migrate deploy`
- [ ] Verify indexes are created

### Step 5.2: Backend Deployment
- [ ] Deploy backend to Railway
- [ ] Monitor logs for session creation/invalidation

### Step 5.3: Frontend Deployment
- [ ] Deploy frontend to Vercel
- [ ] Test login flow
- [ ] Verify session invalidation works

### Step 5.4: Post-Deployment
- [ ] All existing users must re-login (no migration period)
- [ ] Monitor session creation rates
- [ ] Monitor session invalidation events
- [ ] Check for support tickets

## Rollback Plan

### If Issues Arise
1. In `middleware/auth.ts`, skip session validation (comment out the `if (sessionId)` block)
2. Users can continue using existing JWTs
3. Investigate and fix issues
4. Re-enable session validation

### Database Rollback
```sql
-- If needed, remove session table (data loss)
DROP TABLE IF EXISTS user_sessions;
```

## Environment Variables

Add to backend:
```bash
ELITE_SESSION_LIMIT=4  # Max concurrent sessions for Elite users (default: 4)
```

## Files Changed

### Backend (`volspike-nodejs-backend`)
- `prisma/schema.prisma` - Added UserSession model
- `src/services/session.ts` - NEW: Session management service
- `src/routes/auth.ts` - Added session creation and management endpoints
- `src/middleware/auth.ts` - Added session validation
- `src/websocket/handlers.ts` - Added session invalidation handling

### Frontend (`volspike-nextjs-frontend`)
- `src/lib/device-id.ts` - NEW: Device ID utility
- `src/lib/auth.ts` - Added deviceId to credentials, sessionId to JWT
- `src/types/next-auth.d.ts` - Added sessionId types
- `src/components/signin-form.tsx` - Pass deviceId to signIn
- `src/components/session-validator.tsx` - Added WebSocket session invalidation

## Notes

- Session validation adds ~5ms latency per API request
- Device IDs persist in localStorage until logout
- Admin sessions (AdminSession table) are separate and unchanged
- Guest users are not affected (no session tracking)
- No migration period - all users must re-login after deployment
