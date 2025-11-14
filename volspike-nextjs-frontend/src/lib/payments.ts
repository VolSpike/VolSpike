'use client'

import { Session } from 'next-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
const TEST_ONETIME_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID

type CreateCheckoutResponse = {
    sessionId?: string
    url?: string
    error?: string
}

export async function startProCheckout(session: Session | null): Promise<void> {
    if (!session?.user) {
        throw new Error('You must be signed in to upgrade.')
    }
    if (!PRO_PRICE_ID) {
        throw new Error('Stripe Price ID (NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) is not configured.')
    }

    const successUrl = `${window.location.origin}/checkout/success`
    const cancelUrl = `${window.location.origin}/checkout/cancel`

    // Get auth token - prefer accessToken, fallback to user.id
    const authToken = (session as any)?.accessToken || session.user.id
    
    if (!authToken) {
        console.error('[startProCheckout] No auth token available', { 
            hasAccessToken: !!(session as any)?.accessToken,
            hasUserId: !!session.user.id,
            sessionKeys: Object.keys(session)
        })
        throw new Error('Authentication token not available. Please sign in again.')
    }

    console.log('[startProCheckout] Starting checkout', {
        hasToken: !!authToken,
        tokenLength: authToken?.toString().length,
        userId: session.user.id,
        email: session.user.email
    })

    const resp = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            priceId: PRO_PRICE_ID,
            successUrl,
            cancelUrl,
        }),
    })

    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const message = data?.error || `Checkout failed (HTTP ${resp.status})`
        console.error('[startProCheckout] Checkout failed', {
            status: resp.status,
            statusText: resp.statusText,
            error: data?.error,
            message
        })
        throw new Error(message)
    }

    const data: CreateCheckoutResponse = await resp.json()

    // Prefer redirect URL from backend if present
    if (data.url) {
        window.location.href = data.url
        return
    }

    throw new Error('Checkout session URL not returned.')
}

// One-time test payment ($1) - for testing only
export async function startOneTimeTestPayment(session: Session | null, priceId?: string): Promise<void> {
    if (!session?.user) {
        throw new Error('You must be signed in to make a payment.')
    }
    
    const oneTimePriceId = priceId || TEST_ONETIME_PRICE_ID
    if (!oneTimePriceId) {
        throw new Error('One-time payment Price ID is not configured. Please provide priceId parameter or set NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID.')
    }

    const successUrl = `${window.location.origin}/checkout/success`
    const cancelUrl = `${window.location.origin}/checkout/cancel`

    // Get auth token - prefer accessToken, fallback to user.id
    const authToken = (session as any)?.accessToken || session.user.id
    
    if (!authToken) {
        console.error('[startOneTimeTestPayment] No auth token available')
        throw new Error('Authentication token not available. Please sign in again.')
    }

    console.log('[startOneTimeTestPayment] Starting one-time payment checkout', {
        priceId: oneTimePriceId,
        userId: session.user.id,
        email: session.user.email
    })

    const resp = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            priceId: oneTimePriceId,
            successUrl,
            cancelUrl,
            mode: 'payment', // One-time payment, not subscription
        }),
    })

    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const message = data?.error || `Payment failed (HTTP ${resp.status})`
        console.error('[startOneTimeTestPayment] Payment failed', {
            status: resp.status,
            statusText: resp.statusText,
            error: data?.error,
            message
        })
        throw new Error(message)
    }

    const data: CreateCheckoutResponse = await resp.json()

    if (data.url) {
        window.location.href = data.url
        return
    }

    throw new Error('Checkout session URL not returned.')
}

// NowPayments crypto checkout
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
