'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, AlertCircle, Coins, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startCryptoCheckout } from '@/lib/payments'
import { toast } from 'react-hot-toast'
import { CryptoCurrencySelector } from '@/components/crypto-currency-selector'

export default function CryptoCheckoutPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tier = (searchParams.get('tier') || 'pro') as 'pro' | 'elite'
  
  const [selectedCurrency, setSelectedCurrency] = useState<string>('usdtsol') // Default to USDT on Solana
  const [isLoading, setIsLoading] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'redirecting'>('select')

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth')
      return
    }
  }, [session, router])

  const handleContinue = async () => {
    if (!selectedCurrency) {
      toast.error('Please select a payment currency')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setStep('redirecting')
      
      const result = await startCryptoCheckout(session, tier, selectedCurrency)
      if (result.paymentUrl) {
        setPaymentUrl(result.paymentUrl)
        // Auto-redirect after a brief moment
        setTimeout(() => {
          window.location.href = result.paymentUrl
        }, 500)
      } else {
        throw new Error('Payment URL not received from server')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment'
      console.error('[CryptoCheckoutPage] Payment creation error:', err)
      setError(message)
      toast.error(message)
      setStep('select')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'redirecting' || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sec-600 dark:text-sec-400 mb-4" />
              <p className="text-muted-foreground mb-2">Preparing your payment...</p>
              <p className="text-xs text-muted-foreground">Redirecting to secure payment page</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error) {
    // Determine error type for better UX
    const isDatabaseError = error.includes('Database migration') || error.includes('migration')
    const isNetworkError = error.includes('Network error') || error.includes('Cannot connect')
    const isAuthError = error.includes('signed in') || error.includes('authentication')
    
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
              <CardDescription className="break-words text-base">
                {isDatabaseError 
                  ? 'The payment system is updating. This usually completes in under a minute. Please try again.'
                  : isNetworkError
                  ? 'Unable to connect to payment server. Please check your internet connection.'
                  : isAuthError
                  ? 'Please sign in to continue with your payment.'
                  : 'We encountered an issue processing your payment. Please try again.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Details Card */}
              <div className={cn(
                "p-4 rounded-lg border",
                isDatabaseError 
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-destructive/10 border-destructive/20"
              )}>
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    isDatabaseError ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1">
                      {isDatabaseError ? 'System Update in Progress' : 'Error Details'}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {error}
                    </p>
                    {!isDatabaseError && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Check the browser console (F12) and Railway logs for more details.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Helpful Actions */}
              <div className="space-y-3">
                {isDatabaseError ? (
                  <>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <strong>What&apos;s happening?</strong> We&apos;re updating our payment system to add new features. The update is automatic and usually completes in under a minute. Your payment will process normally once complete.
                      </p>
                    </div>
                    <Button 
                      onClick={() => window.location.reload()} 
                      className="w-full"
                      size="lg"
                    >
                      Try Again
                    </Button>
                    <Button 
                      onClick={() => router.push('/pricing')} 
                      variant="outline" 
                      className="w-full"
                    >
                      Back to Pricing
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={() => {
                        setError(null)
                        setStep('select')
                        window.location.reload()
                      }} 
                      className="w-full"
                      size="lg"
                    >
                      Try Again
                    </Button>
                    <Button 
                      onClick={() => router.push('/pricing')} 
                      variant="outline" 
                      className="w-full"
                    >
                      Back to Pricing
                    </Button>
                  </>
                )}
              </div>

              {/* Support Link */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-center text-muted-foreground">
                  Need help? Contact us at{' '}
                  <a 
                    href="mailto:support@volspike.com" 
                    className="text-sec-600 dark:text-sec-400 hover:underline"
                  >
                    support@volspike.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-sec-600 dark:text-sec-400" />
              Complete Your Crypto Payment
            </CardTitle>
            <CardDescription>
              Select your preferred cryptocurrency to complete your {tier.charAt(0).toUpperCase() + tier.slice(1)} tier payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Currency Selector */}
            <CryptoCurrencySelector
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
            />

            {/* Payment Info */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground mb-3">
                <strong className="text-foreground">Payment Process:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-sec-600 dark:text-sec-400 mt-0.5">✓</span>
                  <span>You&apos;ll be redirected to NowPayments secure payment page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sec-600 dark:text-sec-400 mt-0.5">✓</span>
                  <span>Complete payment using your crypto wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sec-600 dark:text-sec-400 mt-0.5">✓</span>
                  <span>Your tier upgrades automatically once confirmed on blockchain</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleContinue}
                className="flex-1"
                size="lg"
                disabled={!selectedCurrency || isLoading}
              >
                Continue to Payment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                onClick={() => router.push('/pricing')}
                variant="outline"
                size="lg"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>

            {/* Info Note */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Note:</strong> Crypto payments typically confirm within a few minutes. Your account will be upgraded automatically once the transaction is verified on the blockchain.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

