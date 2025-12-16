# Backend Services

## Overview

Services in VolSpike contain business logic separated from route handlers. Located in `volspike-nodejs-backend/src/services/`.

---

## Email Service

**File:** `services/email.ts`

Handles all transactional emails via SendGrid. Implemented as a singleton class.

### Class: EmailService

```typescript
export class EmailService {
    private fromEmail: string      // Default: 'noreply@volspike.com'
    private baseUrl: string        // For verification links

    // Password reset with VML fallback for Outlook
    async sendPasswordResetEmail(data: { email: string; resetUrl: string }): Promise<boolean>

    // Email verification
    async sendVerificationEmail(data: EmailVerificationData): Promise<boolean>

    // Welcome after signup
    async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean>

    // Tier upgrade confirmation
    async sendTierUpgradeEmail(data: TierUpgradeEmailData): Promise<boolean>

    // Crypto renewal reminder (7 days before expiration)
    async sendCryptoRenewalReminder(data: CryptoRenewalReminderData): Promise<boolean>

    // Crypto subscription expired notification
    async sendCryptoSubscriptionExpired(data: CryptoSubscriptionExpiredData): Promise<boolean>

    // Payment confirmation for crypto payments
    async sendPaymentConfirmationEmail(data: PaymentConfirmationEmailData): Promise<boolean>

    // Partial payment notification
    async sendPartialPaymentEmail(data: PartialPaymentEmailData): Promise<boolean>

    // Alert admin to payment issues
    async sendPaymentIssueAlert(data: PaymentIssueAlertData): Promise<boolean>
}
```

### Usage

```typescript
import { EmailService } from '../services/email'

const emailService = new EmailService()
await emailService.sendPasswordResetEmail({
    email: user.email,
    resetUrl: `https://volspike.com/auth/reset-password?token=${token}`
})
```

### Email Template Features

All emails include:
- VolSpike logo hosted at `https://volspike.com/email/volspike-badge@2x.png`
- VML fallback for bulletproof buttons in Outlook
- Hidden preheader text for email previews
- Responsive design with `@media` queries
- Support email footer: `support@volspike.com`

---

## Alert Broadcaster

**File:** `services/alert-broadcaster.ts`

Manages real-time alert delivery via Socket.IO. Uses module-level functions (not a class).

### Initialization

```typescript
let ioInstance: SocketIOServer | null = null

// Called from index.ts after Socket.IO server is created
export function setSocketIO(io: SocketIOServer) {
    ioInstance = io
    startTierBasedBroadcasting()
}
```

### Volume Alert Broadcasting

```typescript
export function broadcastVolumeAlert(alert: VolumeAlert) {
    // Elite tier: broadcast immediately
    ioInstance.to('tier-elite').emit('volume-alert', alert)

    // Pro tier: immediate if at 5-minute interval, else queue
    const alertMinute = alert.detectionTime.getMinutes()
    if (alertMinute % 5 === 0) {
        ioInstance.to('tier-pro').emit('volume-alert', alert)
    } else {
        alertQueues.pro.push(alert)
    }

    // Free tier: immediate if at 15-minute interval, else queue
    if (alertMinute % 15 === 0) {
        ioInstance.to('tier-free').emit('volume-alert', alert)
    } else {
        alertQueues.free.push(alert)
    }
}
```

### Open Interest Alert Broadcasting

```typescript
export function broadcastOpenInterestAlert(alert: OpenInterestAlert) {
    // Serialize Prisma Decimal fields to numbers
    const serializedAlert = {
        id: alert.id,
        symbol: alert.symbol,
        direction: alert.direction,
        baseline: Number(alert.baseline),
        current: Number(alert.current),
        pctChange: Number(alert.pctChange),
        // ... more fields
    }

    // OI alerts go to admin, pro, and elite only (not free tier)
    ioInstance.to('role-admin').emit('open-interest-alert', serializedAlert)
    ioInstance.to('tier-pro').emit('open-interest-alert', serializedAlert)
    ioInstance.to('tier-elite').emit('open-interest-alert', serializedAlert)
}
```

### User Deletion Broadcasting

```typescript
export async function broadcastUserDeletion(
    userId: string,
    reason: 'deleted' | 'banned' | 'suspended' = 'deleted'
) {
    // Emit to user's room
    ioInstance.to(`user-${userId}`).emit('user-deleted', {
        userId,
        reason,
        timestamp: new Date().toISOString(),
        message: 'Your account has been permanently deleted.'
    })

    // Force disconnect all sockets for this user
    const sockets = await ioInstance.in(`user-${userId}`).fetchSockets()
    sockets.forEach(socket => socket.disconnect(true))
}
```

### Wall-Clock Batching

```typescript
function startTierBasedBroadcasting() {
    // Check every second for wall-clock alignment
    setInterval(() => {
        const now = new Date()

        // Pro tier: :00, :05, :10, :15, etc.
        if (now.getMinutes() % 5 === 0 && now.getSeconds() === 0) {
            alertQueues.pro.forEach(alert => {
                ioInstance.to('tier-pro').emit('volume-alert', alert)
            })
            alertQueues.pro = []
        }

        // Free tier: :00, :15, :30, :45
        if (now.getMinutes() % 15 === 0 && now.getSeconds() === 0) {
            alertQueues.free.forEach(alert => {
                ioInstance.to('tier-free').emit('volume-alert', alert)
            })
            alertQueues.free = []
        }
    }, 1000)
}
```

### Batching Schedule

| Tier | Frequency | Emission Times |
|------|-----------|----------------|
| Free | 15 min | :00, :15, :30, :45 |
| Pro | 5 min | :00, :05, :10, :15, ... |
| Elite | Instant | Immediate on detection |

---

## Promo Code Service

**File:** `services/promo-code.ts`

Validates and applies promotional discount codes. Implemented as a class.

### Class: PromoCodeService

```typescript
export class PromoCodeService {
    // Validate a promo code and calculate discount
    async validateCode(request: ValidatePromoCodeRequest): Promise<ValidatePromoCodeResponse>

    // Calculate discount for a given price
    async calculateDiscount(code: string, originalPrice: number): Promise<{
        discountAmount: number
        finalPrice: number
        discountPercent: number
    }>

    // Increment usage count (call within transaction)
    async incrementUsage(
        codeId: string,
        userId: string,
        paymentId: string,
        amounts: { discountAmount: number; originalAmount: number; finalAmount: number }
    ): Promise<void>
}

// Singleton export
export const promoCodeService = new PromoCodeService()
```

### Validation Logic

```typescript
async validateCode(request: ValidatePromoCodeRequest): Promise<ValidatePromoCodeResponse> {
    const { code, tier, paymentMethod } = request
    const normalizedCode = code.toUpperCase().trim()

    const promoCode = await prisma.promoCode.findUnique({
        where: { code: normalizedCode }
    })

    // Check existence
    if (!promoCode) {
        return { valid: false, error: 'Promo code not found', reason: 'invalid_code' }
    }

    // Check active
    if (!promoCode.active) {
        return { valid: false, error: 'Promo code is no longer active', reason: 'inactive' }
    }

    // Check expiration
    if (new Date() > promoCode.validUntil) {
        return { valid: false, error: 'Promo code has expired', reason: 'expired' }
    }

    // Check usage limit
    if (promoCode.currentUses >= promoCode.maxUses) {
        return { valid: false, error: 'Promo code usage limit reached', reason: 'max_uses_reached' }
    }

    // Check payment method (STRIPE, CRYPTO, or ALL)
    if (!this.checkPaymentMethodMatch(promoCode.paymentMethod, paymentMethod)) {
        return { valid: false, error: `Promo code not valid for ${paymentMethod} payments`, reason: 'wrong_payment_method' }
    }

    // Calculate discount using centralized pricing
    const originalPrice = TIER_PRICES[tier]  // from lib/pricing.ts
    const discountAmount = (originalPrice * promoCode.discountPercent) / 100
    const finalPrice = Math.max(0, originalPrice - discountAmount)

    return {
        valid: true,
        discountPercent: promoCode.discountPercent,
        originalPrice,
        finalPrice,
        promoCodeId: promoCode.id
    }
}
```

### Usage Recording (Transactional)

```typescript
async incrementUsage(codeId, userId, paymentId, amounts) {
    await prisma.$transaction(async (tx) => {
        // Double-check usage limit under lock
        const promoCode = await tx.promoCode.findUnique({ where: { id: codeId } })
        if (promoCode.currentUses >= promoCode.maxUses) {
            throw new Error('Promo code usage limit reached')
        }

        // Increment counter
        await tx.promoCode.update({
            where: { id: codeId },
            data: { currentUses: { increment: 1 } }
        })

        // Create usage record for auditing
        await tx.promoCodeUsage.create({
            data: {
                promoCodeId: codeId,
                userId,
                paymentId,
                discountAmount: amounts.discountAmount,
                originalAmount: amounts.originalAmount,
                finalAmount: amounts.finalAmount
            }
        })
    })
}
```

---

## NowPayments Service

**File:** `services/nowpayments.ts`

Integration with NowPayments API for cryptocurrency payments.

### Class: NowPaymentsService

```typescript
export class NowPaymentsService {
    // Create hosted invoice for payment
    async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse>

    // Check payment status by payment ID
    async getPaymentStatus(paymentId: string): Promise<PaymentStatus>

    // Validate IPN webhook signature (HMAC-SHA512)
    validateIPN(body: any, signature: string): boolean

    // Get minimum payment amount for currency
    async getMinimumPaymentAmount(currency: string): Promise<number>
}
```

### IPN Signature Validation

```typescript
validateIPN(body: any, signature: string): boolean {
    const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET)
        .update(JSON.stringify(body))
        .digest('hex')
    return hmac === signature
}
```

### Supported Currencies

| Currency | Code | Network |
|----------|------|---------|
| USDT | usdtsol | Solana |
| USDT | usdterc20 | Ethereum |
| USDC | usdce | Ethereum |
| SOL | sol | Solana |
| ETH | eth | Ethereum |
| BTC | btc | Bitcoin |

---

## Payment Sync Service

**File:** `services/payment-sync.ts`

Polls NowPayments API to sync pending payment statuses.

### Function: syncPendingPayments

```typescript
export async function syncPendingPayments(): Promise<{
    synced: number
    upgraded: number
    errors: number
}> {
    // Find payments still waiting or confirming
    const pending = await prisma.cryptoPayment.findMany({
        where: { paymentStatus: { in: ['waiting', 'confirming'] } },
        include: { user: true }
    })

    for (const payment of pending) {
        const status = await nowPayments.getPaymentStatus(payment.paymentId)

        if (status === 'finished') {
            // Atomic upgrade with transaction
            await prisma.$transaction(async (tx) => {
                await tx.cryptoPayment.update({
                    where: { id: payment.id },
                    data: { paymentStatus: 'finished' }
                })
                await tx.user.update({
                    where: { id: payment.userId },
                    data: { tier: payment.tier }
                })
            })

            // Notify user via WebSocket
            io.to(`user-${payment.userId}`).emit('tier-change', { tier: payment.tier })
        }
    }
}
```

### Scheduling

Called from `index.ts` every 30 seconds:

```typescript
setInterval(syncPendingPayments, 30_000)
```

---

## Renewal Reminder Service

**File:** `services/renewal-reminder.ts`

Handles crypto subscription renewal reminders and expiration.

### Functions

```typescript
// Send 7-day reminder emails for expiring subscriptions
export async function checkAndSendRenewalReminders(): Promise<void>

// Downgrade users whose crypto subscriptions have expired
export async function checkAndDowngradeExpiredSubscriptions(): Promise<void>
```

### Reminder Logic

```typescript
async function checkAndSendRenewalReminders() {
    const sevenDaysFromNow = addDays(new Date(), 7)

    const expiringSoon = await prisma.cryptoPayment.findMany({
        where: {
            paymentStatus: 'finished',
            expiresAt: { lte: sevenDaysFromNow, gte: new Date() },
            renewalReminderSent: false
        },
        include: { user: true }
    })

    for (const payment of expiringSoon) {
        await emailService.sendCryptoRenewalReminder({
            email: payment.user.email,
            tier: payment.tier,
            daysUntilExpiration: differenceInDays(payment.expiresAt, new Date()),
            expiresAt: payment.expiresAt
        })

        await prisma.cryptoPayment.update({
            where: { id: payment.id },
            data: { renewalReminderSent: true }
        })
    }
}
```

### Expiration Logic

```typescript
async function checkAndDowngradeExpiredSubscriptions() {
    const expired = await prisma.cryptoPayment.findMany({
        where: {
            paymentStatus: 'finished',
            expiresAt: { lt: new Date() }
        },
        include: { user: { where: { tier: { not: 'free' } } } }
    })

    for (const payment of expired) {
        if (!payment.user) continue

        await prisma.user.update({
            where: { id: payment.userId },
            data: { tier: 'free' }
        })

        await emailService.sendCryptoSubscriptionExpired({
            email: payment.user.email,
            tier: payment.tier,
            expiresAt: payment.expiresAt
        })

        io.to(`user-${payment.userId}`).emit('tier-change', { tier: 'free' })
    }
}
```

---

## Nonce Manager

**File:** `services/nonce-manager.ts`

Manages cryptographic nonces for Web3 (SIWE) authentication.

### Functions

```typescript
// Generate a random nonce for wallet address
export function generateNonce(address: string): string

// Validate nonce hasn't been used and isn't expired
export function validateNonce(address: string, nonce: string): boolean

// Mark nonce as consumed (one-time use)
export function consumeNonce(address: string, nonce: string): void
```

### Usage in SIWE Flow

```typescript
// 1. Frontend requests nonce
const nonce = generateNonce(walletAddress)

// 2. User signs message containing nonce
// 3. Backend validates signature and nonce
if (validateNonce(address, signedNonce)) {
    consumeNonce(address, signedNonce)  // Prevent replay
    // Create session...
}
```

---

## Watchlist Service

**File:** `services/watchlist-service.ts`

Manages user watchlists (symbol-only storage).

### Class: WatchlistService

```typescript
export class WatchlistService {
    // Get all watchlists for user
    async getUserWatchlists(userId: string): Promise<Watchlist[]>

    // Get single watchlist
    async getWatchlist(id: string, userId: string): Promise<Watchlist | null>

    // Create new watchlist
    async createWatchlist(userId: string, name: string, symbols: string[]): Promise<Watchlist>

    // Update watchlist
    async updateWatchlist(id: string, userId: string, data: UpdateData): Promise<Watchlist>

    // Delete watchlist
    async deleteWatchlist(id: string, userId: string): Promise<void>

    // Add symbols to watchlist
    async addSymbols(id: string, userId: string, symbols: string[]): Promise<Watchlist>

    // Remove symbols from watchlist
    async removeSymbols(id: string, userId: string, symbols: string[]): Promise<Watchlist>
}
```

**Important:** Watchlists store symbols only (e.g., `['BTCUSDT', 'ETHUSDT']`). Market data comes from client-side Binance WebSocket.

---

## News Service

**File:** `services/news.ts`

RSS feed management for crypto news.

### Functions

```typescript
// Get all configured news sources
export async function getFeeds(): Promise<NewsSource[]>

// Seed default feeds (CoinDesk, Cointelegraph, etc.)
export async function seedFeeds(): Promise<void>

// Refresh all feeds and import new articles
export async function refreshAllFeeds(): Promise<RefreshResult[]>

// Remove articles older than retention period
export async function cleanupOldArticles(daysToKeep: number): Promise<number>
```

---

## Session Service

**File:** `services/session.ts`

Manages user sessions for single-session enforcement.

### Functions

```typescript
// Create session (invalidates existing for same device)
export async function createSession(userId: string, deviceId: string): Promise<Session>

// Validate session token
export async function validateSession(token: string): Promise<Session | null>

// Invalidate specific session
export async function invalidateSession(sessionId: string): Promise<void>

// Invalidate all sessions for user (force logout everywhere)
export async function invalidateAllSessions(userId: string): Promise<void>
```

---

## Telegram Service

**File:** `services/telegram.ts`

Telegram channel message ingestion.

### Functions

```typescript
// Store message from external poller
export async function ingestMessage(message: TelegramMessage): Promise<void>

// Get recent messages with pagination
export async function getMessages(limit: number, offset: number): Promise<TelegramMessage[]>

// Mark message as relevant for alerts
export async function markRelevant(messageId: string): Promise<void>
```

---

## Asset Metadata Service

**File:** `services/asset-metadata.ts`

Enriches cryptocurrency assets with CoinGecko metadata.

### Functions

```typescript
// Run full refresh cycle for all assets
export async function runAssetRefreshCycle(): Promise<RefreshResult>

// Retry assets that hit rate limits
export async function retryRateLimitedAssets(): Promise<void>

// Get current refresh progress
export function getRefreshProgress(): { completed: number; total: number; inProgress: boolean }
```

### Rate Limiting

CoinGecko free tier allows ~10-30 requests/minute. Service waits 3 seconds between requests.

---

## Admin Services

Located in `services/admin/`:

### User Management (`admin/user-management.ts`)

| Function | Description |
|----------|-------------|
| `listUsers` | Paginated user list with filters |
| `getUser` | Get user details by ID |
| `updateUser` | Update user profile |
| `deleteUser` | Soft or hard delete user |
| `changeTier` | Change subscription tier |
| `changeStatus` | Change account status |

### Audit Service (`admin/audit-service.ts`)

| Function | Description |
|----------|-------------|
| `logAuditEvent` | Record admin action with details |
| `getAuditLogs` | Query audit logs with filters |

### Metrics Service (`admin/metrics-service.ts`)

| Function | Description |
|----------|-------------|
| `getSystemMetrics` | Database, API health metrics |
| `getRevenueMetrics` | Revenue by period, method |
| `getUserMetrics` | User counts, tier distribution |

### Two-Factor Service (`admin/two-factor.ts`)

| Function | Description |
|----------|-------------|
| `generateSecret` | Generate TOTP secret and QR code |
| `verifyToken` | Verify 6-digit TOTP code |
| `enable2FA` | Enable 2FA for user |
| `disable2FA` | Disable 2FA for user |

---

## Service Patterns

### Singleton vs Module Functions

Some services use classes with singleton exports:
```typescript
export class EmailService { ... }
export const emailService = new EmailService()
```

Others use module-level functions:
```typescript
export function broadcastVolumeAlert(alert: VolumeAlert) { ... }
```

### Error Handling

```typescript
async function serviceFunction(): Promise<Result> {
    try {
        // Business logic
        return { success: true, data }
    } catch (error) {
        logger.error('Service error:', error)
        return { success: false, error: error.message }
    }
}
```

### Prisma Client Access

Services import Prisma from the main index:

```typescript
import { prisma } from '../index'
```

### Logging

```typescript
import { createLogger } from '../lib/logger'
const logger = createLogger()

logger.info('Processing started', { userId, action })
logger.error('Processing failed', { error: error.message })
```
