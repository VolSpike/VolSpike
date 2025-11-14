'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, AlertCircle, Coins } from 'lucide-react'
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
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <CardTitle>Payment Error</CardTitle>
              </div>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => router.push('/pricing')} className="w-full">
                Back to Pricing
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                className="w-full"
              >
                Try Again
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
              You&apos;ll be redirected to complete your {tier.charAt(0).toUpperCase() + tier.slice(1)} tier payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-5 rounded-xl bg-gradient-to-br from-sec-500/10 via-sec-500/5 to-transparent border border-sec-500/20">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-sec-500/20">
                  <Coins className="h-5 w-5 text-sec-600 dark:text-sec-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Crypto Payment Process
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-sec-600 dark:text-sec-400 mt-0.5">•</span>
                      <span>You&apos;ll be redirected to NowPayments secure payment page</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sec-600 dark:text-sec-400 mt-0.5">•</span>
                      <span>Choose from 100+ supported cryptocurrencies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sec-600 dark:text-sec-400 mt-0.5">•</span>
                      <span>Complete payment using your crypto wallet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sec-600 dark:text-sec-400 mt-0.5">•</span>
                      <span>Your tier upgrades automatically once confirmed on blockchain</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                <span className="mt-0.5">ℹ️</span>
                <span>
                  <strong>Note:</strong> Crypto payments typically confirm within a few minutes. Your account will be upgraded automatically once the transaction is verified on the blockchain.
                </span>
              </p>
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

