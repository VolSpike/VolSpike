# API Reference

## Overview

The VolSpike backend exposes REST APIs for authentication, payments, user data, and admin functionality. All endpoints are prefixed with `/api`.

**Base URLs:**
- Development: `http://localhost:3001`
- Production: `https://volspike-production.up.railway.app`

**Total Endpoints:** 120+
- **Public Routes:** 15 files, 80+ endpoints
- **Admin Routes:** 10 files, 40+ endpoints

---

## Authentication Headers

Most endpoints require authentication:

```
Authorization: Bearer <jwt_token>
```

Some endpoints use API key authentication (Digital Ocean scripts):

```
X-API-Key: <api_key>
```

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "message": "Success message"
}
```

### Error Response

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## Health Check

### GET /health

Check server health.

**Authentication:** None (public)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-16T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## Authentication Endpoints

**File:** `routes/auth.ts` (2,340 lines)

### POST /api/auth/signup

Create a new account with email/password.

**Authentication:** None (public)

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "tier": "free"
}
```

**Response (200):**
```json
{
  "message": "Account created. Please verify your email.",
  "requiresVerification": true,
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "free"
  }
}
```

**Error Codes:**
- `400` - Validation error
- `409` - User already exists

**Side Effects:**
- Creates verification token (24h TTL)
- Sends verification email via SendGrid
- Password hashed with bcrypt

---

### POST /api/auth/signin

Sign in with email/password.

**Authentication:** None (public)

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "deviceId": "optional-device-identifier"
}
```

**Response (200):**
```json
{
  "token": "jwt_token_here",
  "sessionId": "session_id",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "pro",
    "role": "USER",
    "emailVerified": "2025-01-01T00:00:00.000Z",
    "refreshInterval": 15000,
    "theme": "dark",
    "status": "ACTIVE",
    "twoFactorEnabled": false
  }
}
```

**Error Codes:**
- `400` - Invalid request
- `401` - Invalid credentials
- `403` - Account suspended/banned/unverified

**Side Effects:**
- Updates `lastLoginAt` timestamp
- Creates new session
- Invalidates old sessions (single-session enforcement)
- WebSocket broadcasts `session:invalidated` to other devices

---

### POST /api/auth/oauth-link

Create or link OAuth account.

**Authentication:** None (public)

**Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://...",
  "provider": "google",
  "providerId": "google_provider_id",
  "deviceId": "optional-device-id"
}
```

**Response (200):**
```json
{
  "token": "jwt_token",
  "sessionId": "session_id",
  "user": { ... }
}
```

**Error Codes:**
- `400` - Invalid request
- `403` - Provider already linked to another account

---

### POST /api/auth/request-verification

Request new verification email.

**Authentication:** None (public)

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification email sent"
}
```

**Rate Limit:** 5 requests per hour per email

**Error Codes:**
- `429` - Rate limited

---

### POST /api/auth/verify-email

Verify email with token.

**Authentication:** None (public)

**Body:**
```json
{
  "token": "verification_token",
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

**Error Codes:**
- `400` - Invalid or expired token

**Side Effects:**
- Updates `emailVerified` timestamp
- Sends welcome email

---

### POST /api/auth/password/forgot

Request password reset.

**Authentication:** None (public)

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "isOAuthOnly": false
}
```

**Notes:**
- Returns success even if email not found (no user enumeration)
- Returns `isOAuthOnly: true` if account has no password (OAuth only)

---

### POST /api/auth/password/reset

Reset password with token.

**Authentication:** None (public)

**Body:**
```json
{
  "token": "reset_token",
  "email": "user@example.com",
  "newPassword": "NewSecurePassword456!"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Codes:**
- `400` - Invalid/expired token or same password as current

---

### POST /api/auth/password/change

Change password (authenticated).

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Codes:**
- `400` - Invalid current password or same as current
- `401` - Not authenticated

---

### GET /api/auth/siwe/nonce

Get nonce for SIWE (Sign In With Ethereum).

**Authentication:** None (public)

**Headers (optional):**
```
X-Wallet-Address: 0x...
```

**Response (200):**
```json
{
  "nonce": "random_nonce_string"
}
```

**Notes:**
- EIP-4361 compliant nonce generation
- Nonce valid for 5 minutes

---

### GET /api/auth/siwe/prepare

Prepare SIWE message for signing.

**Authentication:** None (public)

**Query Parameters:**
- `address` - Wallet address
- `chainId` - Chain ID (e.g., 1 for Ethereum mainnet)
- `nonce` - Previously obtained nonce

**Response (200):**
```json
{
  "message": "volspike.com wants you to sign in with your Ethereum account..."
}
```

**Error Codes:**
- `400` - Missing params or invalid nonce

---

### POST /api/auth/siwe/verify

Verify SIWE signature.

**Authentication:** None (public), or Bearer token (for account linking)

**Body:**
```json
{
  "message": "The SIWE message that was signed",
  "signature": "0x..."
}
```

**Response (200):**
```json
{
  "ok": true,
  "token": "jwt_token",
  "user": {
    "id": "clx...",
    "tier": "free",
    "role": "USER"
  }
}
```

**Error Codes:**
- `401` - Invalid or expired nonce, invalid signature
- `403` - Disallowed chain

**Side Effects:**
- Creates/updates wallet account
- Creates user if new
- Creates session
- Consumes nonce (one-time use)

---

### POST /api/auth/solana/nonce

Get nonce for Solana wallet authentication.

**Authentication:** None (public)

**Body:**
```json
{
  "address": "SolanaPublicKeyBase58..."
}
```

**Response (200):**
```json
{
  "nonce": "random_nonce"
}
```

---

### GET /api/auth/solana/prepare

Prepare Solana sign message.

**Authentication:** None (public)

**Query Parameters:**
- `address` - Solana public key
- `nonce` - Previously obtained nonce
- `chainId` - Optional (default: solana)

**Response (200):**
```json
{
  "message": "Sign this message to verify wallet ownership..."
}
```

---

### POST /api/auth/solana/verify

Verify Solana wallet signature.

**Authentication:** None (public)

**Body:**
```json
{
  "message": "The message that was signed",
  "signature": "base58_signature",
  "address": "SolanaPublicKey",
  "chainId": "solana"
}
```

**Response (200):**
```json
{
  "ok": true,
  "token": "jwt_token",
  "user": { ... }
}
```

**Error Codes:**
- `401` - Invalid signature or nonce

---

### POST /api/auth/wallet/link

Link wallet to existing account.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "message": "Sign message",
  "signature": "0x...",
  "address": "0x...",
  "chainId": "1",
  "provider": "evm"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Wallet linked successfully"
}
```

**Error Codes:**
- `400` - Invalid provider or duplicate wallet
- `401` - Invalid signature
- `403` - Wallet already linked to another user

---

### POST /api/auth/wallet/unlink

Unlink wallet from account.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "address": "0x...",
  "chainId": "1",
  "provider": "evm"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Wallet unlinked"
}
```

**Error Codes:**
- `400` - Cannot unlink only authentication method
- `403` - Wallet not owned by user
- `404` - Wallet not found

---

### GET /api/auth/wallet/list

Get linked wallets.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "wallets": [
    {
      "address": "0x...",
      "chainId": "1",
      "provider": "evm",
      "linkedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/auth/accounts/list

Get all linked accounts (email, OAuth, wallets).

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "email": "user@example.com",
  "oauth": [
    {
      "provider": "google",
      "email": "user@gmail.com",
      "linkedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "wallets": [
    {
      "address": "0x...",
      "provider": "evm",
      "chainId": "1"
    }
  ]
}
```

---

### POST /api/auth/email/link

Link email/password to existing account.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "email": "newemail@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email linked"
}
```

**Error Codes:**
- `400` - Email taken or already has password

---

### POST /api/auth/oauth/link

Link OAuth provider to existing account.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "email": "oauth@gmail.com",
  "name": "User Name",
  "image": "https://...",
  "provider": "google",
  "providerId": "google_provider_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OAuth linked"
}
```

**Error Codes:**
- `400` - Email policy violation (Google OAuth)
- `403` - Already linked

---

### POST /api/auth/oauth/unlink

Unlink OAuth provider.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "provider": "google"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OAuth unlinked"
}
```

**Error Codes:**
- `400` - Cannot unlink only authentication method

---

### POST /api/auth/password/unlink

Remove password from account.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "message": "Password unlinked"
}
```

**Error Codes:**
- `400` - Cannot unlink only authentication method

---

### GET /api/auth/me

Get current user data.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "pro",
    "emailVerified": "2025-01-01T00:00:00.000Z",
    "role": "USER",
    "status": "ACTIVE",
    "twoFactorEnabled": false,
    "refreshInterval": 15000,
    "theme": "dark",
    "passwordChangedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Error Codes:**
- `401` - Invalid/expired/legacy token
- `404` - User deleted

---

### GET /api/auth/ping

Session heartbeat endpoint.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "ok": true,
  "user": { ... },
  "lastActiveAt": "2025-01-01T12:00:00.000Z"
}
```

**Side Effects:**
- Updates `lastLoginAt` timestamp

---

### GET /api/auth/sessions

Get user's active sessions.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "session_id",
      "deviceName": "Chrome on Windows",
      "ipAddress": "1.2.3.4",
      "lastActivityAt": "2025-01-01T12:00:00.000Z",
      "isCurrent": true
    }
  ],
  "maxSessions": 1,
  "tier": "free"
}
```

---

### POST /api/auth/sessions/:sessionId/revoke

Revoke specific session.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "message": "Session revoked"
}
```

**Side Effects:**
- WebSocket broadcasts `session:invalidated`

---

### GET /api/auth/sessions/validate

Validate session token.

**Authentication:** Optional (Bearer token)

**Response (200):**
```json
{
  "valid": true,
  "reason": null,
  "legacy": false,
  "userId": "clx..."
}
```

---

### POST /api/auth/phantom/dl/start

Start Phantom deep-link flow (iOS mobile).

**Authentication:** None (public)

**Body:**
```json
{
  "appUrl": "https://volspike.com",
  "redirect": "/auth/phantom-callback"
}
```

**Response (200):**
```json
{
  "ok": true,
  "state": "ephemeral_state_id",
  "dappPublicKey58": "base58_public_key",
  "connectUrl": "https://phantom.app/ul/v1/connect?...",
  "connectDeepLink": "phantom://v1/connect?..."
}
```

---

### POST /api/auth/phantom/dl/sign-url

Build sign message URL for Phantom.

**Authentication:** None (public)

**Body:**
```json
{
  "state": "ephemeral_state_id",
  "message": "Sign this message...",
  "appUrl": "https://volspike.com",
  "redirect": "/auth/phantom-callback"
}
```

**Response (200):**
```json
{
  "url": "phantom://v1/signMessage?..."
}
```

---

### POST /api/auth/phantom/dl/decrypt

Decrypt Phantom response payload.

**Authentication:** None (public)

**Body:**
```json
{
  "state": "ephemeral_state_id",
  "phantom_encryption_public_key": "...",
  "payload": "encrypted_payload",
  "nonce": "nonce_value"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": { ... }
}
```

---

## Payment Endpoints

**File:** `routes/payments.ts` (900+ lines)

### POST /api/payments/checkout

Create Stripe checkout session.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "priceId": "price_xxx",
  "successUrl": "https://volspike.com/checkout/success",
  "cancelUrl": "https://volspike.com/checkout/cancel",
  "mode": "subscription",
  "promoCode": "LAUNCH20"
}
```

**Response (200):**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

**External API:** Stripe

---

### POST /api/payments/validate-promo-code

Validate promo code.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "code": "LAUNCH20",
  "tier": "pro",
  "paymentMethod": "STRIPE"
}
```

**Response (200 - valid):**
```json
{
  "valid": true,
  "discountPercent": 20,
  "originalPrice": 19,
  "finalPrice": 15.20,
  "promoCodeId": "clx..."
}
```

**Response (200 - invalid):**
```json
{
  "valid": false,
  "error": "Promo code has expired",
  "reason": "expired"
}
```

---

### GET /api/payments/subscription

Get subscription status.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "stripe": {
    "hasSubscription": true,
    "status": "active",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  },
  "crypto": {
    "hasSubscription": false,
    "expiresAt": null
  },
  "subscription": {
    "active": true,
    "tier": "pro",
    "source": "stripe"
  }
}
```

---

### POST /api/payments/portal

Create Stripe customer portal session.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Error Codes:**
- `404` - No Stripe customer found

---

### GET /api/payments/invoices

Get payment invoices.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "invoices": [
    {
      "id": "in_...",
      "amount": 1900,
      "currency": "usd",
      "status": "paid",
      "created": 1702836000,
      "invoicePdf": "https://..."
    }
  ]
}
```

---

### POST /api/payments/webhook

Stripe webhook handler.

**Authentication:** Stripe signature (`stripe-signature` header)

**Events Handled:**
- `checkout.session.completed` - Update user tier
- `customer.subscription.created` - Handle new subscription
- `customer.subscription.updated` - Handle subscription changes
- `customer.subscription.deleted` - Handle cancellation
- `invoice.payment_succeeded` - Confirm payment
- `invoice.payment_failed` - Handle failed payment

**Response (200):**
```json
{
  "received": true
}
```

**Side Effects:**
- Updates user tier in database
- Sends tier upgrade email
- WebSocket broadcasts `tier-changed`

---

### POST /api/payments/nowpayments/checkout

Create NowPayments crypto invoice.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "tier": "pro",
  "currency": "usdtsol",
  "promoCode": "LAUNCH20"
}
```

**Response (200):**
```json
{
  "invoiceUrl": "https://nowpayments.io/payment/...",
  "invoiceId": "...",
  "orderId": "...",
  "paymentId": "..."
}
```

---

### POST /api/payments/nowpayments/webhook

NowPayments IPN webhook handler.

**Authentication:** HMAC-SHA512 signature (`x-nowpayments-sig` header)

**Response (200):**
```json
{
  "received": true
}
```

**Side Effects:**
- Updates crypto payment status
- Upgrades user tier when `finished` or `confirmed`
- Sends confirmation emails

---

## Suggestions Endpoints

**File:** `routes/suggestions.ts`

### POST /api/suggestions

Submit user feedback/suggestion.

**Authentication:** None (public)

**Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "type": "feature",
  "title": "Add dark mode",
  "description": "It would be great to have a dark mode option for the dashboard."
}
```

**Fields:**
- `name` (string, optional, max 100 chars) - User's name
- `email` (string, required) - Valid email address
- `type` (enum, optional) - One of: `feature`, `improvement`, `bug`, `other`
- `title` (string, optional, max 200 chars) - Brief summary
- `description` (string, required, min 10, max 5000 chars) - Detailed feedback

**Response (200):**
```json
{
  "success": true,
  "message": "Suggestion submitted successfully"
}
```

**Error (400 - Validation):**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 10,
      "path": ["description"],
      "message": "Description must be at least 10 characters"
    }
  ]
}
```

**Error (500):**
```json
{
  "error": "Failed to submit suggestion"
}
```

**Side Effects:**
- Sends notification email to support@volspike.com
- Sends confirmation email to user
- Emails sent asynchronously (non-blocking)
- Logs suggestion details for tracking

**Performance:**
- Response time: ~50-100ms (emails sent in background)
- No database storage (email-only workflow)

---

## Watchlist Endpoints

**File:** `routes/watchlist.ts`

### GET /api/watchlist

Get user's watchlists.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "watchlists": [
    {
      "id": "clx...",
      "name": "My Watchlist",
      "symbols": ["BTCUSDT", "ETHUSDT"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "items": [
        {
          "id": "item_id",
          "symbol": "BTCUSDT",
          "contract": { "symbol": "BTCUSDT", "asset": "BTC" }
        }
      ]
    }
  ],
  "limits": {
    "watchlists": { "current": 1, "max": 1 },
    "symbols": { "current": 2, "max": 10 }
  }
}
```

---

### GET /api/watchlist/limits

Get watchlist limits for current tier.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "max": 1,
  "current": 1,
  "remaining": 0,
  "tier": "free"
}
```

---

### POST /api/watchlist

Create watchlist.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "name": "New Watchlist"
}
```

**Response (200):**
```json
{
  "watchlist": { ... },
  "limits": { ... }
}
```

**Error Codes:**
- `400` - Validation error
- `403` - Watchlist limit reached
- `409` - Duplicate watchlist name

---

### GET /api/watchlist/:id

Get single watchlist.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "watchlist": {
    "id": "clx...",
    "name": "My Watchlist",
    "items": [ ... ]
  }
}
```

---

### POST /api/watchlist/:id/symbols

Add symbol to watchlist.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "symbol": "SOLUSDT"
}
```

**Response (200):**
```json
{
  "watchlistItem": { ... },
  "limits": { ... }
}
```

**Error Codes:**
- `400` - Invalid symbol format
- `403` - Symbol limit reached
- `404` - Watchlist not found
- `409` - Symbol already in watchlist

---

### DELETE /api/watchlist/:id/symbols/:symbol

Remove symbol from watchlist.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "limits": { ... }
}
```

---

### PATCH /api/watchlist/:id

Update watchlist name.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "name": "Renamed Watchlist"
}
```

**Response (200):**
```json
{
  "watchlist": { ... }
}
```

---

### DELETE /api/watchlist/:id

Delete watchlist.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "limits": { ... }
}
```

---

## Volume Alerts Endpoints

**File:** `routes/volume-alerts.ts`

### POST /api/volume-alerts/ingest

Ingest volume alert (from Digital Ocean script).

**Authentication:** X-API-Key

**Body:**
```json
{
  "symbol": "BTCUSDT",
  "asset": "BTC",
  "currentVolume": 1500000000,
  "previousVolume": 400000000,
  "volumeRatio": 3.75,
  "price": 43250.50,
  "fundingRate": 0.0001,
  "candleDirection": "bullish",
  "message": "BTC volume spike detected",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "detectionTime": "2025-01-01T12:00:00.000Z",
  "hourTimestamp": "2025-01-01T12:00:00.000Z",
  "isUpdate": false,
  "alertType": "SPIKE",
  "priceChange": 2.5,
  "oiChange": 5.2
}
```

**Response (200):**
```json
{
  "success": true,
  "alertId": "clx..."
}
```

**Side Effects:**
- Creates VolumeAlert in database
- WebSocket broadcasts via `broadcastVolumeAlert`

---

### GET /api/volume-alerts

Get recent volume alerts.

**Authentication:** None (public, tier-based filtering)

**Query Parameters:**
- `tier` - User tier (determines throttling)
- `symbol` - Filter by symbol

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "clx...",
      "symbol": "BTCUSDT",
      "asset": "BTC",
      "currentVolume": 1500000000,
      "previousVolume": 400000000,
      "volumeRatio": 3.75,
      "price": 43250.50,
      "fundingRate": 0.0001,
      "alertType": "SPIKE",
      "candleDirection": "bullish",
      "timestamp": "2025-01-01T12:00:00.000Z"
    }
  ],
  "tier": "free",
  "limit": 10,
  "lastBroadcastTime": "2025-01-01T12:00:00.000Z"
}
```

**Tier-Based Throttling:**
- Elite: Real-time
- Pro: 5-minute intervals
- Free: 15-minute intervals

---

### GET /api/volume-alerts/recent

Get recent alerts (24h).

**Authentication:** None (public)

**Query Parameters:**
- `hours` - Hours to look back (default: 24)
- `limit` - Max alerts (max: 100)

**Response (200):**
```json
{
  "alerts": [ ... ],
  "hours": 24,
  "count": 15
}
```

---

### GET /api/volume-alerts/subscriptions

Get user's alert subscriptions.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "subscriptions": [
    {
      "id": "clx...",
      "symbol": "BTCUSDT",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST /api/volume-alerts/subscriptions

Subscribe to symbol alerts.

**Authentication:** Required (Bearer token)

**Tier Restriction:** Pro/Elite only

**Body:**
```json
{
  "symbol": "BTCUSDT"
}
```

**Response (200):**
```json
{
  "subscription": { ... }
}
```

**Error Codes:**
- `403` - Free tier not allowed

---

### DELETE /api/volume-alerts/subscriptions/:symbol

Unsubscribe from symbol alerts.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true
}
```

---

## Open Interest Endpoints

**File:** `routes/open-interest.ts`

### POST /api/market/open-interest/ingest

Ingest OI batch from Digital Ocean script.

**Authentication:** X-API-Key

**Body:**
```json
{
  "data": [
    {
      "symbol": "BTCUSDT",
      "openInterest": 150000,
      "openInterestUsd": 6500000000,
      "markPrice": 43250.50
    }
  ],
  "timestamp": "2025-01-01T12:00:00.000Z",
  "totalSymbols": 341,
  "source": "realtime"
}
```

**Response (200):**
```json
{
  "success": true,
  "inserted": 341,
  "cached": true,
  "errors": []
}
```

**Side Effects:**
- Creates OpenInterestSnapshot records
- Updates in-memory OI cache
- WebSocket broadcasts if realtime source

---

### POST /api/market/open-interest/liquid-universe/update

Update liquid universe classification.

**Authentication:** X-API-Key

**Body:**
```json
{
  "symbols": [
    {
      "symbol": "BTCUSDT",
      "quoteVolume24h": 5000000000,
      "enteredAt": "2025-01-01T00:00:00.000Z",
      "lastSeenAt": "2025-01-01T12:00:00.000Z"
    }
  ],
  "updatedAt": "2025-01-01T12:00:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "upserted": 200,
  "removed": 5,
  "totalSymbols": 200
}
```

---

### GET /api/market/open-interest/liquid-universe

Get liquid universe symbols.

**Authentication:** None (public)

**Response (200):**
```json
{
  "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT", ...]
}
```

---

### GET /api/market/open-interest/snapshot

Get OI snapshot at specific time.

**Authentication:** X-API-Key

**Query Parameters:**
- `symbol` - Symbol to query
- `ts` - ISO 8601 timestamp

**Response (200):**
```json
{
  "found": true,
  "symbol": "BTCUSDT",
  "openInterest": 150000,
  "openInterestUsd": 6500000000,
  "markPrice": 43250.50,
  "ts": "2025-01-01T12:00:00.000Z",
  "source": "realtime"
}
```

---

### GET /api/market/open-interest

Get current OI data (cached).

**Authentication:** None (public)

**Response (200):**
```json
{
  "data": {
    "BTCUSDT": 6500000000,
    "ETHUSDT": 3200000000
  },
  "stale": false,
  "asOf": 1702836000000,
  "dangerouslyStale": false
}
```

**Caching:**
- Stale threshold: 5 minutes
- Dangerously stale: 90 seconds grace period

---

### POST /api/open-interest-alerts/ingest

Ingest OI alert from Digital Ocean script.

**Authentication:** X-API-Key

**Body:**
```json
{
  "symbol": "BTCUSDT",
  "direction": "UP",
  "baseline": 6000000000,
  "current": 6500000000,
  "changePercent": 8.33,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "source": "realtime",
  "timeframe": "5min",
  "priceChange": 1.5,
  "fundingRate": 0.0001
}
```

**Response (200):**
```json
{
  "success": true,
  "id": "clx..."
}
```

**Side Effects:**
- Creates OpenInterestAlert record
- WebSocket broadcasts via `broadcastOpenInterestAlert`

---

### GET /api/open-interest-alerts

Get OI alerts.

**Authentication:** Required (Bearer token)

**Tier Restriction:** Pro/Elite/Admin only

**Query Parameters:**
- `symbol` - Filter by symbol
- `direction` - Filter by UP/DOWN
- `limit` - Max results
- `offset` - Pagination offset

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "clx...",
      "symbol": "BTCUSDT",
      "direction": "UP",
      "baseline": 6000000000,
      "current": 6500000000,
      "pctChange": 8.33,
      "timestamp": "2025-01-01T12:00:00.000Z"
    }
  ],
  "count": 50,
  "limit": 50,
  "offset": 0
}
```

**Error Codes:**
- `401` - Unauthenticated
- `403` - Free tier not allowed

---

## User Cross Alerts Endpoints

**File:** `routes/user-cross-alerts.ts`

### GET /api/user-cross-alerts

Get user's custom alerts.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `active` - Filter active only
- `symbol` - Filter by symbol

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "clx...",
      "symbol": "BTCUSDT",
      "alertType": "PRICE_CROSS",
      "threshold": 50000,
      "deliveryMethod": "app",
      "isActive": true,
      "triggeredAt": null
    }
  ]
}
```

---

### POST /api/user-cross-alerts

Create custom alert.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "symbol": "BTCUSDT",
  "alertType": "PRICE_CROSS",
  "threshold": 50000,
  "deliveryMethod": "app"
}
```

**Response (201):**
```json
{
  "alert": { ... }
}
```

**Tier Limits:**
- Free: 3 alerts
- Pro: 10 alerts
- Elite: Unlimited

**Error Codes:**
- `400` - Validation error
- `403` - Alert limit reached
- `409` - Duplicate alert

---

### PUT /api/user-cross-alerts/:id

Update custom alert.

**Authentication:** Required (Bearer token)

**Body:**
```json
{
  "threshold": 55000,
  "deliveryMethod": "email",
  "isActive": true
}
```

**Response (200):**
```json
{
  "alert": { ... }
}
```

**Error Codes:**
- `403` - Email delivery requires Pro/Elite
- `404` - Alert not found

---

### DELETE /api/user-cross-alerts/:id

Delete custom alert.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true
}
```

---

### POST /api/user-cross-alerts/:id/reactivate

Reactivate triggered alert.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "alert": { ... }
}
```

**Error Codes:**
- `403` - Alert limit reached
- `404` - Alert not found

---

## User Cross Alerts Trigger Endpoints

**File:** `routes/user-cross-alerts-trigger.ts`

### POST /api/user-cross-alerts/trigger

Trigger user alert (from Digital Ocean script).

**Authentication:** X-API-Key

**Body:**
```json
{
  "alertId": "clx...",
  "symbol": "BTCUSDT",
  "currentValue": 50100,
  "previousValue": 49900,
  "crossedUp": true,
  "apiKey": "api_key"
}
```

**Response (200):**
```json
{
  "success": true,
  "alert": { ... }
}
```

**Side Effects:**
- Updates alert as triggered
- WebSocket broadcasts via `broadcastUserAlert`
- Sends email if configured

---

### GET /api/user-cross-alerts/active

Get all active alerts for checking.

**Authentication:** X-API-Key

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "clx...",
      "userId": "user_id",
      "symbol": "BTCUSDT",
      "alertType": "PRICE_CROSS",
      "threshold": 50000,
      "lastCheckedValue": 49500,
      "deliveryMethod": "email"
    }
  ]
}
```

---

### POST /api/user-cross-alerts/update-checked

Update last checked value.

**Authentication:** X-API-Key

**Body:**
```json
{
  "alertId": "clx...",
  "lastCheckedValue": 49750,
  "apiKey": "api_key"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Market Endpoints

**File:** `routes/market.ts`

### GET /api/market/data

Get market data.

**Authentication:** Optional (tier-based filtering in production)

**Response (200):**
```json
{
  "data": [
    {
      "symbol": "BTCUSDT",
      "price": 43250.50,
      "volume24h": 5000000000,
      "priceChange24h": 2.5,
      "fundingRate": 0.0001
    }
  ],
  "stale": false,
  "lastUpdate": 1702836000000,
  "tier": "free",
  "ingestionStatus": "ok"
}
```

**Tier-Based Filtering:**
- Free: Top 50 symbols
- Pro: Top 100 symbols
- Elite: All symbols

---

### GET /api/market/symbol/:symbol

Get single symbol data.

**Authentication:** Optional

**Response (200):**
```json
{
  "symbol": "BTCUSDT",
  "price": 43250.50,
  "volume24h": 5000000000,
  "priceChange24h": 2.5,
  "fundingRate": 0.0001,
  "openInterest": 150000
}
```

---

### GET /api/market/history/:symbol

Get historical data.

**Authentication:** Optional

**Query Parameters:**
- `timeframe` - Candle interval (1m, 5m, 1h, etc.)
- `limit` - Number of candles

**Tier Limits:**
- Free: 50 candles
- Pro: 200 candles
- Elite: Unlimited

**Response (200):**
```json
{
  "history": [
    {
      "timestamp": 1702836000000,
      "open": 43200,
      "high": 43300,
      "low": 43100,
      "close": 43250,
      "volume": 1000000
    }
  ]
}
```

---

### GET /api/market/health

System health check.

**Authentication:** None (public)

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "redis": "connected",
  "ingestion": "active",
  "market": "live"
}
```

---

### GET /api/market/watchlist/:id

Get market data for watchlist symbols.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "watchlistId": "clx...",
  "watchlistName": "My Watchlist",
  "symbols": [
    {
      "symbol": "BTCUSDT",
      "price": 43250.50,
      "volume24h": 5000000000
    }
  ],
  "fetchedAt": "2025-01-01T12:00:00.000Z"
}
```

---

## Asset Endpoints

**File:** `routes/assets.ts`

### GET /api/assets/manifest

Get asset metadata manifest.

**Authentication:** None (public)

**Response (200):**
```json
{
  "assets": [
    {
      "symbol": "BTCUSDT",
      "name": "Bitcoin",
      "logoUrl": "https://...",
      "coingeckoId": "bitcoin",
      "description": "Bitcoin is..."
    }
  ],
  "staleAfterMs": 86400000
}
```

---

### POST /api/assets/detect-new

Detect and create new assets.

**Authentication:** None (public)

**Body:**
```json
{
  "symbols": ["NEWCOINUSDT", "OTHERCOINUSDT"]
}
```

**Response (200):**
```json
{
  "success": true,
  "created": 2,
  "newSymbols": ["NEWCOINUSDT", "OTHERCOINUSDT"],
  "message": "Assets detected and queued for enrichment"
}
```

---

## Renewal Endpoints

**File:** `routes/renewal.ts`

### POST /api/renewal/check-reminders

Check and send renewal reminders.

**Authentication:** X-API-Key (optional)

**Response (200):**
```json
{
  "success": true,
  "checked": 50,
  "remindersSent": 3,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

---

### POST /api/renewal/check-expired

Check and downgrade expired subscriptions.

**Authentication:** X-API-Key (optional)

**Response (200):**
```json
{
  "success": true,
  "checked": 50,
  "downgraded": 2,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

---

## Telegram Endpoints

**File:** `routes/telegram.ts`

### POST /api/telegram/ingest

Ingest Telegram messages (from Digital Ocean script).

**Authentication:** X-API-Key

**Body:**
```json
{
  "channel": {
    "id": "123456789",
    "username": "marketfeed",
    "title": "Market Feed",
    "category": "crypto"
  },
  "messages": [
    {
      "id": "1234",
      "text": "BTC breaking out...",
      "date": "2025-01-01T12:00:00.000Z",
      "sender_name": "MarketBot",
      "views": 1000,
      "forwards": 50,
      "has_media": false,
      "media_type": null,
      "links": []
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "inserted": 10,
  "duplicates": 2,
  "errors": []
}
```

---

### GET /api/telegram/health

Telegram service health.

**Authentication:** None (public)

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

---

### GET /api/telegram/messages

Get recent Telegram messages.

**Authentication:** None (public)

**Query Parameters:**
- `limit` - Max messages (max: 100)

**Response (200):**
```json
{
  "messages": [ ... ],
  "count": 50
}
```

---

## Admin Endpoints

All admin endpoints require:
- **Authentication:** Bearer token with `role === 'ADMIN'`
- **Middleware:** Admin authentication (`adminMiddleware`)
- **Audit Logging:** All actions are logged

### Admin Users

**File:** `routes/admin/users.ts`

#### GET /api/admin/users

Get paginated user list.

**Query Parameters:**
- `search` - Search email/wallet
- `role` - Filter by role (USER, ADMIN)
- `tier` - Filter by tier (free, pro, elite)
- `status` - Filter by status (ACTIVE, SUSPENDED, BANNED)
- `page` - Page number
- `limit` - Items per page
- `sortBy` - Sort field (createdAt, email, lastLoginAt)
- `sortOrder` - Sort direction (asc, desc)

**Response (200):**
```json
{
  "users": [
    {
      "id": "clx...",
      "email": "user@example.com",
      "tier": "pro",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": "2025-01-01T12:00:00.000Z",
      "hasStripeSubscription": true,
      "hasCryptoSubscription": false,
      "subscriptionExpiresAt": "2025-02-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

#### POST /api/admin/users

Create new user (admin action).

**Body:**
```json
{
  "email": "newuser@example.com",
  "tier": "pro",
  "role": "USER",
  "sendInvite": true,
  "temporaryPassword": null
}
```

**Response (200):**
```json
{
  "user": { ... },
  "temporaryPassword": "TempPass123!"
}
```

**Side Effects:**
- Creates user with hashed password
- Sends invite email if `sendInvite: true`
- Creates audit log

---

### Admin Subscriptions

**File:** `routes/admin/subscriptions.ts`

#### GET /api/admin/subscriptions

Get subscriptions list.

**Query Parameters:**
- `status` - Subscription status
- `tier` - Filter by tier
- `page`, `limit`, `sortBy`, `sortOrder`

**Response (200):**
```json
{
  "subscriptions": [ ... ],
  "pagination": { ... }
}
```

---

#### POST /api/admin/subscriptions/:userId/sync

Sync user subscription with Stripe.

**Body:**
```json
{
  "forceSync": true
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "clx...",
  "userEmail": "user@example.com",
  "changes": ["tier: free -> pro"],
  "errors": [],
  "warnings": [],
  "subscription": { ... }
}
```

**Side Effects:**
- Updates user tier
- Deletes watchlists if downgrading to free
- Sends tier upgrade email
- WebSocket broadcasts `tier-changed`

---

### Admin Payments

**File:** `routes/admin/payments.ts`

#### GET /api/admin/payments

Get payments list.

**Query Parameters:**
- `userId` - Filter by user
- `email` - Filter by email
- `paymentStatus` - Filter by status
- `tier` - Filter by tier
- `paymentId`, `invoiceId`, `orderId` - Filter by ID
- `page`, `limit`, `sortBy`, `sortOrder`

**Response (200):**
```json
{
  "payments": [
    {
      "id": "clx...",
      "userId": "user_id",
      "tier": "pro",
      "paymentStatus": "finished",
      "actuallyPaid": 19.00,
      "payCurrency": "usdtsol",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

---

#### POST /api/admin/payments/complete-partial-payment

Complete partial crypto payment.

**Body:**
```json
{
  "paymentId": "clx...",
  "reason": "Customer paid difference via other method"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment completed",
  "payment": { ... },
  "user": { ... }
}
```

**Side Effects:**
- Updates payment to `finished`
- Upgrades user tier
- Sends tier upgrade email
- Creates audit log

---

#### POST /api/admin/payments/manual-upgrade

Manually upgrade user tier.

**Body:**
```json
{
  "userId": "clx...",
  "tier": "pro",
  "reason": "Compensation for service issue",
  "expiresAt": "2025-02-01T00:00:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User upgraded",
  "user": { ... },
  "subscription": { ... }
}
```

---

### Admin Promo Codes

**File:** `routes/admin/promo-codes.ts`

#### POST /api/admin/promo-codes

Create promo code.

**Body:**
```json
{
  "code": "NEWCODE20",
  "discountPercent": 20,
  "maxUses": 100,
  "validUntil": "2025-12-31T23:59:59.000Z",
  "paymentMethod": "ALL",
  "active": true
}
```

**Response (201):**
```json
{
  "promoCode": { ... }
}
```

---

#### GET /api/admin/promo-codes

Get promo codes list.

**Query Parameters:**
- `status` - Filter by active status
- `sortBy`, `sortOrder`, `page`, `limit`

**Response (200):**
```json
{
  "promoCodes": [ ... ],
  "pagination": { ... }
}
```

---

#### PATCH /api/admin/promo-codes/:id

Update promo code.

**Body:**
```json
{
  "discountPercent": 25,
  "maxUses": 200,
  "validUntil": "2026-01-31T23:59:59.000Z",
  "active": true
}
```

**Validation:**
- `maxUses >= currentUses`
- `validUntil > now`

---

#### DELETE /api/admin/promo-codes/:id

Delete promo code.

**Response (200):**
```json
{
  "type": "success",
  "message": "Promo code deleted"
}
```

---

### Admin Audit

**File:** `routes/admin/audit.ts`

#### GET /api/admin/audit

Get audit logs.

**Query Parameters:**
- `actorUserId` - Filter by actor
- `action` - Filter by action type
- `targetType` - Filter by target type
- `targetId` - Filter by target ID
- `startDate`, `endDate` - Date range
- `page`, `limit`, `sortBy`, `sortOrder`

**Response (200):**
```json
{
  "logs": [
    {
      "id": "clx...",
      "actorUserId": "admin_id",
      "action": "USER_CREATED",
      "targetType": "USER",
      "targetId": "user_id",
      "oldValues": null,
      "newValues": { "tier": "pro" },
      "metadata": { "ip": "1.2.3.4" },
      "createdAt": "2025-01-01T12:00:00.000Z",
      "actor": {
        "email": "admin@example.com",
        "role": "ADMIN"
      }
    }
  ],
  "pagination": { ... },
  "filters": { ... }
}
```

---

#### GET /api/admin/audit/stats

Get audit statistics.

**Query Parameters:**
- `days` - Period in days (default: 30)

**Response (200):**
```json
{
  "totalLogs": 500,
  "recentActivity": [
    {
      "date": "2025-01-01",
      "count": 25
    }
  ],
  "period": "30d"
}
```

---

#### GET /api/admin/audit/export

Export audit logs.

**Query Parameters:**
- `format` - Export format (json, csv)
- Plus all filter params from GET /api/admin/audit

**Response:**
- File download (JSON or CSV)
- Limit: 1000 logs per export

---

### Admin Metrics

**File:** `routes/admin/metrics.ts`

#### GET /api/admin/metrics

Get system metrics.

**Query Parameters:**
- `period` - Time period (7d, 30d, 90d, 1y)

**Response (200):**
```json
{
  "totalUsers": 1000,
  "activeUsers": 500,
  "usersByTier": {
    "free": 700,
    "pro": 200,
    "elite": 100
  },
  "totalRevenue": 15000,
  "recentSignups": 50,
  "failedLogins": 10,
  "adminSessions": 5
}
```

---

#### GET /api/admin/metrics/users

Get user metrics.

**Response (200):**
```json
{
  "totalUsers": 1000,
  "usersByTier": {
    "free": 700,
    "pro": 200,
    "elite": 100
  },
  "usersByStatus": {
    "ACTIVE": 950,
    "SUSPENDED": 30,
    "BANNED": 20
  }
}
```

---

#### GET /api/admin/metrics/user-growth

Get user growth metrics.

**Query Parameters:**
- `period` - Time period

**Response (200):**
```json
{
  "period": "30d",
  "range": {
    "start": "2024-12-01",
    "end": "2025-01-01"
  },
  "daily": [
    {
      "date": "2024-12-01",
      "total": 10,
      "free": 7,
      "pro": 2,
      "elite": 1
    }
  ],
  "summary": {
    "totalNew": 300,
    "growthRate": 15.5
  }
}
```

---

### Admin Settings

**File:** `routes/admin/settings.ts`

#### GET /api/admin/settings

Get admin settings.

**Response (200):**
```json
{
  "settings": {
    "adminEmailWhitelist": [],
    "adminIPWhitelist": [],
    "adminSessionDuration": 86400,
    "auditLogRetentionDays": 90
  },
  "user": { ... }
}
```

---

#### PATCH /api/admin/settings

Update admin settings.

**Body:**
```json
{
  "adminEmailWhitelist": ["admin@example.com"],
  "adminIPWhitelist": ["1.2.3.4"],
  "adminSessionDuration": 43200,
  "auditLogRetentionDays": 180
}
```

---

#### GET /api/admin/settings/security

Get security settings.

**Response (200):**
```json
{
  "twoFactorEnabled": false,
  "lastPasswordChange": "2025-01-01T00:00:00.000Z",
  "activeSessions": 2,
  "ipWhitelist": [],
  "failedLoginAttempts": 0
}
```

---

#### POST /api/admin/settings/2fa/setup

Setup 2FA.

**Response (200):**
```json
{
  "secret": "BASE32SECRET",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["CODE1", "CODE2", ...],
  "message": "Scan QR code with authenticator app"
}
```

---

#### DELETE /api/admin/settings/2fa

Disable 2FA.

**Response (200):**
```json
{
  "success": true,
  "message": "2FA disabled"
}
```

---

#### GET /api/admin/settings/sessions

Get admin's active sessions.

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "session_id",
      "deviceName": "Chrome on Mac",
      "ipAddress": "1.2.3.4",
      "lastActivityAt": "2025-01-01T12:00:00.000Z",
      "isCurrent": true
    }
  ]
}
```

---

#### DELETE /api/admin/settings/sessions/:sessionId

Revoke admin session.

**Response (200):**
```json
{
  "success": true,
  "message": "Session revoked"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `RATE_LIMITED` | 429 | Too many requests |
| `SESSION_INVALID` | 401 | Session expired or invalidated |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `PAYMENT_FAILED` | 400 | Payment processing error |
| `TIER_LIMIT_REACHED` | 403 | Tier limit exceeded |

---

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public | 100 requests | 15 min |
| Authenticated | 200 requests | 15 min |
| Admin | 50 requests | 5 min |
| Webhooks | No limit | - |
| Verification emails | 5 requests | 1 hour |

---

## WebSocket (Socket.IO)

### Connection

```javascript
const socket = io('https://volspike-production.up.railway.app', {
  auth: { token: 'jwt_token' }
})
```

### Events

| Event | Direction | Description | Rooms |
|-------|-----------|-------------|-------|
| `volume-alert` | Server → Client | Volume spike alert | tier-free, tier-pro, tier-elite |
| `volume-alerts-batch` | Server → Client | Batched alerts | tier-free, tier-pro |
| `open-interest-alert` | Server → Client | OI spike/dump | tier-pro, tier-elite, role-admin |
| `open-interest-update` | Server → Client | OI data update | All |
| `tier-changed` | Server → Client | Tier upgraded | user:{id} |
| `session:invalidated` | Server → Client | Session ended | user:{id} |
| `user-deleted` | Server → Client | Account deleted | user:{id} |

### Rooms

| Room | Description |
|------|-------------|
| `tier-free` | Free tier users |
| `tier-pro` | Pro tier users |
| `tier-elite` | Elite tier users |
| `role-admin` | Admin users |
| `user:{id}` | Individual user room |

---

## Next: [Services](14-SERVICES.md)
