# Single-Session Enforcement - Requirements

## Purpose

Prevent credential sharing among multiple users by limiting concurrent sessions based on subscription tier. This protects subscription revenue by ensuring paying users can't share their Pro account credentials with friends.

## Problem Statement

Currently, a user can sign in from unlimited devices simultaneously. This allows:
- One person to pay for Pro tier and share login credentials with multiple friends
- Lost revenue from credential sharing
- No visibility into suspicious login patterns
- No ability to force logout compromised accounts

## Scope

### In Scope
- Limit Free and Pro tier users to 1 concurrent session
- Allow Elite tier users multiple concurrent sessions (configurable limit)
- Track active sessions in database
- Automatic invalidation of old sessions on new login (for Free/Pro)
- Session validation on every authenticated API request
- WebSocket disconnection when session is invalidated
- User-facing session management UI (view active sessions)

### Out of Scope
- Device trust/remember this device (future feature)
- Geolocation-based session tracking
- SMS/email alerts for new login from unknown device
- Session timeout due to inactivity (separate from expiration)

## User Stories

### As a Free Tier User
- I want to log in from one device at a time
- When I log in from a new device, I expect my old session to be automatically logged out
- I understand this is a limitation of the free tier

### As a Pro Tier User
- I want to use my account from one device at a time to comply with terms of service
- When I log in from a new device, I expect my old session to be invalidated
- I want to see which device is currently logged in

### As an Elite Tier User
- I want to use my account from multiple devices (phone + laptop + tablet)
- I want to see a list of my active sessions
- I want to be able to revoke specific sessions remotely

### As the Platform Owner
- I want to prevent credential sharing among Pro users
- I want to track active sessions for security purposes
- I want to reduce revenue loss from account sharing

## Acceptance Criteria

### Session Creation
- [ ] When a user logs in, a session record is created in the database
- [ ] Session includes: userId, deviceId, IP address, user agent, created timestamp
- [ ] Session has a 30-day expiration (matching JWT expiration)

### Single-Session Enforcement (Free/Pro)
- [ ] When a Free user logs in, all other active sessions for that user are invalidated
- [ ] When a Pro user logs in, all other active sessions for that user are invalidated
- [ ] The newly logged-in session becomes the only active session
- [ ] Old sessions are marked as inactive (not deleted) for audit purposes

### Multi-Session Allowance (Elite)
- [ ] Elite users can have multiple active sessions simultaneously
- [ ] Initial limit: 5 concurrent sessions (configurable)
- [ ] When limit is reached, oldest session is invalidated

### Session Validation
- [ ] Every authenticated API request validates the session is still active
- [ ] Invalid/inactive sessions return 401 Unauthorized
- [ ] Session validation adds minimal latency (<10ms)

### WebSocket Handling
- [ ] When a session is invalidated, the WebSocket connection is terminated
- [ ] User receives a specific error message indicating session was logged out elsewhere
- [ ] Frontend handles this gracefully by redirecting to sign-in

### User Experience
- [ ] Users see a message when their session was invalidated due to another login
- [ ] Elite users can view list of active sessions in settings
- [ ] Elite users can revoke specific sessions

### Edge Cases
- [ ] Existing JWT tokens without sessionId are handled gracefully (migration period)
- [ ] Session validation works for both email and Web3 auth methods
- [ ] Guest users are not affected (no session tracking)

## Constraints

### Technical
- Must work with existing NextAuth.js v5 JWT strategy
- Session validation must be performant (database indexed queries)
- Must handle WebSocket authentication (Socket.IO)
- Device ID must persist across browser sessions (localStorage)

### Business
- Elite tier gets premium multi-device experience
- No degradation of login experience for Elite users
- Clear messaging to Free/Pro users about single-session policy

### Security
- Device ID is client-generated (UUID), not a security token
- Session ID in JWT is the actual session identifier
- Sessions can be revoked server-side at any time
