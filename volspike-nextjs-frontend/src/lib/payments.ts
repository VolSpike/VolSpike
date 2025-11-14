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

  console.log('[startCryptoCheckout] Starting crypto checkout', {
    tier,
    API_URL,
    userId: session.user.id,
    email: session.user.email,
    hasAuthToken: !!authToken,
    authTokenLength: authToken?.toString().length,
    successUrl,
    cancelUrl,
  })

  let resp: Response
  try {
    resp = await fetch(`${API_URL}/api/payments/nowpayments/checkout`, {
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

    console.log('[startCryptoCheckout] Response received', {
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      headers: Object.fromEntries(resp.headers.entries()),
    })
  } catch (fetchError) {
    console.error('[startCryptoCheckout] Fetch error (network/connection)', {
      error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      API_URL,
      stack: fetchError instanceof Error ? fetchError.stack : undefined,
    })
    throw new Error(`Network error: Cannot connect to payment server. Please check your connection and try again.`)
  }

  let responseData: any
  try {
    const responseText = await resp.text()
    console.log('[startCryptoCheckout] Response body (raw)', {
      text: responseText.substring(0, 500), // First 500 chars
      length: responseText.length,
    })
    
    try {
      responseData = JSON.parse(responseText)
      console.log('[startCryptoCheckout] Response body (parsed)', responseData)
    } catch (parseError) {
      console.error('[startCryptoCheckout] Failed to parse JSON response', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 500),
      })
      throw new Error(`Invalid server response: ${responseText.substring(0, 100)}`)
    }
  } catch (readError) {
    console.error('[startCryptoCheckout] Error reading response', {
      error: readError instanceof Error ? readError.message : String(readError),
    })
    throw readError instanceof Error ? readError : new Error('Failed to read server response')
  }

  if (!resp.ok) {
    const errorMessage = responseData?.error || responseData?.details || responseData?.message || `Checkout failed (HTTP ${resp.status})`
    console.error('[startCryptoCheckout] Checkout failed - FULL ERROR DETAILS', {
      status: resp.status,
      statusText: resp.statusText,
      responseData,
      error: responseData?.error,
      details: responseData?.details,
      message: responseData?.message,
      errorMessage,
    })
    
    // Provide more helpful error messages
    if (resp.status === 401) {
      throw new Error('Authentication failed. Please sign in again.')
    } else if (resp.status === 500 && responseData?.details) {
      throw new Error(responseData.details)
    } else {
      throw new Error(errorMessage)
    }
  }

  // Validate response has required fields
  if (!responseData.paymentId) {
    console.error('[startCryptoCheckout] No payment ID returned', {
      responseData,
    })
    throw new Error('Payment ID not returned from server. Please check server logs.')
  }
  
  if (!responseData.paymentUrl) {
    console.error('[startCryptoCheckout] No payment URL returned - FULL RESPONSE:', {
      responseData,
      hasPaymentId: !!responseData.paymentId,
      hasPaymentUrl: !!responseData.paymentUrl,
      keys: Object.keys(responseData),
      fullResponse: JSON.stringify(responseData, null, 2),
    })
    
    // Try to construct payment URL from payment ID as fallback
    if (responseData.paymentId) {
      const fallbackUrl = `https://nowpayments.io/payment/?iid=${responseData.paymentId}`
      console.warn('[startCryptoCheckout] Using fallback payment URL', {
        paymentId: responseData.paymentId,
        fallbackUrl,
      })
      return {
        paymentUrl: fallbackUrl,
        paymentId: responseData.paymentId,
      }
    }
    
    throw new Error('Payment URL not returned from server. Please check server logs.')
  }

  console.log('[startCryptoCheckout] Success!', {
    paymentId: responseData.paymentId,
    paymentUrl: responseData.paymentUrl,
    payAddress: responseData.payAddress,
  })

  return {
    paymentUrl: responseData.paymentUrl,
    paymentId: responseData.paymentId,
  }
}
