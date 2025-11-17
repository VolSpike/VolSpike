'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Copy, Check, AlertCircle, ExternalLink, QrCode, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'
import { PaymentProgress } from '@/components/payment-progress'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PaymentDetails {
  paymentId: string
  payAddress: string
  payAmount: number
  payCurrency: string
  priceAmount: number
  priceCurrency: string
  paymentStatus: string
  orderId: string
  tier: string
}

export default function CryptoPaymentPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('paymentId')
  const debugMode = process.env.NODE_ENV === 'development' || searchParams.get('debug') === 'true'

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const safeNavigate = useCallback(
    (href: string, source: string) => {
      const isDebug =
        process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('debugNav') === 'true')

      const beforeHref =
        typeof window !== 'undefined' ? window.location.href : null

      if (isDebug) {
        console.log('[CryptoPaymentPage] safeNavigate start', {
          href,
          source,
          beforeHref,
        })
      }

      try {
        router.push(href)
      } catch (error) {
        if (isDebug) {
          console.error('[CryptoPaymentPage] safeNavigate router.push error', {
            href,
            source,
            error,
          })
        }
        if (typeof window !== 'undefined') {
          window.location.href = href
        }
        return
      }

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          const afterHref = window.location.href
          if (beforeHref && afterHref === beforeHref) {
            if (isDebug) {
              console.warn('[CryptoPaymentPage] safeNavigate fallback triggered', {
                href,
                source,
                beforeHref,
                afterHref,
              })
            }
            window.location.href = href
          }
        }, 700)
      }
    },
    [router]
  )

  // Debug: Log page structure on mount
  useEffect(() => {
    if (debugMode) {
      const logDebugInfo = () => {
        const header = document.querySelector('header')
        const footer = document.querySelector('footer')
        const main = document.querySelector('main')
        
        console.log('🔍 [CryptoPaymentPage] Page structure debug:', {
          header: header ? {
            element: header,
            zIndex: window.getComputedStyle(header).zIndex,
            pointerEvents: window.getComputedStyle(header).pointerEvents,
            position: window.getComputedStyle(header).position,
          } : null,
          footer: footer ? {
            element: footer,
            zIndex: window.getComputedStyle(footer).zIndex,
            pointerEvents: window.getComputedStyle(footer).pointerEvents,
            position: window.getComputedStyle(footer).position,
          } : null,
          main: main ? {
            element: main,
            zIndex: window.getComputedStyle(main).zIndex,
          } : null,
          headerLinks: Array.from(document.querySelectorAll('header a')).map(a => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent?.trim(),
            pointerEvents: window.getComputedStyle(a).pointerEvents,
            zIndex: window.getComputedStyle(a).zIndex,
          })),
          footerLinks: Array.from(document.querySelectorAll('footer a')).map(a => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent?.trim(),
            pointerEvents: window.getComputedStyle(a).pointerEvents,
            zIndex: window.getComputedStyle(a).zIndex,
          })),
        })
      }
      
      // Log immediately and after a short delay (to catch async rendering)
      logDebugInfo()
      setTimeout(logDebugInfo, 1000)

      setTimeout(() => {
        const headerLink = document.querySelector('header nav a[href="/pricing"]') as HTMLElement | null
        if (headerLink) {
          const rect = headerLink.getBoundingClientRect()
          const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          console.log('🔍 [Debug] Header Pricing elementFromPoint:', {
            target: el,
            targetTag: el?.tagName,
            targetClasses: el?.className,
            targetZIndex: el ? window.getComputedStyle(el).zIndex : null,
            headerRect: rect,
            headerPointerEvents: window.getComputedStyle(headerLink).pointerEvents,
          })
        }

        const footerLink = document.querySelector('footer a[href="/legal/privacy"]') as HTMLElement | null
        if (footerLink) {
          const rect = footerLink.getBoundingClientRect()
          const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          console.log('🔍 [Debug] Footer Privacy elementFromPoint:', {
            target: el,
            targetTag: el?.tagName,
            targetClasses: el?.className,
            targetZIndex: el ? window.getComputedStyle(el).zIndex : null,
            footerRect: rect,
            footerPointerEvents: window.getComputedStyle(footerLink).pointerEvents,
          })
        }
      }, 1500)
    }
  }, [debugMode])

  // Generate Solana Pay URI (standard format that Phantom recognizes)
  // Solana Pay spec: solana:<address>?amount=<decimal>&spl-token=<mint>&label=<label>&message=<message>
  // IMPORTANT: Phantom's QR scanner expects the solana: URI with DECIMAL amounts (not lamports)
  const { solanaUri, phantomDeepLink, phantomUniversalLink } = useMemo(() => {
    if (!paymentDetails?.payAddress || !paymentDetails?.payAmount) {
      return { solanaUri: null, phantomDeepLink: null, phantomUniversalLink: null }
    }

    try {
      const currency = paymentDetails.payCurrency?.toLowerCase() || ''
      const isSOL = currency === 'sol'
      const isUSDT = currency.includes('usdt')
      const isUSDC = currency.includes('usdc')

      // SPL Token mint addresses (Solana mainnet)
      const SPL_TOKEN_MINTS: Record<string, string> = {
        'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
        'usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
      }

      // Amount for Solana Pay URI – DECIMAL string in token units
      // We keep a conservative number of decimals to avoid floating‑point artefacts
      let amountDecimal: string
      let splTokenMint: string | null = null

      if (isSOL) {
        // SOL: up to 9 decimals
        amountDecimal = paymentDetails.payAmount.toFixed(9)
      } else if (isUSDT) {
        // USDT: 6 decimals
        amountDecimal = paymentDetails.payAmount.toFixed(6)
        splTokenMint = SPL_TOKEN_MINTS.usdt
      } else if (isUSDC) {
        // USDC: 6 decimals
        amountDecimal = paymentDetails.payAmount.toFixed(6)
        splTokenMint = SPL_TOKEN_MINTS.usdc
      } else {
        // For other tokens, use raw decimal string
        amountDecimal = paymentDetails.payAmount.toString()
      }

      // Build Solana Pay URI (standard format - Phantom recognizes this)
      // IMPORTANT: iOS camera scanner works best with solana: URI format
      // This is the preferred format for QR codes as it's universally supported
      const params = new URLSearchParams()
      
      // Decimal amount in token units
      params.set('amount', amountDecimal)
      
      // SPL token mint address (required for tokens, not for SOL)
      if (splTokenMint && !isSOL) {
        params.set('spl-token', splTokenMint)
      }
      
      // Optional metadata (helps with UX)
      params.set('label', 'VolSpike Payment')
      params.set('message', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)
      
      // Reference for tracking (optional)
      if (paymentDetails.orderId) {
        params.set('reference', paymentDetails.orderId)
      }

      const solanaPayUri = `solana:${paymentDetails.payAddress}?${params.toString()}`
      
      // Phantom universal link (for button clicks - ensures Phantom opens directly)
      // Format: https://phantom.app/ul/v1/send?recipient=<address>&amount=<decimal>&token=<mint>
      // NOTE: Changed from /transfer to /send per Phantom's latest API
      // Use decimal amounts for Phantom universal links (Phantom handles conversion)
      const phantomParams = new URLSearchParams()
      phantomParams.set('recipient', paymentDetails.payAddress)
      phantomParams.set('amount', amountDecimal) // Use the same decimal format as Solana Pay
      if (splTokenMint && !isSOL) {
        phantomParams.set('token', splTokenMint)
      }
      
      // Universal link (for button clicks - opens Phantom app directly)
      const phantomUniversalLinkUri = `https://phantom.app/ul/v1/send?${phantomParams.toString()}`
      // Deep link (fallback for direct button clicks)
      const phantomDeepLinkUri = phantomUniversalLinkUri.replace('https://phantom.app/ul/', 'phantom://ul/')
      
      // Comprehensive debug logging
      console.log('[CryptoPaymentPage] Generated Payment URIs:', {
        payAddress: paymentDetails.payAddress,
        payAmount: paymentDetails.payAmount,
        payCurrency: paymentDetails.payCurrency,
        isSOL,
        isUSDT,
        isUSDC,
        amountDecimal,
        splTokenMint,
        solanaPayUri: {
          uri: solanaPayUri,
          length: solanaPayUri.length,
          preview: solanaPayUri.substring(0, 80) + '...',
          params: Object.fromEntries(params),
          recommendedFor: 'QR codes (iOS camera scanner)',
        },
        phantomUniversalLinkUri: {
          uri: phantomUniversalLinkUri,
          length: phantomUniversalLinkUri.length,
          preview: phantomUniversalLinkUri.substring(0, 80) + '...',
          params: Object.fromEntries(phantomParams),
          recommendedFor: 'Button clicks (direct app opening)',
        },
        phantomDeepLinkUri: {
          uri: phantomDeepLinkUri,
          recommendedFor: 'Fallback button clicks',
        },
        // Verify format matches Solana Pay spec
        matchesSpec: {
          hasAddress: !!paymentDetails.payAddress,
          hasAmount: !!amountDecimal,
          hasSplToken: !isSOL && !!splTokenMint,
          amountFormat: 'decimal',
          solanaPayUriValid: solanaPayUri.startsWith('solana:'),
          phantomLinkValid: phantomUniversalLinkUri.startsWith('https://phantom.app/ul/v1/send'),
        },
      })

      return {
        solanaUri: solanaPayUri,
        phantomDeepLink: phantomDeepLinkUri,
        phantomUniversalLink: phantomUniversalLinkUri,
      }
    } catch (error) {
      console.error('[CryptoPaymentPage] Error generating payment URIs:', error)
      return { solanaUri: null, phantomDeepLink: null, phantomUniversalLink: null }
    }
  }, [paymentDetails])

  // Generate QR code using Solana Pay URI (best for iOS camera scanner)
  // iOS camera scanner handles solana: URI format better than Phantom universal links
  // The solana: URI will open Phantom if installed, otherwise prompts user to install
  useEffect(() => {
    // Prioritize Solana Pay URI for QR codes - iOS camera scanner works best with this format
    // Phantom universal links are better for button clicks, but QR codes should use solana: URI
    const uriForQR = solanaUri || phantomUniversalLink
    
    if (!uriForQR) {
      console.warn('[CryptoPaymentPage] No URI available for QR code generation', {
        hasSolanaUri: !!solanaUri,
        hasPhantomLink: !!phantomUniversalLink,
        paymentDetails: paymentDetails ? {
          hasAddress: !!paymentDetails.payAddress,
          hasAmount: !!paymentDetails.payAmount,
          currency: paymentDetails.payCurrency,
        } : null,
      })
      return
    }

    const usingSolanaPayUri = !!solanaUri
    console.log('[CryptoPaymentPage] Generating QR code', {
      usingSolanaPayUri,
      usingPhantomUniversalLink: !usingSolanaPayUri,
      uri: uriForQR,
      uriLength: uriForQR.length,
      uriPreview: uriForQR.substring(0, 100) + '...',
      fullUri: uriForQR,
      // Show what will happen when scanned
      expectedBehavior: usingSolanaPayUri 
        ? 'iOS camera scanner will recognize solana: URI and open Phantom with prepopulated transaction' 
        : 'Will open Phantom app directly via universal link (fallback)',
      recommendation: usingSolanaPayUri 
        ? '✅ Using Solana Pay URI - best for iOS camera scanning' 
        : '⚠️ Using Phantom universal link - may not work as well with iOS camera scanner',
    })

    QRCode.toDataURL(uriForQR, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M', // Medium error correction for better scanning
    })
      .then((url) => {
        console.log('[CryptoPaymentPage] QR code generated successfully', {
          uriLength: uriForQR.length,
          qrCodeSize: url.length,
          uriType: usingSolanaPayUri ? 'solana-pay' : 'phantom-universal-link',
          encodedUri: uriForQR,
          usingSolanaPayUri,
          // Parse and log the URI structure for debugging
          parsedUri: usingSolanaPayUri ? {
            scheme: 'solana',
            address: paymentDetails?.payAddress,
            params: Object.fromEntries(new URLSearchParams(uriForQR.split('?')[1] || '')),
          } : {
            scheme: 'https',
            domain: 'phantom.app',
            path: '/ul/v1/send',
            params: Object.fromEntries(new URLSearchParams(uriForQR.split('?')[1] || '')),
          },
          // iOS compatibility check
          iosCompatibility: usingSolanaPayUri 
            ? '✅ Excellent - iOS camera scanner natively supports solana: URI scheme'
            : '⚠️ Good - Universal link may work but solana: URI is preferred',
        })
        setQrCodeDataUrl(url)
      })
      .catch((err) => {
        console.error('[CryptoPaymentPage] QR code generation error:', {
          error: err,
          uri: uriForQR,
          uriLength: uriForQR.length,
          stack: err instanceof Error ? err.stack : undefined,
        })
        toast.error('Failed to generate QR code')
      })
  }, [phantomUniversalLink, solanaUri, paymentDetails])

  // Fetch payment details
  useEffect(() => {
    if (!session?.user || !paymentId) {
      if (!session?.user) {
        router.push('/auth')
      }
      return
    }

    const fetchPaymentDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const authToken = (session as any)?.accessToken || session.user.id
        const response = await fetch(`${API_URL}/api/payments/nowpayments/payment/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `Failed to fetch payment details (${response.status})`)
        }

        const data = await response.json()
        setPaymentDetails(data)

        // Set timer (15 minutes)
        setTimeRemaining(15 * 60)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load payment details'
        console.error('[CryptoPaymentPage] Error:', err)
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentDetails()
  }, [session, paymentId, router])

  // Countdown timer with expiration handling
  useEffect(() => {
    if (timeRemaining === null) return

    if (timeRemaining <= 0) {
      if (!isExpired) {
        setIsExpired(true)
        // Check payment status one more time when timer expires
        if (paymentDetails && session?.user && paymentId) {
          const checkExpiredPayment = async () => {
            try {
              const authToken = (session as any)?.accessToken || session.user.id
              const response = await fetch(`${API_URL}/api/payments/nowpayments/payment/${paymentId}`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              })

              if (response.ok) {
                const data = await response.json()
                // If payment was completed, update state (don't show expired message)
                if (data.paymentStatus === 'finished') {
                  setIsExpired(false)
                  setPaymentDetails((prev) => prev ? { ...prev, ...data } : null)
                  setTimeout(() => {
                    router.push(`/checkout/success?payment=crypto&tier=${paymentDetails?.tier}`)
                  }, 2000)
                  return
                }
              }
            } catch (err) {
              console.error('[CryptoPaymentPage] Error checking expired payment:', err)
            }
            
            // Show expiration toast
            toast.error('Payment window expired. Please create a new payment.', {
              duration: 5000,
            })
          }
          checkExpiredPayment()
        }
      }
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, isExpired, paymentDetails, session, paymentId, router])

  // Poll payment status (every 10 seconds)
  useEffect(() => {
    if (!paymentDetails || !session?.user || polling) return

    // Only poll if payment is not finished
    if (paymentDetails.paymentStatus === 'finished' || paymentDetails.paymentStatus === 'failed') {
      return
    }

    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const authToken = (session as any)?.accessToken || session.user.id
        const response = await fetch(`${API_URL}/api/payments/nowpayments/payment/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setPaymentDetails((prev) => prev ? { ...prev, ...data } : null)

          // If payment is finished, redirect to success page
          if (data.paymentStatus === 'finished') {
            setTimeout(() => {
              router.push(`/checkout/success?payment=crypto&tier=${paymentDetails.tier}`)
            }, 2000)
          }
        }
      } catch (err) {
        console.error('[CryptoPaymentPage] Polling error:', err)
        // Don't show error toast for polling failures
      }
    }, 10000) // Poll every 10 seconds

    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [paymentDetails, session, paymentId, router, polling])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const copyToClipboard = async (text: string, type: 'address' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success(`${type === 'address' ? 'Address' : 'Amount'} copied!`)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  const getCurrencyDisplayName = (currency: string): string => {
    const currencyMap: Record<string, string> = {
      'usdtsol': 'USDT',
      'usdterc20': 'USDT',
      'usdce': 'USDC',
      'sol': 'SOL',
      'btc': 'BTC',
      'eth': 'ETH',
    }
    return currencyMap[currency.toLowerCase()] || currency.toUpperCase()
  }

  const getNetworkName = (currency: string): string => {
    const normalized = currency.toLowerCase()
    if (normalized.includes('sol') || normalized === 'sol') {
      return 'Solana'
    }
    if (normalized.includes('erc20') || normalized.includes('eth') || normalized === 'eth') {
      return 'Ethereum'
    }
    if (normalized === 'btc') {
      return 'Bitcoin'
    }
    return 'Unknown'
  }

  const getFriendlyStatus = (status: string | undefined | null): { label: string; tone: 'default' | 'success' | 'warning' | 'danger' } => {
    if (!status) return { label: 'Waiting for payment', tone: 'default' }
    const normalized = status.toLowerCase()
    if (normalized === 'finished' || normalized === 'confirmed') {
      return { label: 'Payment confirmed on-chain', tone: 'success' }
    }
    if (normalized === 'failed' || normalized === 'expired' || normalized === 'refunded') {
      return { label: 'Payment could not be completed', tone: 'danger' }
    }
    if (normalized === 'confirming' || normalized === 'sending') {
      return { label: 'Waiting for blockchain confirmations', tone: 'warning' }
    }
    return { label: 'Waiting for payment', tone: 'default' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sec-600 dark:text-sec-400 mb-4" />
              <p className="text-muted-foreground">Loading payment details...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error || !paymentDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-5 w-5" />
                <CardTitle>Payment Error</CardTitle>
              </div>
              <CardDescription>{error || 'Payment not found'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/pricing')} className="w-full">
                Back to Pricing
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const currencyDisplay = getCurrencyDisplayName(paymentDetails.payCurrency)
  const networkName = getNetworkName(paymentDetails.payCurrency)
  const usdAmount = paymentDetails.priceAmount
  const friendlyStatus = getFriendlyStatus(paymentDetails.paymentStatus)

  return (
    <>
      {/* Diagnostic overlay - only in dev mode with debug param */}
      {debugMode && typeof window !== 'undefined' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '2px solid red',
          }}
          onClick={(e) => {
            const element = document.elementFromPoint(e.clientX, e.clientY)
            console.log('🔍 Click intercepted at:', {
              x: e.clientX,
              y: e.clientY,
              element,
              elementTag: element?.tagName,
              elementClasses: element?.className,
              elementZIndex: element ? window.getComputedStyle(element).zIndex : null,
              elementPointerEvents: element ? window.getComputedStyle(element).pointerEvents : null,
              allElementsAtPoint: document.elementsFromPoint(e.clientX, e.clientY),
            })
          }}
        >
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'red', color: 'white', padding: '10px', zIndex: 100000 }}>
            DEBUG MODE: Click anywhere to see what element receives the click
          </div>
        </div>
      )}
      <div className="min-h-screen bg-background relative">
        <Header />
        <main className="container mx-auto px-4 py-10 max-w-2xl relative z-0">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sec-500">
                Crypto checkout
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                Scan &amp; confirm in Phantom
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Open Phantom on your phone, scan the QR code, and confirm. We&apos;ll upgrade your tier automatically once the payment lands on‑chain.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
              <span className="font-medium">Live status</span>
            </div>
          </div>

          <PaymentProgress status={paymentDetails.paymentStatus} isExpired={isExpired} />

          <Card className="relative z-0 overflow-hidden border-border/70 bg-gradient-to-b from-background via-background/95 to-background">
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5 text-sec-500" />
                    <span>{networkName} · {currencyDisplay}</span>
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      Pay with Phantom
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Use your wallet&apos;s <span className="font-medium text-foreground">Scan</span> feature to send the exact amount below.
                    </CardDescription>
                  </div>
                </div>

                {timeRemaining !== null && (
                  <div className="flex flex-col items-end gap-2 text-right text-xs sm:text-sm font-mono">
                    {isExpired ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-destructive font-semibold">
                          Payment window expired
                        </span>
                      </div>
                    ) : timeRemaining > 0 ? (
                      <>
                        <div className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1',
                          timeRemaining < 300
                            ? 'border-destructive/40 bg-destructive/10'
                            : 'border-border/60 bg-muted/40'
                        )}>
                          <Clock className={cn(
                            'h-3.5 w-3.5',
                            timeRemaining < 300 ? 'text-destructive' : 'text-muted-foreground'
                          )} />
                          <span className={cn(
                            'font-semibold tracking-tight',
                            timeRemaining < 300 && 'text-destructive'
                          )}>
                            {formatTime(timeRemaining)} left
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Address refreshes after this timer for security.
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pb-6">
              {/* Amount & status row */}
              <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Amount to pay
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-3xl font-bold tabular-nums">
                      {paymentDetails.payAmount.toFixed(8)}{' '}
                      <span className="text-base font-semibold text-muted-foreground">
                        {currencyDisplay}
                      </span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(paymentDetails.payAmount.toString(), 'amount')}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'amount' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ≈ ${usdAmount.toFixed(2)} USD · {networkName} network
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 text-xs">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Payment status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-2 w-2 rounded-full',
                        friendlyStatus.tone === 'success' && 'bg-emerald-400',
                        friendlyStatus.tone === 'warning' && 'bg-amber-400',
                        friendlyStatus.tone === 'danger' && 'bg-destructive',
                        friendlyStatus.tone === 'default' && 'bg-sec-400'
                      )}
                    />
                    <span className="text-[13px] font-medium">
                      {friendlyStatus.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This page auto-updates. You can safely switch apps while waiting for confirmations.
                  </p>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative rounded-2xl border border-border/60 bg-background/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-sec-500/25 opacity-80 blur-sm" />
                    <div className="relative bg-white p-3 rounded-xl border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeDataUrl}
                        alt="Payment QR Code"
                        className="h-64 w-64"
                      />
                    </div>
                  </div>
                  <div className="text-center space-y-2 max-w-sm">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-2">How to scan:</p>
                      <div className="space-y-1.5 text-left">
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">1.</span>
                          <span>
                            <strong>iPhone:</strong> Open Camera app, point at QR code, tap the notification banner that appears.
                            <br />
                            <strong>Android:</strong> Open Phantom app, tap <span className="font-medium text-foreground">Scan</span>, point at QR code.
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">2.</span>
                          <span>
                            Phantom will open with the <span className="font-medium text-foreground">address and amount pre-filled</span>. Just review and confirm.
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">3.</span>
                          <span>
                            If another wallet opens instead, close it and use{' '}
                            <span className="font-medium text-foreground">&quot;Open in Phantom Wallet&quot;</span> button below.
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/30">
                      <p className="text-[11px] text-muted-foreground">
                        💡 <strong>Tip:</strong> On iPhone, iOS Camera automatically detects QR codes and shows a notification banner. Tap it to open Phantom directly.
                      </p>
                    </div>
                  </div>

                  {/* Debug info (dev / debug mode) */}
                  {debugMode && (phantomUniversalLink || solanaUri) && (
                    <div className="w-full space-y-3 rounded-lg border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔍</span>
                        <p className="text-sm font-semibold text-foreground">
                          Debug: QR Code Analysis
                        </p>
                      </div>
                      <div className="space-y-3">
                        {/* QR Code URI Type */}
                        <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              QR Code Format
                            </p>
                            {solanaUri && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                <span>✓</span>
                                <span>Solana Pay URI</span>
                              </span>
                            )}
                            {!solanaUri && phantomUniversalLink && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                <span>⚠</span>
                                <span>Phantom Universal Link</span>
                              </span>
                            )}
                          </div>
                          <div className="rounded border border-border/30 bg-muted/30 p-2">
                            <code className="break-all text-xs font-mono text-foreground">
                              {solanaUri || phantomUniversalLink}
                            </code>
                          </div>
                          {solanaUri && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-green-600 dark:text-green-400">
                                ✅ <strong>Optimal for iOS:</strong> Using Solana Pay URI format. iOS camera scanner will recognize this and open Phantom with prepopulated transaction details.
                              </p>
                              <p className="text-xs text-muted-foreground">
                                The <code className="rounded bg-muted px-1 py-0.5 text-[10px]">solana:</code> URI scheme is natively supported by iOS and will properly pass all parameters to Phantom.
                              </p>
                            </div>
                          )}
                          {!solanaUri && phantomUniversalLink && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                ⚠️ <strong>Fallback format:</strong> Using Phantom universal link. This may work but Solana Pay URI is preferred for iOS camera scanning.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Parsed Parameters */}
                        <details className="rounded-lg border border-border/50 bg-background/80 p-3">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            📋 View Parsed Parameters
                          </summary>
                          <div className="mt-2 rounded border border-border/30 bg-muted/30 p-2">
                            <pre className="max-h-40 overflow-auto text-xs font-mono">
                              {JSON.stringify(
                                {
                                  uri: solanaUri || phantomUniversalLink,
                                  type: solanaUri ? 'solana-pay' : 'phantom-universal-link',
                                  params: Object.fromEntries(
                                    new URLSearchParams(
                                      (solanaUri || phantomUniversalLink || '').split('?')[1] || ''
                                    )
                                  ),
                                  paymentDetails: {
                                    address: paymentDetails?.payAddress,
                                    amount: paymentDetails?.payAmount,
                                    currency: paymentDetails?.payCurrency,
                                    tier: paymentDetails?.tier,
                                  },
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </details>

                        {/* Test Actions */}
                        <div className="border-t border-border/30 pt-2 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Test Actions (Dev/QA only):
                          </p>
                          <div className="flex flex-col gap-2">
                            {solanaUri && (
                              <Button
                                onClick={() => {
                                  navigator.clipboard.writeText(solanaUri)
                                  toast.success('Solana Pay URI copied! Paste into Phantom or test scanner.')
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Solana Pay URI
                              </Button>
                            )}
                            {phantomUniversalLink && (
                              <Button
                                onClick={() => {
                                  navigator.clipboard.writeText(phantomUniversalLink)
                                  toast.success('Phantom universal link copied!')
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Phantom Universal Link
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* iOS Testing Guide */}
                        <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3">
                          <p className="mb-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            📱 iOS Testing Guide
                          </p>
                          <ol className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                            <li className="flex items-start gap-2">
                              <span className="font-bold">1.</span>
                              <span>Open Camera app on iPhone</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">2.</span>
                              <span>Point at QR code - iOS should detect it automatically</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">3.</span>
                              <span>Tap the notification banner - should open Phantom</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">4.</span>
                              <span>Verify address and amount are prepopulated</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">5.</span>
                              <span>Check browser console for debug logs</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : isExpired ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-12">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Payment expired</p>
                  <p className="max-w-sm text-center text-xs text-muted-foreground">
                    This payment link has expired. Please create a new payment from the pricing page to continue.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted/20 p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Generating QR code…</p>
                  {!solanaUri && (
                    <p className="mt-2 text-xs text-destructive">
                      Waiting for payment details…
                    </p>
                  )}
                </div>
              )}

              {/* Payment Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment address</label>
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <code className="flex-1 break-all font-mono text-xs">
                    {paymentDetails.payAddress}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(paymentDetails.payAddress, 'address')}
                    className="h-8 w-8 flex-shrink-0 p-0"
                  >
                    {copied === 'address' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-1 rounded-xl border border-sec-500/25 bg-sec-500/5 p-4">
                <p className="text-sm font-semibold text-sec-300">
                  Upgrading to <span className="uppercase">{paymentDetails.tier}</span> tier
                </p>
                <p className="text-xs text-sec-200">
                  Once the payment confirms on‑chain, your VolSpike account unlocks this tier automatically (usually within a few minutes).
                </p>
              </div>

              {/* Actions */}
            <div className="flex flex-col gap-3">
              {isExpired ? (
                <>
                  {/* Expired state - show message and option to create new payment */}
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-semibold text-destructive">
                          Payment Window Expired
                        </p>
                        <p className="text-xs text-muted-foreground">
                          This payment link has expired. Crypto payment addresses are time-sensitive. Please create a new payment to continue.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const tier = paymentDetails?.tier || 'pro'
                        safeNavigate(`/pricing?tier=${tier}`, 'expired-create-new-payment')
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white"
                      size="lg"
                      type="button"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span>Create New Payment</span>
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Primary: Open in Phantom (prefers deep link, falls back to Solana Pay URI) */}
                  <Button
                    onClick={() => {
                      const targetUri = phantomDeepLink || solanaUri || phantomUniversalLink
                      if (targetUri) {
                        console.log('[CryptoPaymentPage] Opening Phantom from button:', {
                          solanaUri,
                          phantomUniversalLink,
                          phantomDeepLink,
                          targetUri,
                          timestamp: new Date().toISOString(),
                        })
                        
                        // Use window.open instead of window.location.href to avoid blocking navigation
                        // This allows the page to remain interactive while opening the wallet
                        try {
                          const opened = window.open(targetUri, '_blank', 'noopener,noreferrer')
                          if (!opened) {
                            console.warn('[CryptoPaymentPage] Popup blocked, trying direct navigation', {
                              targetUri,
                            })
                            window.location.href = targetUri
                          }
                        } catch (err) {
                          console.error('[CryptoPaymentPage] Error opening wallet:', err)
                          toast.error('Failed to open wallet. Please copy the address manually.')
                        }
                      } else {
                        toast.error('Payment details not available')
                        console.error('[CryptoPaymentPage] No Solana Pay URI available')
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg"
                    size="lg"
                    disabled={!solanaUri || isExpired}
                    type="button"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>Open in Phantom Wallet</span>
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </Button>
                  
                  {/* Secondary: Copy address for manual entry */}
                  <Button
                    onClick={() => {
                      if (paymentDetails?.payAddress) {
                        copyToClipboard(paymentDetails.payAddress, 'address')
                        toast.success('Address copied! Paste it in Phantom wallet manually.')
                      }
                    }}
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={!paymentDetails?.payAddress || isExpired}
                    type="button"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Address (Manual Entry)
                    </span>
                  </Button>
                </>
              )}
              
              <Button
                onClick={() => {
                  safeNavigate('/pricing', 'expired-cancel-payment')
                }}
                variant="ghost"
                className="w-full"
                type="button"
              >
                Cancel Payment
              </Button>
            </div>
            
              {/* Helpful Instructions */}
              <details className="rounded-xl border border-purple-500/20 bg-purple-500/8 p-4 text-xs [&_summary]:list-none [&_summary]:cursor-pointer">
                <summary className="mb-1 text-sm font-semibold text-purple-300">
                  💡 Having trouble with Phantom?
                </summary>
                <ol className="list-decimal list-inside space-y-1 text-purple-200/90 mt-1.5">
                  <li>Confirm Phantom is installed on the device you&apos;re using to scan.</li>
                  <li>If another wallet opens, close it and tap <span className="font-medium">“Open in Phantom Wallet”</span> above.</li>
                  <li>You can always copy the address and amount, then paste them manually into Phantom.</li>
                  <li>On iOS, make sure your browser is allowed to open Phantom.</li>
                </ol>
              </details>

              {/* Status footer */}
              {paymentDetails.paymentStatus && (
                <div className="text-center text-xs text-muted-foreground">
                  Raw status: <span className="font-semibold">{paymentDetails.paymentStatus}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  )
}
