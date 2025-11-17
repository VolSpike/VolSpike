'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Copy, Check, AlertCircle, ExternalLink, QrCode, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'

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
    }
  }, [debugMode])

  // Generate Solana Pay URI (standard format that Phantom recognizes)
  // Solana Pay spec: solana:<address>?amount=<decimal>&spl-token=<mint>&label=<label>&message=<message>
  // IMPORTANT: Phantom recognizes the standard solana: URI scheme - use decimal amounts for better compatibility
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

      // Format amount according to Solana Pay spec
      // For SOL: amount in lamports (SOL * 1e9)
      // For SPL tokens: amount in smallest unit (token * 1e6 for USDT/USDC with 6 decimals)
      // Phantom requires smallest units for proper pre-filling
      let amountInSmallestUnit: string
      let splTokenMint: string | null = null

      if (isSOL) {
        // SOL amount in lamports (required by Solana Pay spec)
        const lamports = Math.floor(paymentDetails.payAmount * 1e9)
        amountInSmallestUnit = lamports.toString()
      } else if (isUSDT) {
        // USDT amount in smallest unit (6 decimals)
        const smallestUnit = Math.floor(paymentDetails.payAmount * 1e6)
        amountInSmallestUnit = smallestUnit.toString()
        splTokenMint = SPL_TOKEN_MINTS.usdt
      } else if (isUSDC) {
        // USDC amount in smallest unit (6 decimals)
        const smallestUnit = Math.floor(paymentDetails.payAmount * 1e6)
        amountInSmallestUnit = smallestUnit.toString()
        splTokenMint = SPL_TOKEN_MINTS.usdc
      } else {
        // For other tokens, use decimal (fallback)
        amountInSmallestUnit = paymentDetails.payAmount.toString()
      }

      // Build Solana Pay URI (standard format - Phantom recognizes this)
      const params = new URLSearchParams()
      
      // Amount in smallest units (required by Solana Pay spec for proper pre-filling)
      params.set('amount', amountInSmallestUnit)
      
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
      
      // Phantom universal link (for QR code - ensures Phantom opens, not Trust Wallet)
      // Format: https://phantom.app/ul/v1/transfer?recipient=<address>&amount=<decimal>&token=<mint>
      // Use decimal amounts for Phantom universal links (Phantom handles conversion)
      const phantomParams = new URLSearchParams()
      phantomParams.set('recipient', paymentDetails.payAddress)
      phantomParams.set('amount', paymentDetails.payAmount.toString())
      if (splTokenMint && !isSOL) {
        phantomParams.set('token', splTokenMint)
      }
      
      // Universal link (works best for QR codes - opens Phantom app)
      const phantomUniversalLinkUri = `https://phantom.app/ul/v1/transfer?${phantomParams.toString()}`
      // Deep link (fallback for direct button clicks)
      const phantomDeepLinkUri = phantomUniversalLinkUri.replace('https://phantom.app/ul/', 'phantom://ul/')
      
      // Comprehensive debug logging
      console.log('[CryptoPaymentPage] Generated Solana Pay URI:', {
        payAddress: paymentDetails.payAddress,
        payAmount: paymentDetails.payAmount,
        payCurrency: paymentDetails.payCurrency,
        isSOL,
        isUSDT,
        isUSDC,
        amountInSmallestUnit,
        amountDecimal: paymentDetails.payAmount.toString(),
        splTokenMint,
        solanaPayUri,
        phantomUniversalLinkUri,
        phantomDeepLinkUri,
        fullUri: solanaPayUri,
        uriLength: solanaPayUri.length,
        params: Object.fromEntries(params),
        // Verify format matches Solana Pay spec
        matchesSpec: {
          hasAddress: !!paymentDetails.payAddress,
          hasAmount: !!amountInSmallestUnit,
          hasSplToken: !isSOL && !!splTokenMint,
          amountFormat: isSOL ? 'lamports' : isUSDT || isUSDC ? 'micro-tokens' : 'decimal',
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

  // Generate QR code using Phantom universal link (ensures Phantom opens, not Trust Wallet)
  // Universal links are better for QR codes because they're handled by the app that registered them
  useEffect(() => {
    // Use Phantom universal link for QR code (ensures Phantom opens when scanned with camera)
    // Fallback to Solana Pay URI if Phantom link not available
    const uriForQR = phantomUniversalLink || solanaUri
    
    if (!uriForQR) {
      console.warn('[CryptoPaymentPage] No URI available for QR code generation')
      return
    }

    const usingPhantomLink = !!phantomUniversalLink
    console.log('[CryptoPaymentPage] Generating QR code', {
      usingPhantomUniversalLink: usingPhantomLink,
      usingSolanaPayUri: !usingPhantomLink,
      uri: uriForQR,
      uriLength: uriForQR.length,
      uriPreview: uriForQR.substring(0, 100) + '...',
      fullUri: uriForQR,
      // Show what will happen when scanned
      expectedBehavior: usingPhantomLink 
        ? 'Will open Phantom app directly (bypasses Trust Wallet)' 
        : 'Will use device default handler for solana: scheme (may open Trust Wallet)',
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
          uriType: phantomUniversalLink ? 'phantom-universal-link' : 'solana-pay',
          encodedUri: uriForQR,
          willOpenPhantom: !!phantomUniversalLink,
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
  }, [phantomUniversalLink, solanaUri])

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
    if (currency.toLowerCase().includes('sol') || currency.toLowerCase() === 'sol') {
      return 'Solana'
    }
    if (currency.toLowerCase().includes('erc20') || currency.toLowerCase().includes('eth') || currency.toLowerCase() === 'eth') {
      return 'Ethereum'
    }
    if (currency.toLowerCase() === 'btc') {
      return 'Bitcoin'
    }
    return 'Unknown'
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
            e.stopPropagation()
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
        <main className="container mx-auto px-4 py-12 max-w-2xl relative z-0">
        <Card className="relative z-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-sec-600 dark:text-sec-400" />
                  Complete Your Payment
                </CardTitle>
                <CardDescription className="mt-2">
                  Scan the QR code with your phone&apos;s camera to complete payment
                </CardDescription>
              </div>
              {timeRemaining !== null && (
                <div className="flex items-center gap-2 text-sm font-mono">
                  {isExpired ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive font-semibold">
                        Payment Window Expired
                      </span>
                    </>
                  ) : timeRemaining > 0 ? (
                    <>
                      <Clock className={cn(
                        'h-4 w-4',
                        timeRemaining < 300 ? 'text-destructive' : 'text-muted-foreground'
                      )} />
                      <span className={cn(
                        'font-semibold',
                        timeRemaining < 300 && 'text-destructive'
                      )}>
                        {formatTime(timeRemaining)} remaining
                      </span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Amount */}
            <div className="text-center p-6 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground mb-2">Amount to Pay</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-bold">
                  {paymentDetails.payAmount.toFixed(8)} {currencyDisplay}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(paymentDetails.payAmount.toString(), 'amount')}
                  className="h-8 w-8 p-0"
                >
                  {copied === 'amount' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ≈ ${usdAmount.toFixed(2)} USD
              </p>
              <p className="text-xs text-muted-foreground mt-1">{networkName} Network</p>
            </div>

            {/* QR Code */}
            {qrCodeDataUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-lg border-2 border-border shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="Payment QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="text-xs text-muted-foreground">
                    Scan this QR code with your <strong className="text-foreground">phone&apos;s camera</strong> app.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    It will automatically open <strong className="text-foreground">Phantom wallet</strong> with payment details pre-filled.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    If it opens a different wallet, tap &quot;Open in Phantom Wallet&quot; below.
                  </p>
                </div>
                {/* Debug info (always show in dev, optional in prod via query param) */}
                {debugMode && (phantomUniversalLink || solanaUri) && (
                  <div className="w-full p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg border-2 border-purple-500/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔍</span>
                      <p className="text-sm font-semibold text-foreground">
                        Debug: QR Code Contents
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          QR Code Contents ({phantomUniversalLink ? 'Phantom Universal Link' : 'Solana Pay URI'}):
                        </p>
                        <div className="p-3 bg-background/80 rounded border border-border/50">
                          <code className="text-xs font-mono text-foreground break-all">
                            {phantomUniversalLink || solanaUri}
                          </code>
                        </div>
                        {phantomUniversalLink && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✓ Using Phantom universal link - will open Phantom app directly
                          </p>
                        )}
                        {!phantomUniversalLink && solanaUri && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            ⚠ Using Solana Pay URI - device default handler will be used (may open Trust Wallet)
                          </p>
                        )}
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                          📋 View parsed parameters
                        </summary>
                        <div className="mt-2 p-3 bg-background/80 rounded border border-border/50">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(
                              Object.fromEntries(
                                new URLSearchParams(
                                  (phantomUniversalLink || solanaUri || '').split('?')[1] || ''
                                )
                              ),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </details>
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground mb-2">
                          <strong>Test the URI:</strong>
                        </p>
                        <Button
                          onClick={() => {
                            if (solanaUri) {
                              navigator.clipboard.writeText(solanaUri)
                              toast.success('URI copied to clipboard! Paste it in a browser or wallet to test.')
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Copy URI to Test
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : isExpired ? (
              <div className="flex flex-col items-center justify-center p-12 bg-destructive/5 rounded-lg gap-3 border border-destructive/20">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm font-semibold text-destructive">Payment Expired</p>
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  This payment link has expired. Please create a new payment to continue.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-lg gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generating QR code...</p>
                {!solanaUri && (
                  <p className="text-xs text-destructive mt-2">
                    Waiting for payment details...
                  </p>
                )}
              </div>
            )}

            {/* Payment Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Address</label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                <code className="flex-1 text-xs break-all font-mono">
                  {paymentDetails.payAddress}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(paymentDetails.payAddress, 'address')}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  {copied === 'address' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Payment Info */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Upgrading to:</strong> {paymentDetails.tier.toUpperCase()} tier
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Your account will be upgraded automatically once the payment is confirmed on the blockchain (usually within a few minutes).
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
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Redirect to pricing or test payment page
                        const tier = paymentDetails?.tier || 'pro'
                        router.push(`/pricing?tier=${tier}`)
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
                  {/* Primary: Open in Phantom (uses Solana Pay URI) */}
                  <Button
                    onClick={(e) => {
                      // Prevent any default behavior that might block navigation
                      e.preventDefault()
                      e.stopPropagation()
                      
                      // Use Solana Pay URI (Phantom recognizes this format)
                      if (solanaUri) {
                        console.log('[CryptoPaymentPage] Opening Solana Pay URI in Phantom:', {
                          solanaUri,
                          phantomUniversalLink,
                          timestamp: new Date().toISOString(),
                        })
                        
                        // Use window.open instead of window.location.href to avoid blocking navigation
                        // This allows the page to remain interactive while opening the wallet
                        try {
                          // Try Phantom universal link first (more reliable)
                          if (phantomUniversalLink) {
                            console.log('[CryptoPaymentPage] Opening Phantom universal link:', phantomUniversalLink)
                            const opened = window.open(phantomUniversalLink, '_blank', 'noopener,noreferrer')
                            if (!opened) {
                              // Popup blocked, try direct navigation as fallback
                              console.warn('[CryptoPaymentPage] Popup blocked, trying direct navigation')
                              window.location.href = phantomUniversalLink
                            }
                          } else {
                            // Fallback to Solana Pay URI
                            console.log('[CryptoPaymentPage] Opening Solana Pay URI:', solanaUri)
                            const opened = window.open(solanaUri, '_blank', 'noopener,noreferrer')
                            if (!opened) {
                              // Popup blocked, try direct navigation as fallback
                              console.warn('[CryptoPaymentPage] Popup blocked, trying direct navigation')
                              window.location.href = solanaUri
                            }
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
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
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
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push('/pricing')
                }}
                variant="ghost"
                className="w-full"
                type="button"
              >
                Cancel Payment
              </Button>
            </div>
            
            {/* Helpful Instructions */}
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
                💡 Having trouble opening Phantom?
              </p>
              <ol className="text-xs text-purple-600 dark:text-purple-400 space-y-1 list-decimal list-inside">
                <li>Make sure Phantom wallet is installed on your phone</li>
                <li>If Trust Wallet opens instead, tap &quot;Open in Phantom Wallet&quot; button above</li>
                <li>Or copy the address and paste it manually in Phantom</li>
                <li>On iOS, you may need to allow Phantom to open from browser</li>
              </ol>
            </div>

            {/* Status */}
            {paymentDetails.paymentStatus && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-semibold capitalize">{paymentDetails.paymentStatus}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

