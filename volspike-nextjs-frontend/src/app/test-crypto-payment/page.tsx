'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Coins, AlertTriangle, Sparkles } from 'lucide-react'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { CryptoCurrencySelector } from '@/components/crypto-currency-selector'
import { PaymentErrorDisplay } from '@/components/payment-error-display'
import { SolanaPayQRGenerator } from '@/components/solana-pay-qr-generator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function TestCryptoPaymentPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
    const [tier, setTier] = useState<'pro' | 'elite'>('pro')
    const [selectedCurrency, setSelectedCurrency] = useState<string>('usdtsol') // Default to USDT on Solana

    const isTestUser = session?.user?.email?.endsWith('-test@volspike.com') ||
        session?.user?.email === 'test@volspike.com' ||
        session?.user?.email?.includes('test@')

    const handleTestPayment = async () => {
        if (!session?.user) {
            setError('You must be signed in to test payments')
            return
        }

        if (!isTestUser) {
            setError('This test payment page is only available for test accounts (emails ending with -test@volspike.com)')
            return
        }

        setLoading(true)
        setError(null)
        setPaymentUrl(null)

        try {
            const accessToken = (session as any).accessToken || session.user.id

            const response = await fetch(`${API_URL}/api/payments/nowpayments/test-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    tier,
                    // No testAmount - backend will fetch actual minimum from NowPayments API
                    successUrl: `${window.location.origin}/checkout/success?test=true`,
                    cancelUrl: `${window.location.origin}/test-crypto-payment?canceled=true`,
                    payCurrency: selectedCurrency, // Use selected currency from our 6 supported options
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
                }))

                // Extract detailed error message
                const errorMessage = errorData.error || errorData.message || errorData.details || `HTTP ${response.status}`

                // Log full error details for debugging
                console.error('Payment API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    url: `${API_URL}/api/payments/nowpayments/test-checkout`,
                })

                throw new Error(errorMessage)
            }

            const data = await response.json()

            if (data.paymentUrl) {
                setPaymentUrl(data.paymentUrl)
                // Redirect to NowPayments checkout
                window.location.href = data.paymentUrl
            } else {
                throw new Error('No payment URL returned from server')
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred'
            setError(message)
            console.error('Test crypto payment error:', err)
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
                            <CardTitle>Test Crypto Payment</CardTitle>
                            <CardDescription>You must be signed in to test crypto payments</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/auth')}>
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
                            <Coins className="h-5 w-5 text-brand-500" />
                            <CardTitle>Test Crypto Payment</CardTitle>
                            <Badge variant="outline" className="ml-auto">
                                TEST MODE
                            </Badge>
                        </div>
                        <CardDescription>
                            Test the NowPayments crypto payment integration. Amount will be calculated automatically based on the selected currency&apos;s minimum (typically $2-3). You&apos;ll be upgraded to {tier === 'pro' ? 'Pro' : 'Elite'} tier.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Test User Check */}
                        {!isTestUser && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>
                                    This test payment page is only available for test accounts. Your email ({session.user.email}) does not match the test account pattern (must end with -test@volspike.com or contain test@).
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* User Info */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">Logged in as:</p>
                            <p className="font-medium">{session.user.email}</p>
                            <p className="text-sm text-muted-foreground mt-2">Current tier:</p>
                            <p className="font-medium capitalize">{(session.user as any).tier || 'free'}</p>
                            {isTestUser && (
                                <Badge variant="outline" className="mt-2">
                                    ✓ Test Account Verified
                                </Badge>
                            )}
                        </div>

                        {/* Tier Selection */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm font-semibold mb-3">Select Tier to Test:</p>
                            <div className="flex gap-2">
                                <Button
                                    variant={tier === 'pro' ? 'default' : 'outline'}
                                    onClick={() => setTier('pro')}
                                    className="flex-1"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Pro (test)
                                </Button>
                                <Button
                                    variant={tier === 'elite' ? 'default' : 'outline'}
                                    onClick={() => setTier('elite')}
                                    className="flex-1"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Elite (test)
                                </Button>
                            </div>
                        </div>

                        {/* Currency Selection */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm font-semibold mb-3">Select Payment Currency:</p>
                            <CryptoCurrencySelector
                                selectedCurrency={selectedCurrency}
                                onCurrencyChange={setSelectedCurrency}
                            />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <PaymentErrorDisplay
                                error={error}
                                onRetry={() => {
                                    setError(null)
                                    handleTestPayment()
                                }}
                            />
                        )}

                        {/* Success Alert */}
                        {paymentUrl && (
                            <Alert className="border-green-500/50 bg-green-500/10">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    Redirecting to NowPayments checkout...
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Test Button */}
                        <Button
                            onClick={handleTestPayment}
                            disabled={loading || !!paymentUrl || !isTestUser || !selectedCurrency}
                            size="lg"
                            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Payment...
                                </>
                            ) : (
                                <>
                                    <Coins className="mr-2 h-4 w-4" />
                                    Test Crypto Payment ({tier === 'pro' ? 'Pro' : 'Elite'})
                                </>
                            )}
                        </Button>

                        {/* Important Info */}
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                            <AlertTriangle className="h-4 w-4 text-blue-500" />
                            <AlertDescription className="text-blue-700 dark:text-blue-400">
                                <strong>Test Payment Details:</strong>
                                <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                                    <li>Amount: Calculated automatically (minimum + 10% buffer, typically $2-3)</li>
                                    <li>You can pay with any supported crypto currency</li>
                                    <li>Payment will upgrade you to {tier === 'pro' ? 'Pro' : 'Elite'} tier</li>
                                    <li>Subscription expires 30 days from payment</li>
                                    <li>Webhook will process automatically after payment</li>
                                </ul>
                            </AlertDescription>
                        </Alert>

                        {/* Instructions */}
                        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                            <p className="text-sm font-semibold">How to test:</p>
                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Select Pro or Elite tier above</li>
                                <li>Select your preferred payment currency from the 6 supported options</li>
                                <li>Click &quot;Test Crypto Payment&quot; button</li>
                                <li>You&apos;ll be redirected to NowPayments checkout (showing only your selected currency)</li>
                                <li>Complete the payment (amount will be minimum + 10% buffer, typically $2-3)</li>
                                <li>You&apos;ll be redirected back to success page</li>
                                <li>Check your Settings → Subscription to see {tier === 'pro' ? 'Pro' : 'Elite'} Tier</li>
                                <li>Check Admin → Payments to verify payment record</li>
                                <li>Verify webhook processed correctly in backend logs</li>
                            </ol>
                        </div>

                        {/* Debug Info */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <p className="text-xs font-mono text-muted-foreground">
                                    API URL: {API_URL}
                                    <br />
                                    Test User: {isTestUser ? 'Yes' : 'No'}
                                    <br />
                                    Selected Tier: {tier}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* QR Code Generator Tool */}
                <div className="mt-8">
                    <SolanaPayQRGenerator
                        defaultRecipient="7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q"
                        defaultAmount="0.1"
                        defaultToken="Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
                    />
                </div>
            </main>
        </div>
    )
}

