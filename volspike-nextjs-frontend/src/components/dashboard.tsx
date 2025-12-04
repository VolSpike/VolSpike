'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/use-socket'
import { useTierChangeListener } from '@/hooks/use-tier-change-listener'
import { useClientOnlyMarketData } from '@/hooks/use-client-only-market-data'
import { useAssetDetection } from '@/hooks/use-asset-detection'
import { loadAssetManifest } from '@/lib/asset-manifest'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { MarketTable } from '@/components/market-table'
import { AlertPanel } from '@/components/alert-panel'
import { AlertsPanel } from '@/components/alerts-panel'
import { useVolumeAlerts } from '@/hooks/use-volume-alerts'
import { useOIAlerts } from '@/hooks/use-oi-alerts'
import { TierUpgrade } from '@/components/tier-upgrade'
import { SubscriptionStatus } from '@/components/subscription-status'
import { AlertBuilder } from '@/components/alert-builder'
import { CommandPalette } from '@/components/command-palette'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarketNewsPane } from '@/components/market-news-pane'

export function Dashboard() {
    const { data: session, status } = useSession()
    const { socket } = useSocket()
    
    // Listen for tier changes via WebSocket and auto-refresh session
    useTierChangeListener()
    
    const [alerts, setAlerts] = useState<any[]>([])
    const [alertBuilderOpen, setAlertBuilderOpen] = useState(false)
    const [alertBuilderSymbol, setAlertBuilderSymbol] = useState('')
    const [currentTab, setCurrentTab] = useState<'market' | 'alerts'>(() => {
        if (typeof window === 'undefined') {
            return 'market'
        }
        // On mobile/tablet, surface Volume Alerts first;
        // on desktop, keep Market Data as the primary focus.
        return window.innerWidth < 1280 ? 'alerts' : 'market'
    })

    // Unified unread alert counts (shared between mobile and desktop views)
    const [unreadVolumeCount, setUnreadVolumeCount] = useState(0)
    const [unreadOICount, setUnreadOICount] = useState(0)
    const [activeAlertsTab, setActiveAlertsTab] = useState<'volume' | 'oi'>('volume')
    const prevVolumeAlertsRef = useRef<string[]>([])
    const prevOIAlertsRef = useRef<string[]>([])

    // Total unread count for the main "Alerts" tab badge (mobile view)
    const totalUnreadCount = unreadVolumeCount + unreadOICount

    // Session status tracking (debug logs removed per user request)

    // Determine user tier
    const userTier = session?.user?.tier || 'free'
    const canAccessOIAlerts = userTier === 'pro' || userTier === 'elite'

    // Use hooks to track alerts for unread counting
    // Note: AlertsPanel also uses these hooks, but we need them here to track counts
    const { alerts: volumeAlerts } = useVolumeAlerts({
        pollInterval: 15000,
        autoFetch: true,
    })

    const { alerts: oiAlerts } = useOIAlerts({
        autoFetch: canAccessOIAlerts,
    })

    // Track new volume alerts for unread count
    useEffect(() => {
        if (volumeAlerts.length === 0) return

        const currentIds = volumeAlerts.map(a => a.id)
        const prevIds = prevVolumeAlertsRef.current

        // Only count new alerts if we have previous data (not initial load)
        // AND user is not currently viewing volume alerts
        if (prevIds.length > 0 && activeAlertsTab !== 'volume') {
            const newCount = currentIds.filter(id => !prevIds.includes(id)).length
            if (newCount > 0) {
                setUnreadVolumeCount(prev => prev + newCount)
            }
        }

        prevVolumeAlertsRef.current = currentIds
    }, [volumeAlerts, activeAlertsTab])

    // Track new OI alerts for unread count
    useEffect(() => {
        if (!canAccessOIAlerts || oiAlerts.length === 0) return

        const currentIds = oiAlerts.map(a => a.id)
        const prevIds = prevOIAlertsRef.current

        // Only count new alerts if we have previous data (not initial load)
        // AND user is not currently viewing OI alerts
        if (prevIds.length > 0 && activeAlertsTab !== 'oi') {
            const newCount = currentIds.filter(id => !prevIds.includes(id)).length
            if (newCount > 0) {
                setUnreadOICount(prev => prev + newCount)
            }
        }

        prevOIAlertsRef.current = currentIds
    }, [oiAlerts, activeAlertsTab, canAccessOIAlerts])

    // Handle active alerts tab change - clear the appropriate unread count
    const handleActiveAlertsTabChange = useCallback((tab: 'volume' | 'oi') => {
        setActiveAlertsTab(tab)
        if (tab === 'volume') {
            setUnreadVolumeCount(0)
            prevVolumeAlertsRef.current = volumeAlerts.map(a => a.id)
        } else if (tab === 'oi') {
            setUnreadOICount(0)
            prevOIAlertsRef.current = oiAlerts.map(a => a.id)
        }
    }, [volumeAlerts, oiAlerts])

    // Legacy callback for volume alert sound (still needed by AlertsPanel)
    const handleNewVolumeAlert = useCallback(() => {
        // This callback is for sound/animation, unread counting is now handled via useEffect
    }, [])

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

    // Track selected watchlist to pass symbols to hook
    const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
    const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])

    // Use client-only market data (no API calls, no Redis)
    // Pass watchlist symbols so they're included even if outside tier limits
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
        onDataUpdate: handleDataUpdate,
        watchlistSymbols: watchlistSymbols
    })
    
    // Handle watchlist filter change from MarketTable
    const handleWatchlistFilterChange = useCallback((watchlistId: string | null, symbols?: string[]) => {
        setSelectedWatchlistId(watchlistId)
        setWatchlistSymbols(symbols || [])
    }, [])

    // Automatically detect new assets from Market Data (runs in background)
    useAssetDetection(marketData)

    // Preload asset manifest on dashboard mount
    // Manifest is already preloaded from localStorage on module load, so this just ensures
    // fresh data is fetched from backend if cache is stale
    useEffect(() => {
        loadAssetManifest().catch(() => {
            // Silently handle errors - manifest will retry on next access
        })
    }, [])

    useEffect(() => {
        if (!socket) return

        // Subscribe to market updates
        const handleMarketUpdate = (data: any) => {
            // Market update handler (debug logs removed)
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
                        watchlistFilterId={selectedWatchlistId}
                        onWatchlistFilterChange={handleWatchlistFilterChange}
                    />
                )}
            </CardContent>
        </Card>
    )

    const alertsCard = <AlertPanel alerts={alerts} userTier={userTier as 'free' | 'pro' | 'elite'} />
    const alertsPanelCard = (
        <AlertsPanel
            onNewAlert={handleNewVolumeAlert}
            guestMode={isGuest}
            guestVisibleCount={2}
            unreadVolumeCount={unreadVolumeCount}
            unreadOICount={unreadOICount}
            activeAlertsTab={activeAlertsTab}
            onActiveTabChange={handleActiveAlertsTabChange}
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

                    <div className="xl:hidden animate-fade-in space-y-4">
                        <Tabs
                            defaultValue="market"
                            className="w-full"
                            value={currentTab}
                            onValueChange={(value) => {
                                const nextValue = value as 'market' | 'alerts'
                                setCurrentTab(nextValue)
                            }}
                        >
                            <TabsList className="grid grid-cols-2 w-full">
                                <TabsTrigger value="market" className="flex-1">Market Data</TabsTrigger>
                                <TabsTrigger value="alerts" className="relative flex-1">
                                    Alerts
                                    {/* Show badge with total unread count when on Market Data tab */}
                                    {totalUnreadCount > 0 && currentTab !== 'alerts' && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-danger-500 rounded-full animate-badge-scale-pulse shadow-lg">
                                            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="market" className="mt-4 animate-fade-in">
                                {marketDataCard}
                            </TabsContent>
                            <TabsContent value="alerts" className="mt-4 animate-fade-in">
                                {alertsPanelCard}
                            </TabsContent>
                        </Tabs>

                        {/* Market News Pane - Mobile (below Market Data/Alerts) */}
                        <MarketNewsPane maxMessages={20} pollInterval={30000} />
                    </div>

                    <div className="hidden xl:flex flex-col gap-4 animate-fade-in">
                        {/* Market Data and Alerts side by side - fixed height to fit news below */}
                        <div className="flex gap-2 items-stretch h-[calc(100vh-380px)]">
                            <div className="flex-[3] min-h-0">
                                {marketDataCard}
                            </div>
                            <div className="flex-1 min-h-0">
                                {/* Side-by-side pane mode: compact layout (Price+OI line 1, Funding line 2) */}
                                <AlertsPanel
                                    onNewAlert={handleNewVolumeAlert}
                                    guestMode={isGuest}
                                    guestVisibleCount={2}
                                    compact={true}
                                    unreadVolumeCount={unreadVolumeCount}
                                    unreadOICount={unreadOICount}
                                    activeAlertsTab={activeAlertsTab}
                                    onActiveTabChange={handleActiveAlertsTabChange}
                                />
                            </div>
                        </div>

                        {/* Market News Pane - Desktop (below Market Data/Alerts) */}
                        <MarketNewsPane maxMessages={30} pollInterval={30000} />
                    </div>
                </div>
            </main>

            {/* Command Palette */}
            <CommandPalette 
                userTier={userTier as 'free' | 'pro' | 'elite'}
                onCreateAlert={() => {
                    setAlertBuilderSymbol('')
                    setAlertBuilderOpen(true)
                }}
            />

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
