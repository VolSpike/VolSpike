'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/use-socket'
import { useTierChangeListener } from '@/hooks/use-tier-change-listener'
import { useClientOnlyMarketData } from '@/hooks/use-client-only-market-data'
import { useAssetDetection } from '@/hooks/use-asset-detection'
import { prefetchAssetManifest } from '@/lib/asset-manifest'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { MarketTable } from '@/components/market-table'
import { AlertPanel } from '@/components/alert-panel'
import { VolumeAlertsPanel } from '@/components/volume-alerts-panel'
import { TierUpgrade } from '@/components/tier-upgrade'
import { SubscriptionStatus } from '@/components/subscription-status'
import { AlertBuilder } from '@/components/alert-builder'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Dashboard() {
    const { data: session, status } = useSession()
    const { socket } = useSocket()
    
    // Listen for tier changes via WebSocket and auto-refresh session
    useTierChangeListener()
    
    const [alerts, setAlerts] = useState<any[]>([])
    const [alertBuilderOpen, setAlertBuilderOpen] = useState(false)
    const [alertBuilderSymbol, setAlertBuilderSymbol] = useState('')
    const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
    const [currentTab, setCurrentTab] = useState<'market' | 'alerts'>(() => {
        if (typeof window === 'undefined') {
            return 'market'
        }
        // On mobile/tablet, surface Volume Alerts first;
        // on desktop, keep Market Data as the primary focus.
        return window.innerWidth < 1280 ? 'alerts' : 'market'
    })

    // Debug session status (development only)
    if (process.env.NODE_ENV !== 'production') {
        console.log('[Dashboard] useSession status:', status)
        console.log('[Dashboard] useSession data:', session ? 'Found' : 'Not found')
        if (session?.user) {
            console.log('[Dashboard] User details:', {
                email: session.user.email,
                tier: (session.user as any).tier,
                role: (session.user as any).role
            })
        }
    }

    // Determine user tier
    const userTier = session?.user?.tier || 'free'

    // Alert builder handlers (defined early to avoid hoisting issues)
    const handleCreateAlert = (symbol: string) => {
        setAlertBuilderSymbol(symbol.replace(/USDT$/i, ''))
        setAlertBuilderOpen(true)
    }

    // Stable callback to avoid reconnect loops
    const handleDataUpdate = useCallback((data: any[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`📊 Market data updated: ${data.length} symbols`)
        }
    }, [])

    // Use client-only market data (no API calls, no Redis)
    const {
        data: marketData,
        lastUpdate,
        nextUpdate,
        isLive,
        isConnecting,
        isReconnecting,
        hasError,
        openInterestAsOf
    } = useClientOnlyMarketData({
        tier: userTier as 'elite' | 'pro' | 'free',
        onDataUpdate: handleDataUpdate
    })

    // Automatically detect new assets from Market Data (runs in background)
    useAssetDetection(marketData)

    // Load asset manifest immediately on dashboard mount for instant asset card display
    useEffect(() => {
        // Load manifest immediately (not just prefetch) to ensure it's ready
        import('@/lib/asset-manifest').then(({ loadAssetManifest }) => {
            loadAssetManifest().catch((err) => {
                console.error('[Dashboard] Failed to load asset manifest:', err)
            })
        })
    }, [])

    useEffect(() => {
        if (!socket) return

        // Subscribe to market updates
        const handleMarketUpdate = (data: any) => {
            if (process.env.NODE_ENV !== 'production') {
                console.log('Market update received:', data)
            }
            // Handle both old and new data formats
            const market = data?.data || data
            if (market) {
                // Currently, client-only WebSocket market data is handled elsewhere.
                // This listener stays in place for future enhancements / server pushes.
            }
        }

        const handleAlertTriggered = (alert: any) => {
            setAlerts(prev => [alert, ...prev.slice(0, 9)]) // Keep last 10 alerts
        }

        socket.on('market-update', handleMarketUpdate)
        socket.on('alert-triggered', handleAlertTriggered)

        return () => {
            socket.off('market-update', handleMarketUpdate)
            socket.off('alert-triggered', handleAlertTriggered)
        }
    }, [socket])

    if (status === 'loading') {
        return <LoadingSpinner />
    }

    // Guest preview if user is not authenticated
    const isGuest = !session?.user

    const marketDataCard = (
        <Card className="group h-full flex flex-col border border-border/60 shadow-md">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <span className="text-foreground">
                        Market Data
                    </span>
                    <span
                        className={`
                            text-sm font-normal px-2 py-0.5 rounded-md border
                            ${
                                isGuest
                                    ? 'bg-muted/70 text-muted-foreground border-border'
                                    : (userTier as string) === 'free'
                                    ? 'bg-muted/70 text-muted-foreground border-border'
                                    : (userTier as string) === 'pro'
                                    ? 'bg-sec-500/20 text-sec-700 dark:text-sec-400 border-sec-500/40'
                                    : 'bg-elite-500/20 text-elite-700 dark:text-elite-400 border-elite-500/40'
                            }
                        `}
                    >
                        {isGuest ? 'PREVIEW' : `${userTier.toUpperCase()} Tier`}
                    </span>
                </CardTitle>
                <CardDescription>
                    {isGuest ? (
                        <span className="text-muted-foreground">Guest Preview • Top 5 symbols visible • Sorting disabled</span>
                    ) : isLive ? (
                        <span className="text-green-500">● Live Data (Binance WebSocket) • Real-time Updates</span>
                    ) : isConnecting ? (
                        <span className="text-yellow-500">● Connecting to Binance...</span>
                    ) : isReconnecting ? (
                        <span className="text-yellow-500">● Reconnecting...</span>
                    ) : hasError ? (
                        <span className="text-red-500">● Connection Failed</span>
                    ) : (
                        <span className="text-blue-500">● Loading...</span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                {isConnecting ? (
                    <LoadingSpinner variant="brand" text="Connecting to Binance WebSocket..." />
                ) : hasError ? (
                    <div className="text-red-500">
                        Connection failed. Please refresh the page.
                    </div>
                ) : marketData.length === 0 ? (
                    <div className="text-yellow-500">
                        No market data available. {isConnecting ? 'Connecting to Binance...' : 'Please check your connection.'}
                    </div>
                ) : (
                    <MarketTable
                        data={marketData}
                        userTier={userTier as 'free' | 'pro' | 'elite'}
                        withContainer={false}
                        lastUpdate={lastUpdate}
                        isConnected={!hasError && !isConnecting}
                        openInterestAsOf={openInterestAsOf}
                        onCreateAlert={handleCreateAlert}
                        guestMode={isGuest}
                        guestVisibleRows={5}
                    />
                )}
            </CardContent>
        </Card>
    )

    const alertsCard = <AlertPanel alerts={alerts} userTier={userTier as 'free' | 'pro' | 'elite'} />
    const volumeAlertsCard = (
        <VolumeAlertsPanel 
            onNewAlert={() => {
                // Only increment if user is on Market Data tab (mobile only)
                if (currentTab === 'market') {
                    setUnreadAlertsCount(prev => prev + 1)
                }
            }}
            guestMode={isGuest}
            guestVisibleCount={2}
        />
    )

    return (
        <div className="flex-1 bg-background relative">
            <BackgroundPattern />
            
            {/* Vibrant multi-layered gradient overlays for depth and color */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/8 via-secondary-500/5 to-tertiary-500/6 dark:from-brand-500/12 dark:via-secondary-500/8 dark:to-tertiary-500/10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-500/3 to-transparent dark:via-brand-500/6 pointer-events-none animate-pulse-glow" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary-500/30 to-transparent" />
            
            <HeaderWithBanner hideWalletConnect={isGuest} />

            <main className="container mx-auto px-4 py-8 relative z-10">
                <div className="space-y-6">
                    {isGuest && (
                        <div className="hidden md:block rounded-lg border border-brand-200/70 bg-brand-50/80 dark:border-border/60 dark:bg-muted/40 p-3 md:p-4 animate-fade-in">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-sm text-brand-900/80 dark:text-muted-foreground">
                                    You’re viewing a guest preview. Top 5 symbols and top 2 alerts are visible. Start Free to unlock full Free features, or upgrade to Pro for 5‑minute updates and Open Interest.
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href="/auth?tab=signup" className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-md shadow-brand-500/20 ring-1 ring-brand-500/20">Start Free</a>
                                    <a href="/pricing" className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-sec-600 text-white hover:bg-sec-700 shadow-md shadow-sec-500/20">Get Pro</a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Subscription Status - Show for authenticated Pro/Elite users */}
                    {!isGuest && (userTier === 'pro' || userTier === 'elite') && (
                        <div className="mb-6 animate-fade-in">
                            <SubscriptionStatus />
                        </div>
                    )}

                    <div className="xl:hidden animate-fade-in">
                        <Tabs 
                            defaultValue="market" 
                            className="w-full"
                            value={currentTab}
                            onValueChange={(value) => {
                                const nextValue = value as 'market' | 'alerts'
                                setCurrentTab(nextValue)
                                // Clear unread count when user switches to alerts tab
                                if (nextValue === 'alerts') {
                                    setUnreadAlertsCount(0)
                                }
                            }}
                        >
                            <TabsList className="grid grid-cols-2 w-full">
                                <TabsTrigger value="market" className="flex-1">Market Data</TabsTrigger>
                                <TabsTrigger value="alerts" className="relative flex-1">
                                    Volume Alerts
                                    {unreadAlertsCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-danger-500 rounded-full animate-badge-scale-pulse shadow-lg">
                                            {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="market" className="mt-4 animate-fade-in">
                                {marketDataCard}
                            </TabsContent>
                            <TabsContent value="alerts" className="mt-4 animate-fade-in">
                                {volumeAlertsCard}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="hidden xl:flex gap-2 animate-fade-in items-stretch">
                        <div className="flex-[3]">
                            {marketDataCard}
                        </div>
                        <div className="flex-1">
                            {volumeAlertsCard}
                        </div>
                    </div>
                </div>
            </main>

            {/* Command Palette & Keyboard Shortcuts */}
            <CommandPalette 
                userTier={userTier as 'free' | 'pro' | 'elite'}
                onCreateAlert={() => {
                    setAlertBuilderSymbol('')
                    setAlertBuilderOpen(true)
                }}
            />
            <KeyboardShortcuts />

            {/* Global Alert Builder (triggered from table) */}
            <AlertBuilder
                open={alertBuilderOpen}
                onOpenChange={setAlertBuilderOpen}
                symbol={alertBuilderSymbol}
                userTier={userTier as 'free' | 'pro' | 'elite'}
            />
        </div>
    )
}
