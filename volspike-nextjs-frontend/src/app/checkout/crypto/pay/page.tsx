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

  // Generate Solana URI scheme for QR code
  const solanaUri = useMemo(() => {
    if (!paymentDetails?.payAddress || !paymentDetails?.payAmount) return null

    // Format: solana:<address>?amount=<amount>&label=<label>&message=<message>
    const params = new URLSearchParams()
    params.set('amount', paymentDetails.payAmount.toString())
    params.set('label', 'VolSpike Payment')
    params.set('message', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)

    return `solana:${paymentDetails.payAddress}?${params.toString()}`
  }, [paymentDetails])

  // Generate QR code
  useEffect(() => {
    if (!solanaUri) return

    QRCode.toDataURL(solanaUri, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        setQrCodeDataUrl(url)
      })
      .catch((err) => {
        console.error('QR code generation error:', err)
        toast.error('Failed to generate QR code')
      })
  }, [solanaUri])

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
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  Scan with Phantom wallet app on your phone. The QR code uses Solana URI scheme to automatically open your wallet.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 bg-muted/20 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <Button
                onClick={() => {
                  if (solanaUri) {
                    window.open(solanaUri, '_blank')
                  }
                }}
                className="w-full"
                size="lg"
                disabled={!solanaUri}
              >
                Open in Phantom Wallet
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              <Button
                onClick={() => router.push('/pricing')}
                variant="outline"
                className="w-full"
              >
                Cancel Payment
              </Button>
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

