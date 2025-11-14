# NowPayments Crypto Payment Integration Guide

## Overview

This guide provides step-by-step instructions for integrating NowPayments cryptocurrency payments into VolSpike, alongside the existing Stripe payment system. The integration is designed to be modular, maintainable, and consistent with the existing codebase architecture.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [NowPayments Account Setup](#nowpayments-account-setup)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Database Schema](#database-schema)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Active NowPayments account at [nowpayments.io](https://nowpayments.io)
- NowPayments API key (sandbox and production)
- NowPayments IPN secret (for webhook verification)
- Existing Stripe integration (already working)
- Access to VolSpike backend and frontend codebases

---

## NowPayments Account Setup

### Step 1: Create Account
1. Visit [nowpayments.io](https://nowpayments.io) and sign up
2. Verify your email address
3. Complete KYC verification (required for production)

### Step 2: Configure Payout Wallet
1. Navigate to **Dashboard > Settings > Payments > Payout wallets**
2. Add your cryptocurrency wallet addresses (BTC, ETH, USDT, etc.)
3. Verify wallet addresses

### Step 3: Generate API Keys
1. Go to **Dashboard > Settings > Payments > API keys**
2. Create a new API key for your environment:
   - **Sandbox API Key**: For testing
   - **Production API Key**: For live payments
3. Copy and securely store your API keys

### Step 4: Get IPN Secret
1. Navigate to **Dashboard > Settings > Payments > IPN Settings**
2. Generate or copy your IPN secret (used for webhook verification)
3. Store securely alongside API keys

### Step 5: Configure IPN URL
1. In IPN Settings, set your webhook URL:
   - **Development**: `http://localhost:3001/api/payments/nowpayments/webhook`
   - **Production**: `https://your-backend-domain.com/api/payments/nowpayments/webhook`
2. Enable IPN notifications

### Step 6: Set Base Currency
1. Go to **Dashboard > Settings > Payments > Payment details**
2. Set base currency to **USD** (matches Stripe pricing)

---

## Backend Integration

### Step 1: Install Dependencies

```bash
cd volspike-nodejs-backend
npm install axios crypto
```

### Step 2: Environment Variables

Add to `volspike-nodejs-backend/.env`:

```bash
# NowPayments Configuration
NOWPAYMENTS_API_KEY=your-sandbox-or-production-api-key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret
NOWPAYMENTS_SANDBOX_MODE=true  # Set to false for production
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1  # Production
# NOWPAYMENTS_API_URL=https://api-sandbox.nowpayments.io/v1  # Sandbox
```

### Step 3: Database Schema Update

Add `CryptoPayment` model to `prisma/schema.prisma`:

```prisma
model CryptoPayment {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  paymentId         String   @unique // NowPayments payment_id
  paymentStatus     String   // waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
  payAmount         Float    // Amount in USD
  payCurrency       String   // USD
  actuallyPaid     Float?   // Amount actually paid in crypto
  actuallyPaidCurrency String? // Crypto currency (BTC, ETH, etc.)
  purchaseId        String?  // Order ID for tracking
  tier              String   // pro, elite
  invoiceId         String?  // NowPayments invoice_id
  orderId           String?  // NowPayments order_id
  paymentUrl        String?  // Payment page URL
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  paidAt            DateTime?
  
  @@index([userId])
  @@index([paymentId])
  @@index([paymentStatus])
  @@map("crypto_payments")
}
```

Update `User` model to include relation:

```prisma
model User {
  // ... existing fields ...
  cryptoPayments    CryptoPayment[]
  // ... rest of fields ...
}
```

Run migration:

```bash
cd volspike-nodejs-backend
npx prisma db push
```

### Step 4: Create NowPayments Service

Create `volspike-nodejs-backend/src/services/nowpayments.ts`:

```typescript
import axios from 'axios'
import crypto from 'crypto'
import { createLogger } from '../lib/logger'

const logger = createLogger()

const API_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1'
const API_KEY = process.env.NOWPAYMENTS_API_KEY || ''
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ''

export interface CreatePaymentParams {
  price_amount: number
  price_currency: string
  pay_currency?: string
  order_id?: string
  order_description?: string
  ipn_callback_url?: string
  success_url?: string
  cancel_url?: string
}

export interface PaymentResponse {
  payment_id: string
  payment_status: string
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  actually_paid?: number
  pay_currency: string
  order_id?: string
  order_description?: string
  purchase_id?: string
  outcome_amount?: number
  outcome_currency?: string
  pay_url?: string
  invoice_id?: string
}

export class NowPaymentsService {
  private static instance: NowPaymentsService

  static getInstance(): NowPaymentsService {
    if (!NowPaymentsService.instance) {
      NowPaymentsService.instance = new NowPaymentsService()
    }
    return NowPaymentsService.instance
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/payment`,
        params,
        {
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      )

      logger.info('NowPayments payment created', {
        paymentId: response.data.payment_id,
        orderId: params.order_id,
      })

      return response.data
    } catch (error: any) {
      logger.error('NowPayments create payment error:', error.response?.data || error.message)
      throw new Error(`Failed to create payment: ${error.response?.data?.message || error.message}`)
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response = await axios.get(`${API_URL}/payment/${paymentId}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })

      return response.data
    } catch (error: any) {
      logger.error('NowPayments get payment status error:', error.response?.data || error.message)
      throw new Error(`Failed to get payment status: ${error.response?.data?.message || error.message}`)
    }
  }

  verifyIPNSignature(body: string, signature: string): boolean {
    try {
      const hmac = crypto.createHmac('sha512', IPN_SECRET)
      hmac.update(body)
      const calculatedSignature = hmac.digest('hex')
      return calculatedSignature === signature
    } catch (error) {
      logger.error('IPN signature verification error:', error)
      return false
    }
  }

  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/currencies`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })
      return response.data.currencies || []
    } catch (error: any) {
      logger.error('NowPayments get currencies error:', error.response?.data || error.message)
      return []
    }
  }
}
```

### Step 5: Create Payment Routes

Add to `volspike-nodejs-backend/src/routes/payments.ts`:

```typescript
import { NowPaymentsService } from '../services/nowpayments'

// ... existing code ...

// Create NowPayments checkout
payments.post('/nowpayments/checkout', async (c) => {
  try {
    const user = requireUser(c)
    const body = await c.req.json()
    const { tier, successUrl, cancelUrl } = z.object({
      tier: z.enum(['pro', 'elite']),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }).parse(body)

    // Determine price based on tier
    const tierPrices: Record<string, number> = {
      pro: 9.0,
      elite: 49.0,
    }
    const priceAmount = tierPrices[tier] || 9.0

    // Generate unique order ID
    const orderId = `volspike-${user.id}-${Date.now()}`

    // Create payment with NowPayments
    const nowpayments = NowPaymentsService.getInstance()
    const payment = await nowpayments.createPayment({
      price_amount: priceAmount,
      price_currency: 'usd',
      order_id: orderId,
      order_description: `VolSpike ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
      ipn_callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payments/nowpayments/webhook`,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Store payment in database
    await prisma.cryptoPayment.create({
      data: {
        userId: user.id,
        paymentId: payment.payment_id,
        paymentStatus: payment.payment_status,
        payAmount: payment.price_amount,
        payCurrency: payment.price_currency,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        purchaseId: payment.purchase_id,
        tier: tier,
        invoiceId: payment.invoice_id,
        orderId: payment.order_id,
        paymentUrl: payment.pay_url,
      },
    })

    logger.info(`NowPayments checkout created for ${user.email}`, {
      paymentId: payment.payment_id,
      tier,
    })

    return c.json({
      paymentId: payment.payment_id,
      paymentUrl: payment.pay_url,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      priceAmount: payment.price_amount,
      priceCurrency: payment.price_currency,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('NowPayments checkout error:', message)
    if (message.includes('User not authenticated')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return c.json({ error: 'Failed to create checkout session' }, 500)
  }
})

// NowPayments webhook handler
payments.post('/nowpayments/webhook', async (c) => {
  try {
    const body = await c.req.text()
    const signature = c.req.header('x-nowpayments-sig')

    if (!signature) {
      logger.warn('NowPayments webhook missing signature')
      return c.json({ error: 'Missing signature' }, 400)
    }

    // Verify signature
    const nowpayments = NowPaymentsService.getInstance()
    if (!nowpayments.verifyIPNSignature(body, signature)) {
      logger.error('NowPayments webhook signature verification failed')
      return c.json({ error: 'Invalid signature' }, 400)
    }

    const data = JSON.parse(body)
    const { payment_id, payment_status } = data

    logger.info('NowPayments webhook received', {
      paymentId: payment_id,
      paymentStatus: payment_status,
    })

    // Find payment in database
    const cryptoPayment = await prisma.cryptoPayment.findUnique({
      where: { paymentId: payment_id },
      include: { user: true },
    })

    if (!cryptoPayment) {
      logger.warn(`Crypto payment not found: ${payment_id}`)
      return c.json({ error: 'Payment not found' }, 404)
    }

    // Update payment status
    await prisma.cryptoPayment.update({
      where: { paymentId: payment_id },
      data: {
        paymentStatus: payment_status,
        actuallyPaid: data.actually_paid,
        actuallyPaidCurrency: data.actually_paid_currency,
        updatedAt: new Date(),
        ...(payment_status === 'finished' && { paidAt: new Date() }),
      },
    })

    // Handle successful payment
    if (payment_status === 'finished') {
      // Update user tier
      await prisma.user.update({
        where: { id: cryptoPayment.userId },
        data: { tier: cryptoPayment.tier },
      })

      // Send email notification
      const emailService = EmailService.getInstance()
      if (cryptoPayment.user.email) {
        await emailService.sendTierUpgradeEmail({
          email: cryptoPayment.user.email,
          name: undefined,
          newTier: cryptoPayment.tier,
          previousTier: cryptoPayment.user.tier,
        }).catch((error) => {
          logger.error('Failed to send tier upgrade email:', error)
        })
      }

      // Broadcast tier change via WebSocket
      if (io) {
        io.to(`user-${cryptoPayment.userId}`).emit('tier-changed', { tier: cryptoPayment.tier })
      }

      logger.info(`User ${cryptoPayment.userId} upgraded to ${cryptoPayment.tier} via crypto payment`)
    }

    return c.json({ received: true })
  } catch (error) {
    logger.error('NowPayments webhook error:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Get payment status
payments.get('/nowpayments/status/:paymentId', async (c) => {
  try {
    const user = requireUser(c)
    const paymentId = c.req.param('paymentId')

    const cryptoPayment = await prisma.cryptoPayment.findFirst({
      where: {
        paymentId,
        userId: user.id,
      },
    })

    if (!cryptoPayment) {
      return c.json({ error: 'Payment not found' }, 404)
    }

    // Optionally refresh from NowPayments API
    const nowpayments = NowPaymentsService.getInstance()
    const paymentStatus = await nowpayments.getPaymentStatus(paymentId)

    // Update database
    await prisma.cryptoPayment.update({
      where: { id: cryptoPayment.id },
      data: {
        paymentStatus: paymentStatus.payment_status,
        actuallyPaid: paymentStatus.actually_paid,
        actuallyPaidCurrency: paymentStatus.actually_paid_currency,
        updatedAt: new Date(),
        ...(paymentStatus.payment_status === 'finished' && { paidAt: new Date() }),
      },
    })

    return c.json({
      paymentId: cryptoPayment.paymentId,
      status: paymentStatus.payment_status,
      payAmount: cryptoPayment.payAmount,
      payCurrency: cryptoPayment.payCurrency,
      actuallyPaid: paymentStatus.actually_paid,
      actuallyPaidCurrency: paymentStatus.actually_paid_currency,
    })
  } catch (error) {
    logger.error('Get payment status error:', error)
    return c.json({ error: 'Failed to get payment status' }, 500)
  }
})
```

---

## Frontend Integration

### Step 1: Environment Variables

Add to `volspike-nextjs-frontend/.env.local`:

```bash
NEXT_PUBLIC_NOWPAYMENTS_ENABLED=true
```

### Step 2: Create Payment Library Functions

Add to `volspike-nextjs-frontend/src/lib/payments.ts`:

```typescript
// ... existing Stripe functions ...

export async function startCryptoCheckout(
  session: Session | null,
  tier: 'pro' | 'elite'
): Promise<{ paymentUrl: string; paymentId: string }> {
  if (!session?.user) {
    throw new Error('You must be signed in to upgrade.')
  }

  const successUrl = `${window.location.origin}/checkout/success?payment=crypto&tier=${tier}`
  const cancelUrl = `${window.location.origin}/checkout/cancel`

  const authToken = (session as any)?.accessToken || session.user.id

  if (!authToken) {
    throw new Error('Authentication token not available. Please sign in again.')
  }

  const resp = await fetch(`${API_URL}/api/payments/nowpayments/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      tier,
      successUrl,
      cancelUrl,
    }),
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(data?.error || `Checkout failed (HTTP ${resp.status})`)
  }

  const data = await resp.json()
  return {
    paymentUrl: data.paymentUrl,
    paymentId: data.paymentId,
  }
}
```

### Step 3: Create Payment Method Selector Component

Create `volspike-nextjs-frontend/src/components/payment-method-selector.tsx`:

```typescript
'use client'

import { CreditCard, Coins } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaymentMethodSelectorProps {
  selectedMethod: 'stripe' | 'crypto'
  onMethodChange: (method: 'stripe' | 'crypto') => void
  className?: string
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  className,
}: PaymentMethodSelectorProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold">Choose Payment Method</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={cn(
            'cursor-pointer transition-all',
            selectedMethod === 'stripe'
              ? 'ring-2 ring-brand-500 bg-brand-500/5'
              : 'hover:border-brand-500/50'
          )}
          onClick={() => onMethodChange('stripe')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-500/10">
                <CreditCard className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Credit Card</CardTitle>
                <CardDescription className="text-xs">
                  Visa, MasterCard, Amex
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-all',
            selectedMethod === 'crypto'
              ? 'ring-2 ring-brand-500 bg-brand-500/5'
              : 'hover:border-brand-500/50'
          )}
          onClick={() => onMethodChange('crypto')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sec-500/10">
                <Coins className="h-5 w-5 text-sec-600 dark:text-sec-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Cryptocurrency</CardTitle>
                <CardDescription className="text-xs">
                  BTC, ETH, USDT & more
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
```

### Step 4: Create Crypto Checkout Page

Create `volspike-nextjs-frontend/src/app/checkout/crypto/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { startCryptoCheckout } from '@/lib/payments'
import { toast } from 'react-hot-toast'

export default function CryptoCheckoutPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tier = (searchParams.get('tier') || 'pro') as 'pro' | 'elite'
  
  const [isLoading, setIsLoading] = useState(true)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth')
      return
    }

    const createPayment = async () => {
      try {
        setIsLoading(true)
        const result = await startCryptoCheckout(session, tier)
        setPaymentUrl(result.paymentUrl)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create payment'
        setError(message)
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }

    createPayment()
  }, [session, tier, router])

  const handleOpenPayment = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-4" />
              <p className="text-muted-foreground">Preparing your payment...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Payment Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/pricing')}>
                Back to Pricing
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Crypto Payment</CardTitle>
            <CardDescription>
              You'll be redirected to complete your {tier.charAt(0).toUpperCase() + tier.slice(1)} tier payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>What happens next:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>You'll be redirected to NowPayments secure payment page</li>
                <li>Choose your preferred cryptocurrency</li>
                <li>Complete the payment using your wallet</li>
                <li>You'll be redirected back once payment is confirmed</li>
              </ul>
            </div>

            <Button
              onClick={handleOpenPayment}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Continue to Payment
            </Button>

            <Button
              onClick={() => router.push('/pricing')}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

### Step 5: Update Pricing Tiers Component

Modify `volspike-nextjs-frontend/src/components/pricing-tiers.tsx` to include payment method selection:

```typescript
// Add state for payment method
const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crypto'>('stripe')

// Import PaymentMethodSelector
import { PaymentMethodSelector } from '@/components/payment-method-selector'

// Update handleTierAction to handle crypto payments
const handleTierAction = async (tierName: string, isComingSoon: boolean, isCurrent: boolean) => {
  if (isComingSoon || isCurrent) return
  
  if (tierName === 'Free') {
    router.push('/auth')
  } else if (tierName === 'Pro' || tierName === 'Elite') {
    const tier = tierName.toLowerCase() as 'pro' | 'elite'
    
    if (paymentMethod === 'crypto') {
      router.push(`/checkout/crypto?tier=${tier}`)
    } else {
      // Existing Stripe flow
      try {
        await startProCheckout(session || null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start checkout'
        toast.error(message)
        router.push('/settings?tab=subscription')
      }
    }
  }
}

// Add PaymentMethodSelector before the tier cards
{!session && (
  <PaymentMethodSelector
    selectedMethod={paymentMethod}
    onMethodChange={setPaymentMethod}
    className="mb-8"
  />
)}
```

### Step 6: Update Checkout Success Page

Modify `volspike-nextjs-frontend/src/components/checkout-success-content.tsx` to handle crypto payments:

```typescript
// Check URL params for payment type
const searchParams = useSearchParams()
const paymentType = searchParams.get('payment') // 'crypto' or null

// Update success message
{paymentType === 'crypto' && (
  <div className="mb-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
    <p className="text-sm text-emerald-700 dark:text-emerald-400">
      Your cryptocurrency payment is being processed. Your tier will be upgraded once the payment is confirmed on the blockchain.
    </p>
  </div>
)}
```

---

## Testing

### Sandbox Testing

1. **Set Sandbox Mode**: Ensure `NOWPAYMENTS_SANDBOX_MODE=true` in backend `.env`
2. **Test Payment Flow**:
   - Navigate to `/pricing`
   - Select "Cryptocurrency" payment method
   - Click "Upgrade to Pro"
   - Complete test payment on NowPayments sandbox
   - Verify webhook receives payment confirmation
   - Check user tier is updated in database

### Test Scenarios

- ✅ Successful payment → User tier upgraded
- ✅ Payment cancellation → User stays on current tier
- ✅ Payment failure → Error message displayed
- ✅ Webhook verification → Signature validation works
- ✅ Payment status polling → Status updates correctly

---

## Production Deployment

### Step 1: Update Environment Variables

**Backend (Railway/Vercel)**:
```bash
NOWPAYMENTS_API_KEY=your-production-api-key
NOWPAYMENTS_IPN_SECRET=your-production-ipn-secret
NOWPAYMENTS_SANDBOX_MODE=false
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1
```

**Frontend (Vercel)**:
```bash
NEXT_PUBLIC_NOWPAYMENTS_ENABLED=true
```

### Step 2: Configure NowPayments IPN URL

1. Go to NowPayments Dashboard > IPN Settings
2. Set IPN URL to: `https://your-backend-domain.com/api/payments/nowpayments/webhook`
3. Enable IPN notifications

### Step 3: Deploy Database Migration

```bash
cd volspike-nodejs-backend
npx prisma db push
```

### Step 4: Monitor First Payments

- Watch backend logs for webhook events
- Verify payments appear in NowPayments dashboard
- Confirm user tier upgrades work correctly

---

## Troubleshooting

### Common Issues

**Webhook Not Receiving Events**
- Check IPN URL is correctly configured in NowPayments dashboard
- Verify webhook endpoint is publicly accessible
- Check backend logs for incoming requests
- Verify IPN secret matches in both places

**Payment Status Not Updating**
- Check payment status polling endpoint
- Verify database updates are working
- Check NowPayments API response format

**Signature Verification Failing**
- Ensure IPN secret matches exactly
- Check request body is not modified before verification
- Verify HMAC-SHA512 algorithm is used correctly

**User Tier Not Upgrading**
- Check webhook handler logs
- Verify payment status is 'finished'
- Check database for payment record
- Verify user ID matches payment user ID

---

## Security Considerations

1. **API Key Security**: Never commit API keys to git
2. **IPN Verification**: Always verify webhook signatures
3. **Rate Limiting**: Implement rate limiting on payment endpoints
4. **Input Validation**: Validate all user inputs with Zod schemas
5. **Error Handling**: Don't expose sensitive error details to clients

---

## Support

For NowPayments-specific issues:
- Documentation: https://nowpayments.io/docs
- Support: support@nowpayments.io
- Status Page: https://status.nowpayments.io

For VolSpike integration issues:
- Check backend logs: `volspike-nodejs-backend/backend.log`
- Review webhook events in NowPayments dashboard
- Check database for payment records

---

## Next Steps

After successful integration:

1. ✅ Monitor payment success rates
2. ✅ Track user adoption of crypto payments
3. ✅ Optimize payment flow based on user feedback
4. ✅ Consider adding more cryptocurrency options
5. ✅ Implement payment status notifications

---

**Last Updated**: December 2025
**Integration Version**: 1.0.0

