'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, QrCode, ExternalLink, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface CryptoPaymentDetailsProps {
  payAddress: string | null
  payAmount: string | number | null
  payCurrency: string | null
  priceAmount: number
  priceCurrency: string
  paymentUrl: string
  invoiceId: string
  onContinue?: () => void
  className?: string
}

export function CryptoPaymentDetails({
  payAddress,
  payAmount,
  payCurrency,
  priceAmount,
  priceCurrency,
  paymentUrl,
  invoiceId,
  onContinue,
  className,
}: CryptoPaymentDetailsProps) {
  const [qrCode, setQrCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  // Generate QR code from payment address or payment URL
  useEffect(() => {
    const generateQR = async () => {
      // Prefer payAddress if available, otherwise use paymentUrl
      const qrData = payAddress || paymentUrl
      if (!qrData) return

      try {
        const qr = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
        setQrCode(qr)
      } catch (error) {
        console.error('Failed to generate QR code:', error)
      }
    }

    generateQR()
  }, [payAddress, paymentUrl])

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue()
    } else {
      window.location.href = paymentUrl
    }
  }

  // Format currency display name
  const getCurrencyDisplayName = (currency: string | null): string => {
    if (!currency) return 'Cryptocurrency'
    const currencyMap: Record<string, string> = {
      usdtsol: 'USDT (Solana)',
      usdterc20: 'USDT (Ethereum)',
      usdce: 'USDC (Ethereum)',
      sol: 'SOL (Solana)',
      btc: 'BTC (Bitcoin)',
      eth: 'ETH (Ethereum)',
    }
    return currencyMap[currency.toLowerCase()] || currency.toUpperCase()
  }

  return (
    <Card className={cn('border-sec-500/20', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-sec-600 dark:text-sec-400" />
          <CardTitle>Payment Details</CardTitle>
        </div>
        <CardDescription>
          Scan the QR code or copy the address to complete your payment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Amount */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-sec-500/10 via-sec-500/5 to-transparent border border-sec-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Amount</span>
            <span className="text-lg font-bold text-sec-700 dark:text-sec-300">
              {payAmount ? `${payAmount} ${getCurrencyDisplayName(payCurrency)}` : `$${priceAmount} ${priceCurrency.toUpperCase()}`}
            </span>
          </div>
          {payAmount && payCurrency && (
            <div className="text-xs text-muted-foreground mt-1">
              ≈ ${priceAmount} {priceCurrency.toUpperCase()}
            </div>
          )}
        </div>

        {/* QR Code - Visible by default */}
        {qrCode ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-lg border-2 border-sec-500/30 bg-background shadow-lg">
              <img
                src={qrCode}
                alt="Payment QR Code"
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Scan this QR code with your crypto wallet to complete the payment
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-64 h-64 rounded-lg border-2 border-sec-500/30 bg-muted/30 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-sec-500" />
            </div>
            <p className="text-xs text-muted-foreground">Generating QR code...</p>
          </div>
        )}

        {/* Payment Address */}
        {payAddress && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Payment Address
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 rounded-lg border border-border/60 bg-muted/30 text-sm break-all font-mono">
                {payAddress}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(payAddress)}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Info Alert */}
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertDescription className="text-sm text-blue-700 dark:text-blue-400">
            <strong>Payment Instructions:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Send the exact amount shown above to the payment address</li>
              <li>Your tier will upgrade automatically once payment is confirmed</li>
              <li>Payment confirmation typically takes 1-5 minutes</li>
              {!payAddress && (
                <li>Click &quot;Continue to Payment Page&quot; to see payment details</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          disabled={loading}
          size="lg"
          className="w-full bg-gradient-to-r from-sec-600 to-sec-500 hover:from-sec-700 hover:to-sec-600 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              {payAddress ? 'Continue to Payment Page' : 'Go to Payment Page'}
            </>
          )}
        </Button>

        {/* Invoice ID (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground text-center">
            Invoice ID: {invoiceId}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

