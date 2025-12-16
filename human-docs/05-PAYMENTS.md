# Payment System

## Overview

VolSpike supports two payment methods:
1. **Stripe** - Credit/debit cards with recurring subscriptions
2. **NowPayments** - Cryptocurrency payments (USDT, USDC, SOL, BTC, ETH)

---

## Pricing (Single Source of Truth)

All prices are defined in ONE location:

| Tier | Monthly Price |
|------|---------------|
| Free | $0 |
| Pro | $19 |
| Elite | $49 |

**Where prices are defined:**
- Frontend: `volspike-nextjs-frontend/src/lib/pricing.ts`
- Backend: `volspike-nodejs-backend/src/lib/pricing.ts`

```typescript
// lib/pricing.ts
export const TIER_PRICES = {
  free: 0,
  pro: 19,
  elite: 49,
} as const

export function formatPrice(tier: string): string {
  const price = TIER_PRICES[tier as keyof typeof TIER_PRICES]
  return price === 0 ? 'Free' : `$${price}`
}
```

**CRITICAL**: Never hardcode prices elsewhere. Always import from `lib/pricing.ts`.

---

## Stripe Integration

### Checkout Flow

```
User clicks "Upgrade to Pro"
         │
         ▼
Frontend: /checkout → calls createCheckoutSession()
         │
         ▼
Backend: POST /api/payments/checkout
         │
         ▼
Stripe API: Creates Checkout Session
         │
         ▼
User redirected to Stripe hosted checkout
         │
         ▼
User completes payment
         │
         ▼
Stripe redirects to /checkout/success?session_id=...
         │
         ▼
Stripe webhook: POST /api/payments/webhook
         │
         ▼
Backend updates user tier
         │
         ▼
Socket.IO emits 'tier-change' event
         │
         ▼
Frontend updates UI automatically
```

### Stripe Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/checkout` | POST | Create Checkout Session |
| `/api/payments/webhook` | POST | Handle Stripe webhooks |
| `/api/payments/portal` | POST | Create Customer Portal session |
| `/api/payments/subscription` | GET | Get subscription status |

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade user tier |
| `customer.subscription.updated` | Update tier on change |
| `customer.subscription.deleted` | Downgrade to free |
| `invoice.paid` | Record payment |
| `invoice.payment_failed` | Send notification |

### Code Location

- Frontend: `volspike-nextjs-frontend/src/lib/payments.ts`
- Backend: `volspike-nodejs-backend/src/routes/payments.ts`

---

## NowPayments (Crypto) Integration

### Checkout Flow

```
User selects "Pay with Crypto"
         │
         ▼
Frontend: selects currency (USDT, SOL, etc.)
         │
         ▼
Backend: POST /api/payments/nowpayments/checkout
         │
         ▼
NowPayments API: Creates hosted invoice
         │
         ▼
User redirected to NowPayments payment page
         │
         ▼
User sends crypto to provided address
         │
         ▼
NowPayments IPN: POST /api/payments/nowpayments/webhook
         │
         ▼
Backend creates/updates CryptoPayment record
         │
         ▼
Backend upgrades user tier
         │
         ▼
Socket.IO emits 'tier-change' event
```

### Supported Cryptocurrencies

| Currency | Network | Code |
|----------|---------|------|
| USDT | Solana | usdtsol |
| USDT | Ethereum | usdterc20 |
| USDC | Ethereum | usdce / usdcerc20 |
| SOL | Solana | sol |
| ETH | Ethereum | eth |
| BTC | Bitcoin | btc |

### NowPayments Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/nowpayments/checkout` | POST | Create crypto invoice |
| `/api/payments/nowpayments/test-checkout` | POST | $1 test payment (test accounts only) |
| `/api/payments/nowpayments/webhook` | POST | Handle IPN webhooks |

### CryptoPayment Data Model

```prisma
model CryptoPayment {
  id                   String    @id @default(cuid())
  userId               String
  paymentId            String?   @unique  // NowPayments payment ID
  paymentStatus        String?   // waiting, confirming, confirmed, finished
  payAmount            Float?    // Amount in fiat
  payCurrency          String?   // usd
  actuallyPaid         Float?    // Amount paid in crypto
  actuallyPaidCurrency String?   // usdtsol, btc, etc.
  tier                 String    // pro, elite
  invoiceId            String    @unique
  orderId              String
  paymentUrl           String
  payAddress           String?
  promoCodeId          String?
  paidAt               DateTime?
  expiresAt            DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}
```

### Currency Display Formatting

The admin panel displays crypto currencies in human-readable format:

```typescript
// lib/admin/currency-format.ts
export function formatCryptoCurrency(currency: string): string {
  const lower = currency.toLowerCase()

  // CRITICAL: Check USDCE first before generic USDC
  if (lower === 'usdce' || lower === 'usdcerc20' || lower === 'usdc_eth') {
    return 'USDC on ETH'
  }
  if (lower === 'usdterc20' || lower === 'usdt_eth') {
    return 'USDT on ETH'
  }
  if (lower === 'usdtsol' || lower === 'usdt_sol') {
    return 'USDT on SOL'
  }
  if (lower === 'sol') return 'SOL'
  if (lower === 'eth') return 'ETH'
  if (lower === 'btc') return 'BTC'

  // Legacy values without network (data quality issue)
  if (lower === 'usdt') return 'USDT (Unknown Network)'
  if (lower === 'usdc') return 'USDC (Unknown Network)'

  return currency.toUpperCase()
}
```

---

## Promo Codes

### Creating Promo Codes (Admin)

```typescript
// POST /api/admin/promo-codes
{
  code: 'LAUNCH20',
  discountPercent: 20,
  maxUses: 100,
  validUntil: '2025-12-31T23:59:59Z',
  paymentMethod: 'ALL'  // CRYPTO, STRIPE, or ALL
}
```

### Using Promo Codes

1. User enters promo code during checkout
2. Frontend validates via `/api/payments/validate-promo`
3. Discount applied to payment amount
4. Usage recorded in `PromoCodeUsage` table

### Promo Code Data Models

```prisma
model PromoCode {
  id              String   @id @default(cuid())
  code            String   @unique
  discountPercent Int
  maxUses         Int
  currentUses     Int      @default(0)
  validUntil      DateTime
  active          Boolean  @default(true)
  paymentMethod   PromoPaymentMethod @default(CRYPTO)
  createdById     String
  usages          PromoCodeUsage[]
}

model PromoCodeUsage {
  id             String    @id @default(cuid())
  promoCodeId    String
  userId         String
  paymentId      String
  discountAmount Float
  originalAmount Float
  finalAmount    Float
  createdAt      DateTime  @default(now())
}
```

---

## Subscription Management

### Customer Portal

Users can manage subscriptions via Stripe Customer Portal:

```typescript
// Frontend
const { data } = await api.post('/api/payments/portal')
window.location.href = data.url

// Backend creates portal session
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: `${FRONTEND_URL}/settings/billing`,
})
```

### Subscription Status Endpoint

```typescript
// GET /api/payments/subscription
{
  hasActiveSubscription: true,
  tier: 'pro',
  source: 'stripe',  // or 'crypto'
  expiresAt: '2025-01-15T00:00:00Z',
  willRenew: true,
  stripeStatus: 'active',
  cryptoPayment: null  // or CryptoPayment object
}
```

---

## Payment Sync (Background Job)

The backend runs a payment sync job every 30 seconds:

```typescript
// services/payment-sync.ts
export async function syncPendingPayments() {
  // 1. Check pending NowPayments invoices
  const pendingPayments = await prisma.cryptoPayment.findMany({
    where: { paymentStatus: { in: ['waiting', 'confirming'] } }
  })

  // 2. Query NowPayments API for status
  for (const payment of pendingPayments) {
    const status = await nowpayments.getPaymentStatus(payment.paymentId)

    // 3. If confirmed, upgrade user
    if (status === 'finished') {
      await upgradeUserTier(payment.userId, payment.tier)
    }
  }
}
```

---

## Renewal and Expiration

### Renewal Reminders

- Sent 7 days before crypto subscription expires
- Email via SendGrid
- Tracked in `renewalReminderSent` field

### Expiration Handling

- Daily job checks for expired subscriptions
- Downgrades expired users to free tier
- Sends notification email

```typescript
// services/renewal-reminder.ts
export async function checkAndDowngradeExpiredSubscriptions() {
  const expired = await prisma.cryptoPayment.findMany({
    where: {
      paymentStatus: 'finished',
      expiresAt: { lt: new Date() },
      user: { tier: { not: 'free' } }
    }
  })

  for (const payment of expired) {
    await prisma.user.update({
      where: { id: payment.userId },
      data: { tier: 'free' }
    })
  }
}
```

---

## Test Payment System

For testing crypto payments without real money:

### Test Accounts
Email must end with `-test@volspike.com`:
- `free-test@volspike.com`
- `pro-test@volspike.com`

### Test Endpoint

```typescript
// POST /api/payments/nowpayments/test-checkout
{
  tier: 'pro',
  currency: 'usdtsol'
}
// Creates $1 test invoice
```

### Test Page
Navigate to `/test-crypto-payment` (only visible to test accounts)

---

## Admin Payment Tools

### Payments Table (`/admin/payments`)

- View all payments (Stripe + Crypto)
- Filter by status, tier, date
- See payment details

### Create Payment Dialog

Admin can manually record crypto payments:

```typescript
// POST /api/admin/payments/create
{
  userId: 'user_id',
  tier: 'pro',
  invoiceId: 'nowpayments_invoice_id',
  actuallyPaidCurrency: 'usdtsol',
  actuallyPaid: 19.00
}
```

### Tier Mismatch Repair

If user's tier doesn't match their active payment:

```typescript
// POST /api/admin/payments/repair-tier
{
  userId: 'user_id',
  expectedTier: 'pro'
}
```

---

## Webhook Security

### Stripe Webhooks

```typescript
// Verify Stripe signature
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  STRIPE_WEBHOOK_SECRET
)
```

### NowPayments IPN

```typescript
// Verify IPN signature
const computedHmac = crypto
  .createHmac('sha512', IPN_SECRET)
  .update(JSON.stringify(body))
  .digest('hex')

if (computedHmac !== signature) {
  return c.json({ error: 'Invalid signature' }, 401)
}
```

---

## Environment Variables

### Frontend

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Backend

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# NowPayments
NOWPAYMENTS_API_KEY=your_api_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret
NOWPAYMENTS_SANDBOX_MODE=true  # false in production
```

---

## Troubleshooting

### "Payment stuck on processing"

1. Check NowPayments dashboard
2. Verify webhook is configured correctly
3. Check backend logs for IPN errors
4. Use admin panel to manually sync

### "Stripe webhook failing"

1. Verify `STRIPE_WEBHOOK_SECRET`
2. Check Stripe dashboard webhook logs
3. Use Stripe CLI for local testing:
   ```bash
   stripe listen --forward-to localhost:3001/api/payments/webhook
   ```

### "User didn't get upgraded"

1. Check payment status in admin panel
2. Verify user's `stripeCustomerId` is set
3. Check for race conditions in webhook handling
4. Use tier mismatch repair tool

### "Crypto payment not showing"

1. Check if `CryptoPayment` record exists
2. Verify `invoiceId` and `orderId` match
3. Check webhook logs for IPN delivery
4. Use "Create Payment from NowPayments" dialog

---

## Next: [Real-Time Data](06-REALTIME-DATA.md)
