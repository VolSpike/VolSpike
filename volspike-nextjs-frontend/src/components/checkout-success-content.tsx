'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CheckoutSuccessContent() {
    const { data: session, update, status } = useSession()
    const router = useRouter()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [hasRefreshed, setHasRefreshed] = useState(false)
    const [refreshAttempts, setRefreshAttempts] = useState(0)
    const [debugInfo, setDebugInfo] = useState<string[]>([])

    // Get current tier from session (will update when session updates)
    const currentTier = session?.user?.tier || 'free'

    const addDebugLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setDebugInfo(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]) // Keep last 20 logs
        console.log(`[CheckoutSuccess] ${message}`)
    }

    // Auto-refresh session with polling until tier updates
    useEffect(() => {
        addDebugLog(`Initial tier: ${currentTier}, Session status: ${status}`)
        
        // Start polling after initial delay
        const startPolling = () => {
            let attempts = 0
            const maxAttempts = 10 // Try for 30 seconds (10 attempts * 3 seconds)
            
            const pollInterval = setInterval(async () => {
                attempts++
                setRefreshAttempts(attempts)
                
                addDebugLog(`Polling attempt ${attempts}/${maxAttempts}, current tier: ${currentTier}`)
                
                try {
                    setIsRefreshing(true)
                    
                    // Call update() which triggers JWT callback with trigger='update'
                    addDebugLog('Calling session.update()...')
                    const updatedSession = await update()
                    
                    addDebugLog(`Session update completed. New tier: ${updatedSession?.user?.tier || 'unknown'}`)
                    
                    // Check if tier has been updated
                    if (updatedSession?.user?.tier === 'pro' || updatedSession?.user?.tier === 'elite') {
                        addDebugLog(`✅ Tier updated successfully to: ${updatedSession.user.tier}`)
                        clearInterval(pollInterval)
                        setIsRefreshing(false)
                        router.refresh() // Force page refresh to show updated tier
                        return
                    }
                    
                    // If not updated yet, continue polling
                    if (attempts >= maxAttempts) {
                        addDebugLog(`⚠️ Max polling attempts reached. Tier still: ${currentTier}`)
                        clearInterval(pollInterval)
                        setIsRefreshing(false)
                    } else {
                        setIsRefreshing(false)
                    }
                } catch (error) {
                    addDebugLog(`❌ Error refreshing session: ${error instanceof Error ? error.message : String(error)}`)
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
            addDebugLog('Starting automatic tier polling...')
            startPolling()
        }, 2000)

        return () => {
            clearTimeout(initialTimer)
        }
    }, []) // Only run once on mount

    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        addDebugLog('Manual refresh triggered')
        
        try {
            addDebugLog(`Current tier before refresh: ${currentTier}`)
            const updatedSession = await update()
            addDebugLog(`Session updated. New tier: ${updatedSession?.user?.tier || 'unknown'}`)
            
            // Force re-render by refreshing router
            setTimeout(() => {
                router.refresh()
            }, 500)
        } catch (error) {
            addDebugLog(`❌ Manual refresh error: ${error instanceof Error ? error.message : String(error)}`)
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
                            {isRefreshing && ` Checking tier status... (Attempt ${refreshAttempts})`}
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

                {/* Debug info - always show in production for troubleshooting */}
                {debugInfo.length > 0 && (
                    <div className="mt-6 p-4 bg-muted rounded-lg text-left text-xs max-h-40 overflow-y-auto">
                        <div className="font-semibold mb-2">Debug Log:</div>
                        {debugInfo.map((log, idx) => (
                            <div key={idx} className="text-muted-foreground">{log}</div>
                        ))}
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
