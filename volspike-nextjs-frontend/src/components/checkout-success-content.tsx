'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CheckoutSuccessContent() {
    const { data: session, update } = useSession()
    const router = useRouter()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [hasRefreshed, setHasRefreshed] = useState(false)
    const [currentTier, setCurrentTier] = useState(session?.user?.tier || 'free')

    // Auto-refresh session after a delay to pick up webhook updates
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!hasRefreshed) {
                setIsRefreshing(true)
                try {
                    // Refresh session to get updated tier from database
                    await update()
                    setHasRefreshed(true)
                    // Update local state
                    setCurrentTier(session?.user?.tier || 'free')
                } catch (error) {
                    console.error('Failed to refresh session:', error)
                } finally {
                    setIsRefreshing(false)
                }
            }
        }, 3000) // Wait 3 seconds for webhook to process

        return () => clearTimeout(timer)
    }, [update, hasRefreshed, session])

    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        try {
            await update()
            setHasRefreshed(true)
            setCurrentTier(session?.user?.tier || 'free')
            // Small delay to show success
            setTimeout(() => {
                router.refresh()
            }, 500)
        } catch (error) {
            console.error('Failed to refresh session:', error)
        } finally {
            setIsRefreshing(false)
        }
    }

    const isPro = currentTier === 'pro' || currentTier === 'elite'

    return (
        <main className="container mx-auto px-4 py-12 max-w-2xl">
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
                <div className="flex justify-center mb-4">
                    <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Payment Successful</h1>
                
                {isPro ? (
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                Your account has been upgraded to {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} tier!
                            </span>
                        </div>
                        <p className="text-muted-foreground">
                            You now have access to all Pro features. Enjoy faster updates, more alerts, and premium features!
                        </p>
                    </div>
                ) : (
                    <div className="mb-6">
                        <p className="text-muted-foreground mb-4">
                            Thank you for upgrading! Your Pro features will be available shortly.
                            The webhook is processing your subscription update.
                        </p>
                        <Button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            variant="outline"
                            className="inline-flex items-center gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing...' : 'Refresh My Account'}
                        </Button>
                        {hasRefreshed && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Session refreshed. If tier hasn&apos;t updated, please sign out and sign back in.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-center gap-3">
                    <Link href="/dashboard" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 transition">
                        Go to Dashboard
                    </Link>
                    <Link href="/pricing" className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-border hover:bg-muted transition">
                        Back to Pricing
                    </Link>
                </div>
            </div>
        </main>
    )
}

