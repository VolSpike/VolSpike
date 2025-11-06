'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/use-socket'
import { useClientOnlyMarketData } from '@/hooks/use-client-only-market-data'
import { Header } from '@/components/header'
import { MarketTable } from '@/components/market-table'
import { AlertPanel } from '@/components/alert-panel'
import { VolumeAlertsPanel } from '@/components/volume-alerts-panel'
import { TierUpgrade } from '@/components/tier-upgrade'
import { AdBanner } from '@/components/ad-banner'
import { AlertBuilder } from '@/components/alert-builder'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Dashboard() {
    const { data: session, status } = useSession()
    const { socket, isConnected } = useSocket()
    const [alerts, setAlerts] = useState<any[]>([])
    const [countdownDisplay, setCountdownDisplay] = useState<string>('')
    const [alertBuilderOpen, setAlertBuilderOpen] = useState(false)
    const [alertBuilderSymbol, setAlertBuilderSymbol] = useState('')
    const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
    const [currentTab, setCurrentTab] = useState('market')

    // Debug session status
    console.log('[Dashboard] useSession status:', status)
    console.log('[Dashboard] useSession data:', session ? 'Found' : 'Not found')
    if (session?.user) {
        console.log('[Dashboard] User details:', {
            email: session.user.email,
            tier: (session.user as any).tier,
            role: (session.user as any).role
        })
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
        console.log(`📊 Market data updated: ${data.length} symbols`)
    }, [])

    // Use client-only market data (no API calls, no Redis)
    const {
        data: marketData,
        lastUpdate,
        nextUpdate,
        isLive,
        isConnecting,
        isReconnecting,
        hasError
    } = useClientOnlyMarketData({
        tier: userTier as 'elite' | 'pro' | 'free',
        onDataUpdate: handleDataUpdate
    })

    // Real-time countdown timer for next update (non-elite tiers)
    useEffect(() => {
        if (userTier === 'elite' || nextUpdate === 0) {
            setCountdownDisplay('')
            return
        }

        const updateCountdown = () => {
            const now = Date.now()
            const remaining = Math.max(0, nextUpdate - now)

            if (remaining === 0) {
                setCountdownDisplay('')
                return
            }

            const minutes = Math.floor(remaining / 60000)
            const seconds = Math.floor((remaining % 60000) / 1000)
            setCountdownDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }

        // Update immediately
        updateCountdown()

        // Update every second
        const interval = setInterval(updateCountdown, 1000)

        return () => clearInterval(interval)
    }, [nextUpdate, userTier])

    useEffect(() => {
        if (socket && isConnected) {
            // Subscribe to market updates
            socket.on('market-update', (data) => {
                console.log('Market update received:', data)
                // Handle both old and new data formats
                const marketData = data.data || data
                if (marketData) {
                    // Update the market data in the UI
                    // This will trigger a re-render with fresh data
                }
            })

            // Subscribe to alerts
            socket.on('alert-triggered', (alert) => {
                setAlerts(prev => [alert, ...prev.slice(0, 9)]) // Keep last 10 alerts
            })

            return () => {
                socket.off('market-update')
                socket.off('alert-triggered')
            }
        }
    }, [socket, isConnected])

    if (status === 'loading') {
        return <LoadingSpinner />
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Welcome to VolSpike</CardTitle>
                        <CardDescription>
                            Sign in to access real-time volume spike alerts for Binance perpetual futures
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TierUpgrade />
                    </CardContent>
                </Card>
            </div>
        )
    }

    const marketDataCard = (
        <Card className="group h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <span className="text-foreground">
                        Market Data
                    </span>
                    <span className="text-sm font-normal text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50 border border-border">
                        {userTier.toUpperCase()} Tier
                    </span>
                </CardTitle>
                <CardDescription>
                    {isLive ? (
                        <span className="text-green-500">● Live Data (Binance WebSocket)</span>
                    ) : isConnecting ? (
                        <span className="text-yellow-500">● Connecting to Binance...</span>
                    ) : isReconnecting ? (
                        <span className="text-yellow-500">● Reconnecting...</span>
                    ) : hasError ? (
                        <span className="text-red-500">● Connection Failed</span>
                    ) : (
                        <span className="text-blue-500">● Loading...</span>
                    )}
                    {lastUpdate > 0 && (
                        <span className="ml-2 text-gray-500">
                            (Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago)
                        </span>
                    )}
                    {countdownDisplay && (
                        <span className="ml-2 text-blue-500">
                            • Next update in {countdownDisplay}
                        </span>
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
                        onCreateAlert={handleCreateAlert}
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
        />
    )

    return (
        <div className="flex-1 bg-background relative min-h-screen">
            <BackgroundPattern />
            
            {/* Vibrant multi-layered gradient overlays for depth and color */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/8 via-secondary-500/5 to-tertiary-500/6 dark:from-brand-500/12 dark:via-secondary-500/8 dark:to-tertiary-500/10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-500/3 to-transparent dark:via-brand-500/6 pointer-events-none animate-pulse-glow" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary-500/30 to-transparent" />
            
            <Header />

            <main className="container mx-auto px-4 py-8 relative z-10">
                <div className="space-y-6">
                    {/* Advertisement Banner for Free Tier Users */}
                    <div className="min-h-0 transition-all duration-300">
                    {userTier === 'free' && (
                        <AdBanner userTier={userTier} />
                    )}
                    </div>
                    <div className="lg:hidden animate-fade-in">
                        <Tabs 
                            defaultValue="market" 
                            className="w-full"
                            value={currentTab}
                            onValueChange={(value) => {
                                setCurrentTab(value)
                                // Clear unread count when user switches to alerts tab
                                if (value === 'alerts') {
                                    setUnreadAlertsCount(0)
                                }
                            }}
                        >
                            <TabsList className="grid grid-cols-2 w-full">
                                <TabsTrigger value="market" className="flex-1">Market Data</TabsTrigger>
                                <TabsTrigger value="alerts" className="relative flex-1">
                                    Volume Alerts
                                    {unreadAlertsCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-danger-500 rounded-full animate-pulse">
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

                    <div className="hidden lg:flex gap-4 animate-fade-in h-full">
                        <div className="flex-1 lg:w-3/4 flex">
                            {marketDataCard}
                        </div>
                        <div className="lg:w-1/4 flex">
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
