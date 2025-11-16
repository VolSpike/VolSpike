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

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)

  // Generate Solana Pay URI and Phantom-specific deep links
  // Solana Pay spec: solana:<address>?amount=<lamports>&spl-token=<mint>&reference=<reference>&label=<label>&message=<message>
  // Phantom also supports this format, but we'll provide multiple options for better compatibility
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

      // Format amount correctly
      // For SOL: amount in lamports (SOL * 1e9)
      // For SPL tokens: amount in smallest unit (token * 1e6 for USDT/USDC with 6 decimals)
      let amountInSmallestUnit: string
      let splTokenMint: string | null = null

      if (isSOL) {
        // SOL amount in lamports
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
        // For other tokens, use decimal amount (Phantom will handle it)
        amountInSmallestUnit = paymentDetails.payAmount.toString()
      }

      // Build Solana Pay URI (standard format)
      const params = new URLSearchParams()
      
      // Amount is required
      params.set('amount', amountInSmallestUnit)
      
      // SPL token mint address (required for tokens, not for SOL)
      if (splTokenMint && !isSOL) {
        params.set('spl-token', splTokenMint)
      }
      
      // Optional metadata
      params.set('label', 'VolSpike Payment')
      params.set('message', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)
      
      // Reference for tracking (base58 encoded order ID)
      if (paymentDetails.orderId) {
        params.set('reference', paymentDetails.orderId)
      }

      const solanaPayUri = `solana:${paymentDetails.payAddress}?${params.toString()}`
      
      // Phantom-specific deep links (for better mobile compatibility)
      // Format: phantom://v1/transfer?recipient=<address>&amount=<amount>&token=<mint>
      const phantomParams = new URLSearchParams()
      phantomParams.set('recipient', paymentDetails.payAddress)
      phantomParams.set('amount', amountInSmallestUnit)
      if (splTokenMint && !isSOL) {
        phantomParams.set('token', splTokenMint)
      }
      
      const phantomDeepLinkUri = `phantom://v1/transfer?${phantomParams.toString()}`
      const phantomUniversalLinkUri = `https://phantom.app/ul/v1/transfer?${phantomParams.toString()}`
      
      // Debug logging
      console.log('[CryptoPaymentPage] Generated payment URIs:', {
        payAddress: paymentDetails.payAddress,
        payAmount: paymentDetails.payAmount,
        payCurrency: paymentDetails.payCurrency,
        isSOL,
        isUSDT,
        isUSDC,
        amountInSmallestUnit,
        splTokenMint,
        solanaPayUri,
        phantomDeepLinkUri,
        phantomUniversalLinkUri,
        decodedParams: Object.fromEntries(params),
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

  // Generate QR code - prefer Phantom deep link for better mobile compatibility
  // If Phantom deep link is available, use it; otherwise fall back to Solana Pay URI
  useEffect(() => {
    // Prefer Phantom deep link for QR code (better mobile compatibility)
    const uriForQR = phantomDeepLink || solanaUri
    
    if (!uriForQR) {
      console.warn('[CryptoPaymentPage] No URI available for QR code generation')
      return
    }

    console.log('[CryptoPaymentPage] Generating QR code', {
      usingPhantomDeepLink: !!phantomDeepLink,
      usingSolanaPay: !phantomDeepLink && !!solanaUri,
      uri: uriForQR,
      uriLength: uriForQR.length,
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
          uriType: phantomDeepLink ? 'phantom-deep-link' : 'solana-pay',
        })
        setQrCodeDataUrl(url)
      })
      .catch((err) => {
        console.error('[CryptoPaymentPage] QR code generation error:', {
          error: err,
          uri: uriForQR,
          uriLength: uriForQR.length,
        })
        toast.error('Failed to generate QR code')
      })
  }, [solanaUri, phantomDeepLink])

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

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining])

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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-sec-600 dark:text-sec-400" />
                  Complete Your Payment
                </CardTitle>
                <CardDescription className="mt-2">
                  Scan the QR code with your Phantom wallet to complete payment
                </CardDescription>
              </div>
              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="flex items-center gap-2 text-sm font-mono">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    'font-semibold',
                    timeRemaining < 300 && 'text-destructive'
                  )}>
                    {formatTime(timeRemaining)}
                  </span>
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
                  <img
                    src={qrCodeDataUrl}
                    alt="Payment QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="text-xs text-muted-foreground">
                    Scan with <strong className="text-foreground">Phantom wallet</strong> app on your phone.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    If it opens Trust Wallet instead, tap the button below to open Phantom directly.
                  </p>
                </div>
                {/* Debug info (development only) */}
                {process.env.NODE_ENV === 'development' && (solanaUri || phantomDeepLink) && (
                  <div className="w-full p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2">
                    {phantomDeepLink && (
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        <strong className="block mb-1">Phantom Deep Link:</strong>
                        {phantomDeepLink}
                      </p>
                    )}
                    {solanaUri && (
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        <strong className="block mb-1">Solana Pay URI:</strong>
                        {solanaUri}
                      </p>
                    )}
                  </div>
                )}
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
              {/* Primary: Open in Phantom (tries multiple methods) */}
              <Button
                onClick={() => {
                  // Try Phantom deep link first (best for mobile)
                  if (phantomDeepLink) {
                    console.log('[CryptoPaymentPage] Attempting to open Phantom deep link:', phantomDeepLink)
                    // Try deep link first
                    window.location.href = phantomDeepLink
                    
                    // Fallback to universal link after a short delay (if deep link fails)
                    setTimeout(() => {
                      if (phantomUniversalLink) {
                        console.log('[CryptoPaymentPage] Fallback to Phantom universal link:', phantomUniversalLink)
                        window.open(phantomUniversalLink, '_blank')
                      } else if (solanaUri) {
                        console.log('[CryptoPaymentPage] Fallback to Solana Pay URI:', solanaUri)
                        window.open(solanaUri, '_blank')
                      }
                    }, 500)
                  } else if (solanaUri) {
                    console.log('[CryptoPaymentPage] Opening Solana Pay URI:', solanaUri)
                    window.open(solanaUri, '_blank')
                  } else {
                    toast.error('Payment details not available')
                  }
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white"
                size="lg"
                disabled={!solanaUri && !phantomDeepLink}
              >
                <span className="flex items-center justify-center gap-2">
                  Open in Phantom Wallet
                  <ExternalLink className="h-4 w-4" />
                </span>
              </Button>
              
              {/* Secondary: Copy address for manual entry */}
              <Button
                onClick={() => {
                  if (paymentDetails.payAddress) {
                    copyToClipboard(paymentDetails.payAddress, 'address')
                    toast.success('Address copied! Paste it in Phantom wallet manually.')
                  }
                }}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Address (Manual Entry)
                </span>
              </Button>
              
              <Button
                onClick={() => router.push('/pricing')}
                variant="ghost"
                className="w-full"
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
                <li>If Trust Wallet opens instead, tap "Open in Phantom Wallet" button above</li>
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

