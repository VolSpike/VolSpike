# Single-Session Enforcement - Design

## Architecture Overview

### Current State
```
User Login → NextAuth creates JWT → JWT stored in HTTP-only cookie → No session tracking
```

### Target State
```
User Login → Create UserSession record → Add sessionId to JWT → Validate session on requests
                    ↓
           For Free/Pro: Invalidate other sessions
           For Elite: Allow up to N sessions
```

## Data Models

### New Prisma Model: UserSession

```prisma
model UserSession {
  id              String    @id @default(cuid())
  userId          String
  deviceId        String    // Client-generated UUID, stored in localStorage
  deviceName      String?   // Optional: "Chrome on Windows", "Safari on iPhone"
  ipAddress       String?
  userAgent       String?
  tier            String    // Snapshot of user's tier at session creation
  isActive        Boolean   @default(true)
  invalidatedAt   DateTime? // When session was invalidated
  invalidatedBy   String?   // "new_login" | "user_revoked" | "admin_revoked" | "tier_change"
  lastActivityAt  DateTime  @default(now())
  expiresAt       DateTime
  createdAt       DateTime  @default(now())

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceId])
  @@index([userId, isActive])
  @@index([expiresAt])
  @@map("user_sessions")
}
```

### JWT Payload Changes

Current JWT payload:
```typescript
{
  sub: string           // user ID
  email: string
  tier: 'free' | 'pro' | 'elite'
  role: 'USER' | 'ADMIN'
  status: string
  iat: number           // issued at
  exp: number           // expires
}
```

New JWT payload (add `sessionId`):
```typescript
{
  sub: string
  email: string
  tier: 'free' | 'pro' | 'elite'
  role: 'USER' | 'ADMIN'
  status: string
  sessionId: string     // NEW: Reference to UserSession.id
  iat: number
  exp: number
}
```

## API Contracts

### Modified Endpoints

#### POST /api/auth/signin (Credential Provider)
Request body (updated):
```json
{
  "email": "user@example.com",
  "password": "password123",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response (unchanged structure, session created server-side):
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "tier": "pro"
  }
}
```

### New Endpoints

#### GET /api/auth/sessions
Returns active sessions for the current user.

Response:
```json
{
  "sessions": [
    {
      "id": "session_abc",
      "deviceName": "Chrome on Windows",
      "ipAddress": "192.168.1.1",
      "lastActivityAt": "2025-12-04T10:30:00Z",
      "createdAt": "2025-12-01T08:00:00Z",
      "isCurrent": true
    },
    {
      "id": "session_def",
      "deviceName": "Safari on iPhone",
      "ipAddress": "10.0.0.5",
      "lastActivityAt": "2025-12-03T22:00:00Z",
      "createdAt": "2025-12-02T12:00:00Z",
      "isCurrent": false
    }
  ],
  "maxSessions": 5,
  "tier": "elite"
}
```

#### POST /api/auth/sessions/:sessionId/revoke
Revokes a specific session.

Response:
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

### Internal Endpoint (Backend)

#### POST /api/internal/session/create
Called during NextAuth sign-in callback.

Request:
```json
{
  "userId": "user_123",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "tier": "pro"
}
```

Response:
```json
{
  "sessionId": "session_abc",
  "invalidatedSessions": ["session_xyz"]
}
```

## Component Hierarchy

### Frontend Components

```
settings/
└── sessions/
    └── page.tsx              # Session management page (Elite only)
        ├── SessionList       # List of active sessions
        │   └── SessionCard   # Individual session display
        │       ├── DeviceIcon
        │       ├── SessionDetails
        │       └── RevokeButton
        └── SessionLimitInfo  # Shows session limit based on tier
```

### Hooks

```typescript
// hooks/use-sessions.ts
export function useSessions() {
  // Fetch and manage user sessions
  // Returns: sessions, isLoading, revokeSession, refetch
}

// hooks/use-device-id.ts
export function useDeviceId() {
  // Get or create persistent device ID
  // Returns: deviceId
}
```

## Security Considerations

### Session ID Security
- Session IDs are cryptographically random (CUID)
- Session IDs are stored in JWT, which is HTTP-only and secure
- Session validation happens server-side on every request

### Device ID Security
- Device IDs are client-generated UUIDs
- NOT used for authentication (session ID is authoritative)
- Used only for device identification and session management UI
- Cleared on logout, regenerated on next login

### Session Revocation
- Sessions can be revoked by:
  - New login (automatic for Free/Pro)
  - User action (Elite users managing sessions)
  - Admin action (security concerns)
  - Tier downgrade (Elite → Pro/Free)
- Revoked sessions are marked inactive, not deleted (audit trail)

### WebSocket Security
- WebSocket connections check session validity on heartbeat
- Invalid sessions cause immediate disconnect
- Disconnect message includes reason for user notification

## Performance Considerations

### Database Queries
- Session validation: Single indexed query by sessionId
- Expected latency: <5ms with proper indexing
- Query: `SELECT isActive FROM user_sessions WHERE id = ? AND isActive = true`

### Caching Strategy
- No caching of session validity (must be real-time)
- Device ID cached in localStorage (client-side only)

### Indexing
```sql
-- Primary lookup (session validation)
CREATE INDEX idx_user_sessions_id_active ON user_sessions(id, is_active);

-- User session listing
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- Cleanup job (expired sessions)
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

## Technology Choices

### Why Database Sessions (vs Redis)
- Audit trail requirement (session history)
- No Redis in current architecture
- PostgreSQL performance is sufficient for session lookups
- Simpler infrastructure

### Why CUID for Session IDs
- Collision-resistant
- Sortable by creation time
- URL-safe
- Consistent with existing ID strategy

### Why Client-Generated Device IDs
- No server round-trip needed at app initialization
- Works offline
- UUIDs are sufficiently collision-resistant
- Persists across browser sessions via localStorage

## Migration Strategy

### Backward Compatibility
1. JWT tokens without `sessionId` claim are allowed during migration period
2. Such tokens bypass session validation but are logged for monitoring
3. After migration period (30 days), tokens without sessionId are rejected

### Database Migration
```sql
-- Migration: Add user_sessions table
CREATE TABLE user_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  tier VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  invalidated_at TIMESTAMP,
  invalidated_by VARCHAR(50),
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_user_sessions_id_active ON user_sessions(id, is_active);
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

## Error Handling

### Session Invalidation Errors

| Error Code | Condition | User Message |
|------------|-----------|--------------|
| SESSION_EXPIRED | Session past expiresAt | "Your session has expired. Please sign in again." |
| SESSION_REVOKED_NEW_LOGIN | Invalidated by new login | "You've been signed out because your account was accessed from another device." |
| SESSION_REVOKED_USER | User revoked session | "This session has been ended." |
| SESSION_REVOKED_ADMIN | Admin revoked session | "Your session was ended by an administrator." |
| SESSION_LIMIT_REACHED | Elite user at max sessions | "You've reached the maximum number of active sessions. The oldest session has been logged out." |

### Frontend Error Handling
```typescript
// On receiving 401 with session error
if (error.code === 'SESSION_REVOKED_NEW_LOGIN') {
  toast.error('You\'ve been signed out because your account was accessed from another device.')
  signOut({ redirect: true, callbackUrl: '/auth/sign-in?reason=other_device' })
}
```

## Configuration

### Tier Session Limits
```typescript
const SESSION_LIMITS = {
  free: 1,
  pro: 1,
  elite: 4  // Configurable via environment variable
}

// Environment variable override
const ELITE_SESSION_LIMIT = parseInt(process.env.ELITE_SESSION_LIMIT || '4')
```

### Environment Variables
```bash
# Backend
ELITE_SESSION_LIMIT=4           # Max concurrent sessions for Elite users
SESSION_MIGRATION_PERIOD=30     # Days to allow tokens without sessionId
```
