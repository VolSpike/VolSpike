'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { startOneTimeTestPayment } from '@/lib/payments'
import { Loader2, CheckCircle2, XCircle, CreditCard } from 'lucide-react'
import { HeaderWithBanner } from '@/components/header-with-banner'

export default function TestPaymentPage() {
    const { data: session, status } = useSession()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleTestPayment = async () => {
        if (!session?.user) {
            setError('You must be signed in to test payments')
            return
        }

        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // Get the price ID from environment or use the hardcoded one
            const priceId = process.env.NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID || 'price_1STCbVCLSEoP808orY93EU2r'
            
            if (!priceId) {
                throw new Error('Price ID not configured. Please set NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID')
            }

            await startOneTimeTestPayment(session, priceId)
            setSuccess(true)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred'
            setError(message)
            console.error('Test payment error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background">
                <HeaderWithBanner />
                <main className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    </div>
                </main>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-background">
                <HeaderWithBanner />
                <main className="container mx-auto px-4 py-8">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>Test Payment Page</CardTitle>
                            <CardDescription>You must be signed in to test payments</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => window.location.href = '/auth'}>
                                Sign In
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <HeaderWithBanner />
            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <Card className="border-brand-500/20">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-brand-500" />
                            <CardTitle>Test One-Time Payment ($1)</CardTitle>
                        </div>
                        <CardDescription>
                            Test the Stripe one-time payment integration. This will charge $1.00 and upgrade the user to Pro tier.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* User Info */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">Logged in as:</p>
                            <p className="font-medium">{session.user.email}</p>
                            <p className="text-sm text-muted-foreground mt-2">Current tier:</p>
                            <p className="font-medium capitalize">{(session.user as any).tier || 'free'}</p>
                        </div>

                        {/* Price ID Info */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">Price ID:</p>
                            <code className="text-xs bg-background px-2 py-1 rounded border border-border">
                                {process.env.NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID || 'price_1STCbVCLSEoP808orY93EU2r'}
                            </code>
                            <p className="text-xs text-muted-foreground mt-1">
                                {process.env.NEXT_PUBLIC_STRIPE_TEST_ONETIME_PRICE_ID 
                                    ? 'Using environment variable' 
                                    : 'Using hardcoded fallback'}
                            </p>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Success Alert */}
                        {success && (
                            <Alert className="border-green-500/50 bg-green-500/10">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    Redirecting to Stripe Checkout...
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Test Button */}
                        <Button
                            onClick={handleTestPayment}
                            disabled={loading || success}
                            size="lg"
                            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Test $1 Payment
                                </>
                            )}
                        </Button>

                        {/* Warning */}
                        <Alert className="border-yellow-500/50 bg-yellow-500/10">
                            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                                <strong>Warning:</strong> This will charge a real $1.00 payment. Make sure you&apos;re using a real card (not test cards like 4242...).
                            </AlertDescription>
                        </Alert>

                        {/* Instructions */}
                        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                            <p className="text-sm font-semibold">How to test:</p>
                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Click &quot;Test $1 Payment&quot; button above</li>
                                <li>You&apos;ll be redirected to Stripe Checkout</li>
                                <li>Enter a real card (your friend&apos;s card)</li>
                                <li>Complete the payment</li>
                                <li>You&apos;ll be redirected back to /checkout/success</li>
                                <li>Check Stripe Dashboard → Payments to verify</li>
                                <li>Check your Settings → Subscription to see Pro Tier</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

