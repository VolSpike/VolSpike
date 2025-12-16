# API Reference

## Overview

The VolSpike backend exposes REST APIs for authentication, payments, user data, and admin functionality. All endpoints are prefixed with `/api`.

**Base URLs:**
- Development: `http://localhost:3001`
- Production: `https://volspike-production.up.railway.app`

---

## Authentication Headers

Most endpoints require authentication:

```
Authorization: Bearer <jwt_token>
```

Some endpoints use API key authentication:

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

### POST /api/auth/signup

Create a new account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "message": "Account created. Please verify your email.",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "free"
  }
}
```

---

### POST /api/auth/signin

Sign in with email/password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "deviceId": "optional-device-id"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "pro",
    "role": "USER",
    "emailVerified": "2025-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here",
  "sessionId": "session_id"
}
```

---

### POST /api/auth/oauth-link

Create or link OAuth account.

**Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://...",
  "provider": "google",
  "providerId": "google_provider_id"
}
```

**Response:**
```json
{
  "user": { ... },
  "token": "jwt_token",
  "sessionId": "session_id"
}
```

---

### GET /api/auth/me

Get current user data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "tier": "pro",
    "role": "USER",
    "status": "ACTIVE",
    "emailVerified": "2025-01-01T00:00:00.000Z",
    "twoFactorEnabled": false
  }
}
```

---

### POST /api/auth/siwe/prepare

Prepare SIWE (Sign In With Ethereum) message.

**Body:**
```json
{
  "address": "0x...",
  "chainId": 1
}
```

**Response:**
```json
{
  "message": "volspike.com wants you to sign in...",
  "nonce": "random_nonce"
}
```

---

### POST /api/auth/siwe/verify

Verify SIWE signature.

**Body:**
```json
{
  "message": "...",
  "signature": "0x...",
  "address": "0x..."
}
```

**Response:**
```json
{
  "user": { ... },
  "token": "jwt_token"
}
```

---

### GET /api/auth/solana/nonce

Get nonce for Solana authentication.

**Response:**
```json
{
  "nonce": "random_nonce"
}
```

---

### POST /api/auth/solana/verify

Verify Solana wallet signature.

**Body:**
```json
{
  "publicKey": "...",
  "signature": "...",
  "message": "..."
}
```

**Response:**
```json
{
  "user": { ... },
  "token": "jwt_token"
}
```

---

### POST /api/auth/link-wallet

Link wallet to existing account.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "address": "0x...",
  "provider": "evm",
  "chainId": "1"
}
```

---

### POST /api/auth/unlink-wallet

Unlink wallet from account.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "address": "0x...",
  "provider": "evm"
}
```

---

### POST /api/auth/change-password

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

---

### POST /api/auth/forgot-password

Request password reset.

**Body:**
```json
{
  "email": "user@example.com"
}
```

---

### POST /api/auth/reset-password

Reset password with token.

**Body:**
```json
{
  "token": "reset_token",
  "password": "NewPassword123"
}
```

---

### DELETE /api/auth/delete-account

Delete user account.

**Headers:** `Authorization: Bearer <token>`

---

## Payment Endpoints

### POST /api/payments/checkout

Create Stripe checkout session.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "tier": "pro",
  "promoCode": "LAUNCH20"
}
```

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

### POST /api/payments/portal

Create Stripe customer portal session.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

### GET /api/payments/subscription

Get subscription status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "hasActiveSubscription": true,
  "tier": "pro",
  "source": "stripe",
  "expiresAt": "2025-01-15T00:00:00.000Z",
  "willRenew": true,
  "stripeStatus": "active"
}
```

---

### POST /api/payments/webhook

Stripe webhook handler.

**Headers:** `stripe-signature: t=...,v1=...`

**Note:** Must receive raw body, not JSON.

---

### POST /api/payments/nowpayments/checkout

Create NowPayments crypto invoice.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "tier": "pro",
  "currency": "usdtsol",
  "promoCode": "LAUNCH20"
}
```

**Response:**
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

**Headers:** `x-nowpayments-sig: <hmac_signature>`

---

### POST /api/payments/validate-promo

Validate promo code.

**Body:**
```json
{
  "code": "LAUNCH20",
  "tier": "pro"
}
```

**Response:**
```json
{
  "valid": true,
  "discountPercent": 20,
  "finalAmount": 15.20
}
```

---

## Watchlist Endpoints

### GET /api/watchlist

Get user's watchlists.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "watchlists": [
    {
      "id": "clx...",
      "name": "My Watchlist",
      "symbols": ["BTCUSDT", "ETHUSDT"],
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST /api/watchlist

Create watchlist.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "New Watchlist"
}
```

---

### PUT /api/watchlist/:id

Update watchlist.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Updated Name"
}
```

---

### DELETE /api/watchlist/:id

Delete watchlist.

**Headers:** `Authorization: Bearer <token>`

---

### POST /api/watchlist/:id/symbols

Add symbol to watchlist.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "symbol": "SOLUSDT"
}
```

---

### DELETE /api/watchlist/:id/symbols/:symbol

Remove symbol from watchlist.

**Headers:** `Authorization: Bearer <token>`

---

## Volume Alerts Endpoints

### GET /api/volume-alerts

Get recent volume alerts.

**Query Parameters:**
- `limit` (optional): Number of alerts (default: 50)
- `offset` (optional): Pagination offset

**Response:**
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
      "message": "BTC volume spike...",
      "timestamp": "2025-01-01T12:00:00.000Z",
      "candleDirection": "bullish"
    }
  ]
}
```

---

### POST /api/volume-alerts/ingest

Ingest volume alert (from Digital Ocean script).

**Headers:** `X-API-Key: <api_key>`

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
  "alertType": "SPIKE",
  "message": "BTC volume spike...",
  "candleDirection": "bullish"
}
```

---

## Open Interest Endpoints

### GET /api/market/open-interest

Get Open Interest data.

**Response:**
```json
{
  "data": {
    "BTCUSDT": 1500000000,
    "ETHUSDT": 800000000
  },
  "asOf": 1702836000000
}
```

---

### POST /api/market/open-interest

Update Open Interest data (from Digital Ocean script).

**Headers:** `X-API-Key: <api_key>`

**Body:**
```json
{
  "data": {
    "BTCUSDT": 1500000000,
    "ETHUSDT": 800000000
  }
}
```

---

## Asset Endpoints

### GET /api/assets

Get asset metadata manifest.

**Response:**
```json
{
  "assets": [
    {
      "symbol": "BTCUSDT",
      "name": "Bitcoin",
      "logoUrl": "https://...",
      "coingeckoId": "bitcoin"
    }
  ]
}
```

---

## Admin Endpoints

All admin endpoints require `role === 'ADMIN'`.

### Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List users |
| `/api/admin/users/:id` | GET | Get user |
| `/api/admin/users/:id` | PUT | Update user |
| `/api/admin/users/:id` | DELETE | Delete user |
| `/api/admin/users/:id/tier` | PUT | Change tier |

### Subscriptions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/subscriptions` | GET | List subscriptions |
| `/api/admin/subscriptions/:id/sync` | POST | Sync with Stripe |

### Payments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/payments` | GET | List payments |
| `/api/admin/payments/create` | POST | Create manual |

### Promo Codes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/promo-codes` | GET | List codes |
| `/api/admin/promo-codes` | POST | Create code |
| `/api/admin/promo-codes/:id` | PUT | Update code |
| `/api/admin/promo-codes/:id` | DELETE | Delete code |

### Audit

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/audit` | GET | Get audit logs |

### Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/metrics` | GET | System metrics |
| `/api/admin/metrics/revenue` | GET | Revenue data |

---

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input data |
| `RATE_LIMITED` | Too many requests |
| `SESSION_INVALID` | Session expired or invalidated |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `PAYMENT_FAILED` | Payment processing error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public | 100 req/15min |
| Authenticated | 200 req/15min |
| Admin | 50 req/5min |
| Webhooks | No limit |

---

## WebSocket (Socket.IO)

### Connection

```javascript
const socket = io('https://volspike-production.up.railway.app', {
  auth: { token: 'jwt_token' }
})
```

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `volume-alert` | Server → Client | New alert (Elite) |
| `volume-alerts-batch` | Server → Client | Batched alerts |
| `oi-alert` | Server → Client | OI alert |
| `tier-change` | Server → Client | Tier upgraded |
| `open-interest-update` | Server → Client | OI data updated |

### Rooms

- `tier-free` - Free tier users
- `tier-pro` - Pro tier users
- `tier-elite` - Elite tier users
- `user:{id}` - Individual user room
