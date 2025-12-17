# Backend Services

## Overview

Services in VolSpike contain business logic separated from route handlers. Located in `volspike-nodejs-backend/src/services/`.

**Total Service Files:** 22
- **Main Services:** 15 files
- **Admin Services:** 6 files
- **Infrastructure:** 1 file (deprecated)

---

## Email Service

**File:** `services/email.ts` (2000+ lines)

Handles all transactional emails via SendGrid. Implemented as a singleton class with 11 email methods.

### Class: EmailService

```typescript
export class EmailService {
    private fromEmail: string      // Default: 'noreply@volspike.com'
    private baseUrl: string        // For verification links

    // Get singleton instance
    static getInstance(): EmailService

    // Generate verification token (32 bytes hex)
    generateVerificationToken(): string
}
```

### Email Methods (13 total)

| Method | Purpose | Recipient | Trigger |
|--------|---------|-----------|---------|
| `sendPasswordResetEmail` | Password reset link (60 min expiry) | User | `/auth/forgot` form |
| `sendVerificationEmail` | Email verification link (24h expiry) | User | Signup |
| `sendWelcomeEmail` | Welcome after email verification | User | Email verified |
| `sendTierUpgradeEmail` | Tier upgrade/downgrade confirmation | User | Tier change |
| `sendPaymentConfirmationEmail` | Crypto payment confirmed | User | Payment finished |
| `sendPartialPaymentEmail` | Partial payment notification | User | Payment underpaid |
| `sendCryptoRenewalReminder` | Renewal reminder (7 days before) | User | Scheduled task |
| `sendCryptoSubscriptionExpired` | Subscription expired notification | User | Expiration check |
| `sendPaymentIssueAlertEmail` | Payment issue alert | Admin | Payment problems |
| `sendPaymentSuccessAlertEmail` | Payment success notification | Admin | Payment completed |
| `sendAlertEmail` | Custom user alert triggered | User | User-defined alert |
| `sendSuggestionNotification` | User feedback submitted | support@volspike.com | `/suggestions` form |
| `sendSuggestionConfirmation` | Suggestion confirmation | User | `/suggestions` form |

### Email Data Interfaces

```typescript
interface EmailVerificationData {
    email: string
    name?: string
    verificationUrl: string
}

interface WelcomeEmailData {
    email: string
    name?: string
    tier: string
}

interface TierUpgradeEmailData {
    email: string
    name?: string
    newTier: string
    previousTier?: string
}

interface PaymentConfirmationEmailData {
    email: string
    name?: string
    tier: string
    amountUsd: number
    payCurrency: string
    actuallyPaid: number | null
    actuallyPaidCurrency: string | null
    paymentId: string
    orderId: string
    expiresAt: Date
}

interface PartialPaymentEmailData {
    email: string
    name?: string
    tier: string
    requestedAmount: number
    actuallyPaid: number
    payCurrency: string
    shortfall: number
    shortfallPercent: string
    paymentId: string
    orderId: string
}

interface CryptoRenewalReminderData {
    email: string
    tier: string
    daysUntilExpiration: number
    expiresAt: Date
}

interface CryptoSubscriptionExpiredData {
    email: string
    tier: string
    expiresAt: Date
}

interface PaymentIssueAlertData {
    type: string
    details: Record<string, any>
}
```

### External API Calls

| API | Endpoint | Method | Purpose |
|-----|----------|--------|---------|
| SendGrid | `/mail/send` | POST | Send transactional emails |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes | SendGrid API authentication |
| `SENDGRID_FROM_EMAIL` | No | Sender email (default: `noreply@volspike.com`) |
| `SENDGRID_VERIFICATION_TEMPLATE_ID` | No | Optional template for verification emails |
| `SENDGRID_WELCOME_TEMPLATE_ID` | No | Optional template for welcome emails |
| `EMAIL_VERIFICATION_URL_BASE` | No | Base URL for verification links |

### Email Template Features

All emails are production-ready with:

**Visual Design:**
- VolSpike logo hosted at `https://volspike.com/email/volspike-badge@2x.png`
- Brand green header (`#0ea371` / `#059669`)
- Clean white card design with rounded corners
- Support footer: `support@volspike.com`

**Compatibility:**
- VML fallback for bulletproof buttons in Outlook
- `<!--[if mso]>` conditional comments for Microsoft clients
- Inline CSS for maximum compatibility
- System fonts with fallbacks

**Responsiveness:**
- `@media` queries for mobile
- Max-width containers (600px)
- Fluid image scaling

**Deliverability:**
- Hidden preheader text for email previews
- Proper `role="presentation"` on tables
- Text-only fallback version
- SendGrid category tagging

### Error Handling

- Graceful fallback to plain text if template ID missing
- Non-blocking email failures (logged but not thrown)
- Detailed error logging with SendGrid response details
- Safe initialization on startup (doesn't crash if SendGrid not configured)
- XSS protection via HTML escaping of user inputs

---

## Alert Broadcaster

**File:** `services/alert-broadcaster.ts`

Manages real-time alert delivery via Socket.IO. Uses module-level functions (not a class).

### Exported Functions

```typescript
// Initialize with Socket.IO server instance
export function setSocketIO(io: SocketIOServer): void

// Broadcast volume spike alert (tier-based delivery)
export function broadcastVolumeAlert(alert: VolumeAlert): void

// Broadcast Open Interest alert (Pro/Elite/Admin only)
export function broadcastOpenInterestAlert(alert: OpenInterestAlert): void

// Broadcast OI data update
export function broadcastOpenInterestUpdate(
    symbol: string,
    openInterest: number,
    openInterestUsd: number,
    source: string
): void

// Force disconnect deleted/banned user
export async function broadcastUserDeletion(
    userId: string,
    reason: 'deleted' | 'banned' | 'suspended'
): Promise<void>
```

### Socket.IO Emissions

| Event | Rooms | Description |
|-------|-------|-------------|
| `volume-alert` | `tier-elite`, `tier-pro`, `tier-free` | Volume spike alert |
| `open-interest-alert` | `role-admin`, `tier-pro`, `tier-elite` | OI spike/dump alert |
| `open-interest-update` | All tiers | Real-time OI data |
| `user-deleted` | `user-{userId}` | Account deletion notification |

### Wall-Clock Batching System

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

### Key Features

- Tier-based alert broadcasting with intelligent batching
- Serializes Prisma Decimal fields to JSON-compatible numbers
- In-memory queue system for batching alerts
- User deletion enforcement (forced socket disconnect)
- Comprehensive logging with emoji indicators

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

### Interfaces

```typescript
interface ValidatePromoCodeRequest {
    code: string
    tier: 'pro' | 'elite'
    paymentMethod: 'STRIPE' | 'CRYPTO'
}

interface ValidatePromoCodeResponse {
    valid: boolean
    discountPercent?: number
    originalPrice?: number
    finalPrice?: number
    promoCodeId?: string
    error?: string
    reason?: 'expired' | 'max_uses_reached' | 'inactive' | 'invalid_code' | 'wrong_payment_method'
}
```

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `findUnique` | PromoCode | Fetch by code |
| `update` | PromoCode | Increment usage `{ increment: 1 }` |
| `create` | PromoCodeUsage | Create usage record |
| `$transaction` | - | Atomic usage increment |

### Validation Logic

1. Code normalization (uppercase, trim)
2. Active status check
3. Expiration date check
4. Usage limit enforcement
5. Payment method matching (CRYPTO/STRIPE/ALL)
6. Price validation against `TIER_PRICES` from `lib/pricing.ts`

---

## NowPayments Service

**File:** `services/nowpayments.ts` (500+ lines)

Integration with NowPayments API for cryptocurrency payments.

### Class: NowPaymentsService

```typescript
export class NowPaymentsService {
    // Get singleton instance
    static getInstance(): NowPaymentsService

    // Create payment
    async createPayment(params: CreatePaymentParams): Promise<PaymentResponse>

    // Get payment status by ID
    async getPaymentStatus(paymentId: string): Promise<PaymentResponse>

    // Get invoice status
    async getInvoiceStatus(invoiceId: string): Promise<InvoiceResponse>

    // Create payment from existing invoice
    async createPaymentFromInvoice(invoiceId: string): Promise<PaymentResponse>

    // Create hosted invoice
    async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse>

    // Get list of available currencies
    async getAvailableCurrencies(): Promise<string[]>

    // Get minimum payment amount for currency
    async getMinimumAmount(currencyFrom: string, currencyTo: string): Promise<number | null>

    // Verify IPN webhook signature (HMAC-SHA512)
    verifyIPNSignature(body: string, signature: string): boolean
}
```

### External API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/payment` | POST | Create payment |
| `/payment/{paymentId}` | GET | Get payment status |
| `/invoice/{invoiceId}` | GET | Get invoice status |
| `/invoice` | POST | Create invoice |
| `/currencies` | GET | List supported currencies |
| `/min-amount` | GET | Get minimum payment amount |

**Base URL:** `https://api.nowpayments.io/v1`

### IPN Webhook Validation

```typescript
verifyIPNSignature(body: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET)
        .update(body)
        .digest('hex')
    return hmac === signature
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOWPAYMENTS_API_URL` | No | API base URL (default: https://api.nowpayments.io/v1) |
| `NOWPAYMENTS_API_KEY` | Yes | API authentication |
| `NOWPAYMENTS_IPN_SECRET` | Yes | Webhook verification secret |

### Supported Currencies

| Currency | Code | Network |
|----------|------|---------|
| USDT | usdtsol | Solana |
| USDT | usdterc20 | Ethereum |
| USDC | usdce | Ethereum |
| SOL | sol | Solana |
| ETH | eth | Ethereum |
| BTC | btc | Bitcoin |

### Error Handling

- Detailed logging of all API responses
- Graceful error messages for common failures (401, 400, network)
- Rate limit retry with exponential backoff
- Network error handling (connection refused, timeout)

---

## Payment Sync Service

**File:** `services/payment-sync.ts`

Polls NowPayments API to sync pending payment statuses.

### Exported Function

```typescript
export async function syncPendingPayments(): Promise<{
    checked: number
    synced: number
    upgraded: number
}>
```

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `findMany` | CryptoPayment | Find pending payments (max 100) |
| `update` | CryptoPayment | Update status and amounts |
| `update` | User | Upgrade user tier |
| `$transaction` | - | Atomic user upgrade |

### Sync Logic

1. Finds all payments NOT in: `['finished', 'confirmed', 'failed', 'refunded', 'expired']`
2. Fetches latest status from NowPayments API
3. Updates payment with: paymentStatus, actuallyPaid, actuallyPaidCurrency, updatedAt
4. Handles `partially_paid` status with:
   - Change threshold detection (1% or 0.000001 minimum delta)
   - Admin notification with payment issue alert
   - User notification email
   - Exchange rate calculations

### Upgrade Trigger

- When payment status becomes 'finished' or 'confirmed'
- User tier must NOT match payment tier (prevents double upgrades)
- Creates subscription expiry date (now + 30 days)
- Sends payment confirmation email + tier upgrade email

### Rate Limiting

- 500ms delay between API calls (prevents rate limiting)

### Scheduling

Called from `index.ts` every 30 seconds:

```typescript
setInterval(syncPendingPayments, 30_000)
```

---

## Renewal Reminder Service

**File:** `services/renewal-reminder.ts`

Handles crypto subscription renewal reminders and expiration.

### Exported Functions

```typescript
// Send 7-day reminder emails for expiring subscriptions
export async function checkAndSendRenewalReminders(): Promise<{
    checked: number
    sent: number
}>

// Downgrade users whose crypto subscriptions have expired
export async function checkAndDowngradeExpiredSubscriptions(): Promise<{
    checked: number
    downgraded: number
}>
```

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `findMany` | CryptoPayment | Find expiring/expired payments |
| `update` | CryptoPayment | Update reminderSentAt timestamp |
| `update` | User | Downgrade tier to 'free' |
| `deleteMany` | Watchlist | Delete all user watchlists on downgrade |

### Reminder Logic

| Window | Behavior |
|--------|----------|
| 7 days | Send once when entered (if not sent) |
| 3 days | Send every 24 hours if changed/not sent |
| 1 day | Send every 12 hours if changed/not sent |

### Downgrade Logic

1. Finds crypto payments with `paymentStatus = 'finished'` AND `expiresAt < now`
2. Deletes all user watchlists (no grandfathering)
3. Sends expiration notification email
4. Updates user tier to 'free'

### Scheduled Task Resilience

- Pre-flight schema check (queries expiresAt field)
- Graceful handling if migration not applied
- Non-throwing errors (returns empty result instead)

---

## Nonce Manager

**File:** `services/nonce-manager.ts`

Manages cryptographic nonces for Web3 (SIWE) authentication.

### Exported Instance

```typescript
export const nonceManager: NonceManager
```

### Public Methods

```typescript
class NonceManager {
    // Generate nonce for wallet address
    generate(address: string, provider: 'evm' | 'solana'): string

    // Validate nonce hasn't been used and isn't expired
    validate(nonce: string): NonceData | null

    // Mark nonce as consumed (one-time use)
    consume(nonce: string): boolean

    // Get current nonce count
    getSize(): number

    // Clear all nonces
    clear(): void
}
```

### Features

| Feature | Value |
|---------|-------|
| Storage | In-memory Map |
| TTL | 5 minutes (300,000 ms) |
| Use | One-time only |
| Cleanup | Every 30 seconds |

### Security

- Nonces expire automatically after 5 minutes
- Cleanup on process SIGTERM
- Logging of nonce lifecycle (generated, validated, consumed, expired)
- SIWE EIP-4361 compliant

**Note:** Uses in-memory storage; for production with multiple instances, should use Redis.

---

## Watchlist Service

**File:** `services/watchlist-service.ts`

Manages user watchlists (symbol-only storage).

### Class: WatchlistService (Static Methods)

```typescript
export class WatchlistService {
    // Get tier limits
    static getLimits(tier: string): { watchlistLimit: number; symbolLimit: number }

    // Count user's watchlists
    static countWatchlists(userId: string): Promise<number>

    // Count unique symbols across all watchlists
    static countUniqueSymbols(userId: string): Promise<number>

    // Check if user can create new watchlist
    static canCreateWatchlist(userId: string, tier: string): Promise<{
        allowed: boolean
        reason?: string
        currentCount: number
        limit: number
    }>

    // Check if user can add symbol
    static canAddSymbol(userId: string, tier: string, symbol: string, watchlistId: string): Promise<{
        allowed: boolean
        reason?: string
        currentCount: number
        limit: number
        isDuplicate: boolean
    }>

    // Get complete limit status
    static getLimitStatus(userId: string, tier: string): Promise<{...}>

    // Delete all watchlists for user
    static deleteAllWatchlists(userId: string): Promise<number>
}
```

### Tier Limits

| Tier | Watchlists | Symbols |
|------|------------|---------|
| Free | 1 | 10 |
| Pro | 3 | 30 |
| Elite | 50 | Unlimited |

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `count` | Watchlist | Count user watchlists |
| `groupBy` | WatchlistItem | Count unique symbols |
| `findUnique` | Contract | Find symbol (no create) |
| `findFirst` | WatchlistItem | Check for duplicates |
| `deleteMany` | Watchlist | Cascade delete items |

### Validation Logic

- Duplicate check per watchlist
- New symbol check across all user watchlists
- Users can add same symbol to multiple watchlists (counted once)
- When at limit, still allows adding existing symbols

**Important:** Watchlists store symbols only (e.g., `['BTCUSDT', 'ETHUSDT']`). Market data comes from client-side Binance WebSocket.

---

## News Service

**File:** `services/news.ts`

RSS feed management for crypto news.

### Class: NewsService

```typescript
export class NewsService {
    constructor(prisma: PrismaClient)

    // Seed default RSS feeds
    async seedFeeds(): Promise<number>

    // Get all feeds with stats
    async getFeeds(includeDisabled?: boolean): Promise<FeedWithStats[]>

    // Get single feed
    async getFeed(id: string): Promise<RssFeed | null>

    // Update feed settings
    async updateFeed(id: string, data: UpdateData): Promise<RssFeed>

    // Delete feed and articles
    async deleteFeed(id: string): Promise<{ name: string; articlesDeleted: number }>

    // Get articles with pagination
    async getArticles(options: ArticleOptions): Promise<RssArticle[]>

    // Refresh single feed
    async refreshFeed(feedId: string): Promise<RefreshFeedResult>

    // Refresh all feeds
    async refreshAllFeeds(enabledOnly?: boolean): Promise<Map<string, RefreshFeedResult>>

    // Cleanup old articles
    async cleanupOldArticles(maxArticles?: number): Promise<number>

    // Get statistics
    async getStats(): Promise<Stats>
}
```

### External API Calls

- RSS Feed Parser via `parseRssFeed()` from `../lib/rss`
- 12 curated cryptocurrency news sources (CoinDesk, Cointelegraph, CryptoSlate, etc.)

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `upsert` | RssFeed | Seed/update feeds |
| `findMany` | RssFeed | List with article counts |
| `findMany` | RssArticle | Get articles with pagination |
| `upsert` | RssArticle | Store/update articles |
| `deleteMany` | RssArticle | Cleanup old articles |

### Caching

- Article query cache via `articleQueryCache` (5-minute TTL)
- Flush on updates

### Features

- Batch feed refresh (5 feeds at a time)
- Auto-cleanup keeps only 200 most recent articles
- Error tracking per feed (errorCount, lastError)
- Feed priority ordering
- Enable/disable feeds

---

## Session Service

**File:** `services/session.ts`

Manages user sessions for single-session enforcement.

### Exported Functions

```typescript
// Create session (invalidates existing for same device)
export async function createSession(
    prisma: PrismaClient,
    params: CreateSessionParams
): Promise<{ sessionId: string; invalidatedSessions: number }>

// Validate session token
export async function validateSession(
    prisma: PrismaClient,
    sessionId: string
): Promise<{ isValid: boolean; userId?: string; reason?: string }>

// Update last activity timestamp
export async function updateSessionActivity(
    prisma: PrismaClient,
    sessionId: string
): Promise<void>

// Get all user sessions
export async function getUserSessions(
    prisma: PrismaClient,
    userId: string,
    currentSessionId?: string
): Promise<SessionInfo[]>

// Revoke specific session
export async function revokeSession(
    prisma: PrismaClient,
    sessionId: string,
    userId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }>

// Revoke all sessions for user
export async function revokeAllUserSessions(
    prisma: PrismaClient,
    userId: string,
    reason?: string
): Promise<{ count: number }>

// Get session limit for tier
export function getSessionLimit(tier: string): number

// Cleanup expired sessions
export async function cleanupExpiredSessions(
    prisma: PrismaClient
): Promise<number>
```

### Session Limits

| Tier | Limit | Behavior |
|------|-------|----------|
| Free | 1 | Invalidates all others on new login |
| Pro | 1 | Invalidates all others on new login |
| Elite | 4 | Oldest invalidated if limit exceeded |
| ADMIN | Unlimited | No enforcement |

### Session Fields

```typescript
interface UserSession {
    id: string
    userId: string
    deviceId: string
    deviceName: string
    ipAddress: string
    userAgent: string
    tier: string
    expiresAt: Date       // 30 days
    isActive: boolean
    invalidatedAt?: Date
    invalidatedBy?: string
    lastActivityAt: Date
}
```

### Device Detection

Parses userAgent for device name:
- "Chrome on Windows"
- "Safari on Mac"
- "iPhone"
- "iPad"
- "Android Phone"

---

## Telegram Service

**File:** `services/telegram.ts`

Telegram channel message ingestion.

### Class: TelegramService

```typescript
export class TelegramService {
    constructor(prisma: PrismaClient)

    // Ingest messages from poller
    async ingestMessages(
        channelData: ChannelData,
        messages: MessageData[]
    ): Promise<IngestResult>

    // Get channels with stats
    async getChannels(): Promise<ChannelWithStats[]>

    // Get messages with pagination
    async getMessages(options: MessageOptions): Promise<{
        messages: TelegramMessage[]
        total: number
    }>

    // Cleanup old messages
    async cleanupOldMessages(maxMessagesPerChannel?: number): Promise<number>

    // Get statistics
    async getStats(): Promise<Stats>

    // Set channel error
    async setChannelError(channelId: string, error: string): Promise<void>

    // Toggle channel enabled state
    async toggleChannel(id: string, enabled: boolean): Promise<TelegramChannel>

    // Delete channel and messages
    async deleteChannel(id: string): Promise<{
        username: string
        messagesDeleted: number
    }>

    // Get recent messages (simplified)
    async getRecentMessages(limit?: number): Promise<SimplifiedMessage[]>
}
```

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `upsert` | TelegramChannel | Create/update channels |
| `upsert` | TelegramMessage | Store/update messages |
| `deleteMany` | TelegramMessage | Cleanup by date |

### Message Categorization

Keyword-based auto-categorization:
- `crypto` - Cryptocurrency topics
- `macro` - Macroeconomic news
- `tech` - Technology news
- `markets` - General market news
- `business` - Business news
- `geopolitics` - Political events

### Features

- Pagination support (limit, page)
- Filtering by channel username or ID
- Date filtering (before parameter)
- JSON serialization handling (BigInt → String)
- Handles BigInt conversion (messageId, channelId)
- Upsert pattern for duplicate handling
- Automatic cleanup (keeps 1000 most recent messages per channel)
- Handles media types: hasMedia, mediaType, links array

---

## Asset Metadata Service

**File:** `services/asset-metadata.ts` (1000+ lines)

Enriches cryptocurrency assets with CoinGecko metadata.

### Exported Functions

```typescript
// Get refresh progress status
export function getRefreshProgress(): RefreshProgress

// Get asset manifest for frontend
export async function getAssetManifest(): Promise<{
    assets: Asset[]
    generatedAt: Date
    source: string
}>

// Refresh single asset metadata
export async function refreshSingleAsset(
    asset: Asset,
    forceRefresh?: boolean
): Promise<{ success: boolean; reason?: string; error?: string }>

// Detect new assets from market data
export async function detectNewAssetsFromMarketData(
    symbols: string[]
): Promise<{ created: number; newSymbols: string[] }>

// Retry assets that hit rate limits
export async function retryRateLimitedAssets(): Promise<{
    retried: number
    succeeded: number
    failed: number
}>

// Run full refresh cycle
export async function runAssetRefreshCycle(
    reason?: string
): Promise<DetailedResults>
```

### External API Calls

| API | Endpoint | Method | Purpose |
|-----|----------|--------|---------|
| CoinGecko | `/search?query={symbol}` | GET | Search for coin |
| CoinGecko | `/coins/{id}` | GET | Get coin profile |
| CoinGecko | `{image_url}` | GET | Fetch logo image |
| Binance | `/fapi/v1/exchangeInfo` | GET | Validate symbols |

**CoinGecko Base URL:** `https://api.coingecko.com/api/v3`

### Rate Limiting

- 3 second gap between requests
- Exponential backoff on 429 (5s, 10s, 20s)
- Proxy support via `BINANCE_PROXY_URL`

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `findMany` | Asset | Get all assets |
| `create` | Asset | Create new asset (status 'AUTO') |
| `update` | Asset | Update with CoinGecko data |
| `count` | Asset | Check if DB empty |

### Asset Refresh Logic

| Asset State | Behavior |
|-------------|----------|
| Complete | Weekly refresh only (7 days) |
| Incomplete | Auto-refresh when missing fields OR stale |
| No CoinGecko ID | Skip (appears in "Missing Data" filter) |

### Progress Tracking

```typescript
interface RefreshProgress {
    isRunning: boolean
    current: number
    total: number
    currentSymbol: string
    startedAt: Date
    refreshed: number
    failed: number
    skipped: number
    noUpdate: number
    errors: string[]
    successes: string[]
}
```

Progress kept for 30 seconds after completion for frontend polling.

### Features

- 60-item batch limit for new symbol creation per run
- Static seed manifest (BTC, ETH, SOL, etc.) for bootstrap
- Logo URL handling: CoinGecko URL + base64 fallback
- Description sanitization: HTML tag removal, entity decoding
- URL validation before storage (HEAD request check, private IP rejection)
- Force refresh with CoinGecko ID changes (clears old data if 404)

---

## Binance Client

**File:** `services/binance-client.ts`

**Note:** Per CLAUDE.md architecture rules, Binance REST API should ONLY be called from Digital Ocean scripts. This service exists for legacy/fallback purposes.

### Exported Functions

```typescript
// Get market data for symbol(s)
export async function getMarketData(
    symbol?: string,
    skipVolumeFilter?: boolean
): Promise<MarketData[] | MarketData | null>

// Get data for single symbol
export async function getSymbolData(
    symbol: string
): Promise<MarketData | null>

// Get historical candlestick data
export async function getHistoricalData(
    symbol: string,
    interval?: string,
    limit?: number
): Promise<Kline[]>
```

### External API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/fapi/v1/ticker/24hr` | GET | 24-hour price/volume |
| `/fapi/v1/premiumIndex` | GET | Funding rates |
| `/fapi/v1/klines` | GET | Historical candlesticks |

**Base URL:** `https://fapi.binance.com`

### Volume Filtering

- Single symbol: Respects `skipVolumeFilter` parameter
- Batch: Filters symbols with <$1M 24h quote volume
- Watchlist symbols can bypass volume filter

### Error Handling

- Returns empty array on API failure (non-throwing)
- Detailed logging of Binance API errors
- Graceful fallback for funding rate failures (uses 0)

---

## Currency Mapper Service

**File:** `services/currency-mapper.ts`

Maps internal currency codes to NowPayments format.

### Exported Functions

```typescript
// Map our code to NowPayments code
export function mapCurrencyToNowPayments(
    ourCode: string,
    availableCurrencies?: string[]
): string | null

// Get display name for currency
export function getCurrencyDisplayName(ourCode: string): string

// Get network identifier
export function getCurrencyNetwork(ourCode: string): string

// Check if currency is supported
export function isSupportedCurrency(ourCode: string): boolean
```

### Supported Currencies

| Our Code | Display Name | Network |
|----------|--------------|---------|
| usdtsol | USDT | Solana |
| usdterc20 | USDT | Ethereum |
| usdce | USDC | Ethereum |
| sol | SOL | Solana |
| btc | BTC | Bitcoin |
| eth | ETH | Ethereum |

### Mapping Priority

1. Network-specific formats (exact match): usdtsol, usdterc20, usdc-erc20
2. Network-specific formats (fuzzy match): Partial matching with network identifiers
3. Fallback search: Contains base code + network identifier
4. Generic formats (exact): Original code, uppercase variants

### Network Safety

- Solana: Checks sol, spl, solana identifiers; excludes eth/erc20
- Ethereum: Checks erc20, eth, ethereum identifiers; excludes sol/spl
- Prevents cross-network mismatches

---

## Notifications Service

**File:** `services/notifications.ts`

Creates admin notifications for system events.

### Exported Functions

```typescript
// Create notification for all admins
export async function createAdminNotification(
    type: string,
    title: string,
    message: string,
    metadata?: object
): Promise<void>

// Notify when new asset detected
export async function notifyNewAssetDetected(
    assetSymbol: string,
    assetId: string
): Promise<void>
```

### Database Operations

| Operation | Model | Purpose |
|-----------|-------|---------|
| `findMany` | User | Find all admin users |
| `createMany` | AdminNotification | Create batch notifications |

### Notification Types

| Type | Description |
|------|-------------|
| `NEW_ASSET_DETECTED` | Auto-generated when new asset detected |
| `ASSET_ENRICHMENT_FAILED` | When metadata enrichment fails |

---

## OI Liquidity Job (Deprecated)

**File:** `services/oi-liquidity-job.ts`

**Status:** DEPRECATED - Moved to Digital Ocean Python scripts.

### Remaining Export

```typescript
// API endpoint to serve liquid universe data
export async function getLiquidUniverseForAPI(): Promise<{
    updatedAt: Date
    enterThreshold: number
    exitThreshold: number
    symbols: string[]
    totalSymbols: number
}>
```

Data is populated by Digital Ocean script, this service only reads.

---

## Admin Services

Located in `services/admin/`:

### User Management Service

**File:** `services/admin/user-management.ts`

```typescript
export class UserManagementService {
    // Get paginated user list
    static getUsers(query: UserQuery): Promise<{ users: User[]; pagination: Pagination }>

    // Get user by ID with relations
    static getUserById(userId: string): Promise<UserDetail>

    // Create new user (admin action)
    static createUser(
        data: CreateUserData,
        adminUserId: string
    ): Promise<{ user: User; temporaryPassword: string }>

    // Update user data
    static updateUser(userId: string, data: UpdateData, adminUserId: string): Promise<User>

    // Delete user (soft or hard)
    static deleteUser(userId: string, hardDelete: boolean, adminUserId: string): Promise<{ success: boolean }>

    // Suspend user account
    static suspendUser(userId: string, adminUserId: string): Promise<User>

    // Activate user account
    static activateUser(userId: string, adminUserId: string): Promise<User>

    // Reset user password
    static resetPassword(userId: string, adminUserId: string): Promise<{ temporaryPassword: string }>

    // Change user role
    static changeRole(userId: string, role: string, adminUserId: string): Promise<User>
}
```

### Audit Service

**File:** `services/admin/audit-service.ts`

```typescript
export class AuditService {
    // Create audit log entry
    static createAuditLog(data: CreateAuditLogData): Promise<AuditLog>

    // Get audit logs with filters
    static getAuditLogs(query: AuditLogQuery): Promise<{ logs: AuditLog[]; pagination: Pagination }>

    // Get statistics
    static getAuditLogStats(days?: number): Promise<Stats>

    // Search audit logs
    static searchAuditLogs(
        searchTerm: string,
        query: AuditLogQuery
    ): Promise<{ logs: AuditLog[]; pagination: Pagination; searchTerm: string }>

    // Get single log by ID
    static getAuditLogById(logId: string): Promise<AuditLog>

    // Get logs for specific user
    static getUserAuditLogs(userId: string, query: AuditLogQuery): Promise<{ logs: AuditLog[]; pagination: Pagination }>

    // Export logs to file
    static exportAuditLogs(query: AuditLogQuery, format: 'csv' | 'json'): Promise<string>

    // Log user action (convenience method)
    static logUserAction(actorUserId: string, action: string, targetType: string, ...): Promise<AuditLog>

    // Log security event
    static logSecurityEvent(actorUserId: string, event: string, details: object, ...): Promise<AuditLog>

    // Log bulk action
    static logBulkAction(actorUserId: string, action: string, targetType: string, targetIds: string[], ...): Promise<AuditLog>

    // Cleanup old logs
    static cleanupOldAuditLogs(retentionDays?: number): Promise<number>
}
```

**Audit Log Retention:** 90+ days by default.

### Metrics Service

**File:** `services/admin/metrics-service.ts`

```typescript
export class MetricsService {
    // Get system-wide metrics
    static getSystemMetrics(period?: string): Promise<SystemMetrics>

    // Get user metrics
    static getUserMetrics(period?: string): Promise<UserMetrics>

    // Get revenue metrics
    static getRevenueMetrics(period?: string): Promise<RevenueMetrics>

    // Get activity metrics
    static getActivityMetrics(period?: string): Promise<ActivityMetrics>

    // Get health metrics
    static getHealthMetrics(): Promise<HealthMetrics>
}
```

**Periods:** '7d', '30d', '90d', '1y'

**Note:** Revenue, API response time, error rate, and resource usage are placeholder implementations.

### Two-Factor Service

**File:** `services/admin/two-factor.ts`

```typescript
export class TwoFactorService {
    // Generate 2FA setup (secret + QR code)
    static generate2FASetup(userId: string): Promise<TwoFactorSetup>

    // Verify 6-digit TOTP code
    static verify2FACode(userId: string, code: string, backupCode?: string): Promise<boolean>

    // Enable 2FA for user
    static enable2FA(userId: string, adminUserId: string): Promise<void>

    // Disable 2FA for user
    static disable2FA(userId: string, adminUserId: string): Promise<void>

    // Verify backup code
    static verifyBackupCode(userId: string, backupCode: string): Promise<boolean>

    // Generate new backup codes
    static generateNewBackupCodes(userId: string, adminUserId: string): Promise<string[]>

    // Check if 2FA enabled
    static is2FAEnabled(userId: string): Promise<boolean>

    // Get 2FA status
    static get2FAStatus(userId: string): Promise<Status>

    // Validate setup (before enabling)
    static validate2FASetup(userId: string, code: string): Promise<boolean>

    // Log failed attempt
    static logFailed2FAAttempt(userId: string, code: string): Promise<void>

    // Log successful attempt
    static logSuccessful2FAAttempt(userId: string): Promise<void>
}
```

**External Libraries:**
- `speakeasy`: TOTP secret generation and verification
- `qrcode`: QR code generation

**Backup Codes:**
- 10 codes, 8 characters each
- Format: `XXXXXXXX` (uppercase alphanumeric A-Z0-9)

**TOTP Settings:**
- 30-second time windows
- Window=2 allows ±60 seconds tolerance
- Issuer: "VolSpike"

**Security Note:** 2FA secrets stored unencrypted. Production should encrypt.

### Invite Service

**File:** `services/admin/invite-service.ts`

Handles user invitations with email delivery.

### Promo Code Admin Service

**File:** `services/admin/promo-code-admin.ts`

Admin-specific promo code management (CRUD operations).

---

## Service Patterns

### Singleton vs Module Functions

Some services use classes with singleton exports:
```typescript
export class EmailService { ... }
export const emailService = new EmailService()
// or
static getInstance(): EmailService
```

Others use module-level functions:
```typescript
export function broadcastVolumeAlert(alert: VolumeAlert) { ... }
```

### Error Handling Pattern

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

---

## Critical Notes

1. **Binance REST API in Backend:** `binance-client.ts` exists but per CLAUDE.md, Binance REST API should ONLY run on Digital Ocean. This is legacy code.

2. **2FA Storage Not Encrypted:** Comments note `twoFactorSecret` should be encrypted in production.

3. **Revenue Metrics Stubbed:** MetricsService revenue methods return 0/empty (need Stripe integration).

4. **Nonce Manager Not Distributed:** In-memory Map doesn't work with multiple Node.js instances (needs Redis in production).

5. **Email Service Initialization Silent:** Non-critical failures on startup don't block the app.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Functions/Methods | 150+ |
| Database Models Touched | 20+ |
| External APIs Called | 4 (SendGrid, NowPayments, CoinGecko, Binance) |
| Transaction Usage | 5 services |
| Logging Coverage | 100% |

---

## Next: [Database Schema](15-DATABASE.md)
