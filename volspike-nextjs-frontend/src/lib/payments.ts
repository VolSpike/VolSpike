'use client'

import { Session } from 'next-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID

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

    const authToken = (session as any)?.accessToken || session.user.id

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


