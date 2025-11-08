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

    // Get current tier from session (will update when session updates)
    const currentTier = session?.user?.tier || 'free'
    const isPro = currentTier === 'pro' || currentTier === 'elite'

    // Auto-refresh session with polling until tier updates (only if not already pro)
    useEffect(() => {
        // If already pro, don't poll
        if (isPro) {
            return
        }

        // Start polling after initial delay
        const startPolling = () => {
            let attempts = 0
            const maxAttempts = 10 // Try for 30 seconds (10 attempts * 3 seconds)
            let hasReloaded = false
            
            const pollInterval = setInterval(async () => {
                attempts++
                
                try {
                    setIsRefreshing(true)
                    
                    // Use Next.js API route to refresh session (server-side)
                    const refreshResponse = await fetch('/api/auth/refresh-session', {
                        method: 'POST',
                    })
                    
                    if (refreshResponse.ok) {
                        const { user: freshUser } = await refreshResponse.json()
                        const freshUserTier = freshUser?.tier || null
                        
                        // If backend says pro but session doesn't, force update session
                        if (freshUserTier === 'pro' || freshUserTier === 'elite') {
                            // Force update session with new tier data
                            await update({
                                tier: freshUserTier,
                            } as any)
                            
                            // Check session after update
                            const updatedSession = await update()
                            const afterTier = updatedSession?.user?.tier || 'unknown'
                            
                            // If backend confirmed pro but session still shows free, force reload once
                            if ((freshUserTier === 'pro' || freshUserTier === 'elite') && afterTier === 'free' && !hasReloaded) {
                                hasReloaded = true
                                clearInterval(pollInterval)
                                setIsRefreshing(false)
                                setTimeout(() => {
                                    window.location.reload()
                                }, 1000)
                                return
                            }
                            
                            // If session updated to pro, stop polling (no reload needed if already showing pro)
                            if (afterTier === 'pro' || afterTier === 'elite') {
                                clearInterval(pollInterval)
                                setIsRefreshing(false)
                                return
                            }
                        }
                    }
                    
                    // If not updated yet, continue polling
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval)
                        setIsRefreshing(false)
                    } else {
                        setIsRefreshing(false)
                    }
                } catch (error) {
                    setIsRefreshing(false)
                    
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval)
                    }
                }
            }, 3000) // Poll every 3 seconds
            
            // Cleanup on unmount
            return () => clearInterval(pollInterval)
        }

        // Start polling after 2 seconds (give webhook time to process)
        const initialTimer = setTimeout(() => {
            startPolling()
        }, 2000)

        return () => {
            clearTimeout(initialTimer)
        }
    }, [isPro, update]) // Re-run if tier changes

    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        
        try {
            await update()
            setTimeout(() => {
                router.refresh()
            }, 500)
        } catch (error) {
            console.error('Failed to refresh session:', error)
        } finally {
            setIsRefreshing(false)
            setHasRefreshed(true)
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
                            {isRefreshing && ' Checking tier status...'}
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
                        {hasRefreshed && !isPro && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Session refreshed. If tier hasn&apos;t updated, please sign out and sign back in.
                            </p>
                        )}
                    </div>
                )}


                <div className="flex items-center justify-center gap-3 mt-6">
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
