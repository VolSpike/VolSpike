'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Wallet,
    RefreshCw,
    TrendingUp,
    Settings,
    Loader2,
    ArrowRight,
    Radio,
} from 'lucide-react'
import { MultiChainETHBalance } from './multi-chain-eth-balance'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

interface AdminWallet {
    id: string
    address: string
    currency: string
    network: string | null
    label: string | null
    balance: number | null
    balanceUpdatedAt: string | null
    createdAt: string
    updatedAt: string
}

// Configuration
const AUTO_REFRESH_INTERVAL = 2 * 60 * 1000 // 2 minutes - more frequent updates
const STALE_THRESHOLD = 10 * 60 * 1000 // Consider data stale after 10 minutes (less aggressive)
const FRESH_THRESHOLD = 60 * 1000 // Consider data "live" if updated within 1 minute

export function DashboardWalletBalances() {
    const { data: session } = useSession()
    const router = useRouter()
    const [wallets, setWallets] = useState<AdminWallet[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<number | null>(null)
    const [isLive, setIsLive] = useState(false)
    
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isVisibleRef = useRef(true)

    // Check if data is stale
    const isDataStale = useCallback((updatedAt: string | null): boolean => {
        if (!updatedAt) return true
        const updated = new Date(updatedAt).getTime()
        const now = Date.now()
        return (now - updated) > STALE_THRESHOLD
    }, [])

    // Check if any wallet needs refresh
    const needsRefresh = useCallback((): boolean => {
        if (wallets.length === 0) return false
        return wallets.some(w => isDataStale(w.balanceUpdatedAt))
    }, [wallets, isDataStale])

    const fetchWallets = useCallback(async (silent = false) => {
        if (!session?.accessToken) return

        if (!silent) setLoading(true)
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            if (!response.ok) throw new Error('Failed to fetch wallets')
            const data = await response.json()
            setWallets(data.wallets || [])
            setLastRefresh(Date.now())
            
            // Check if data is fresh (updated within 1 minute)
            const hasFreshData = data.wallets?.some((w: AdminWallet) => {
                if (!w.balanceUpdatedAt) return false
                const updated = new Date(w.balanceUpdatedAt).getTime()
                return (Date.now() - updated) < FRESH_THRESHOLD
            })
            setIsLive(hasFreshData || false)
        } catch (error) {
            console.error('Failed to fetch wallets:', error)
            if (!silent) {
                toast.error('Failed to load wallet balances')
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }, [session])

    const refreshBalances = useCallback(async (showToast = true) => {
        if (!session?.accessToken) return

        setRefreshing(true)
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/refresh-all`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`,
                    },
                }
            )

            if (!response.ok) throw new Error('Failed to refresh balances')
            const data = await response.json()
            
            if (showToast) {
                toast.success(`Refreshed ${data.successful} of ${data.total} wallets`)
            }
            
            // Fetch updated wallet data
            await fetchWallets(true)
        } catch (error) {
            console.error('Failed to refresh balances:', error)
            if (showToast) {
                toast.error('Failed to refresh balances')
            }
        } finally {
            setRefreshing(false)
        }
    }, [session, fetchWallets])

    // Auto-refresh on mount
    useEffect(() => {
        if (session?.accessToken) {
            fetchWallets()
        }
    }, [session, fetchWallets])

    // Auto-refresh balances periodically
    useEffect(() => {
        if (!session?.accessToken || wallets.length === 0) return

        // Initial refresh if data is stale
        if (needsRefresh()) {
            refreshBalances(false)
        }

        // Set up periodic refresh - refresh more aggressively
        refreshIntervalRef.current = setInterval(() => {
            // Refresh if tab is visible (always refresh, not just when stale)
            if (isVisibleRef.current) {
                refreshBalances(false)
            }
        }, AUTO_REFRESH_INTERVAL)

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current)
            }
        }
    }, [session, wallets, needsRefresh, refreshBalances])

    // Page Visibility API - pause refresh when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            isVisibleRef.current = !document.hidden
            
            // If tab becomes visible and data is stale, refresh immediately
            if (!document.hidden && needsRefresh()) {
                refreshBalances(false)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [needsRefresh, refreshBalances])

    const handleManualRefresh = () => {
        refreshBalances(true)
    }

    const formatBalance = (balance: number | null, currency: string) => {
        if (balance === null) return '—'
        const decimals = currency === 'BTC' ? 8 : currency === 'ETH' || currency === 'SOL' ? 6 : 2
        return `${balance.toFixed(decimals)} ${currency}`
    }

    const formatUSD = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    }

    const formatTimeAgo = (dateString: string | null) => {
        if (!dateString) return 'Never'
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${diffDays}d ago`
    }

    // Calculate total balance in USD (simplified - would need price API for real conversion)
    const totalBalance = wallets.reduce((sum, wallet) => {
        if (wallet.balance === null) return sum
        // Rough estimates for display (in production, use real-time price API)
        // USDT and USDC are always $1 regardless of network
        const priceMap: Record<string, number> = {
            BTC: 60000,
            ETH: 3000,
            SOL: 100,
            USDT: 1, // $1 for both Ethereum and Solana
            USDC: 1, // $1
        }
        const price = priceMap[wallet.currency] || 0
        return sum + wallet.balance * price
    }, 0)

    const getCurrencyColor = (currency: string, network?: string | null) => {
        const colors: Record<string, string> = {
            BTC: 'from-orange-500 to-orange-600',
            ETH: 'from-blue-500 to-blue-600',
            SOL: 'from-purple-500 to-purple-600',
            USDT: network?.toLowerCase().includes('sol') 
                ? 'from-green-500 to-emerald-600' 
                : 'from-green-500 to-green-600',
            USDC: 'from-blue-400 to-blue-500',
        }
        return colors[currency] || 'from-gray-500 to-gray-600'
    }

    const getCurrencyDisplayName = (currency: string, network?: string | null) => {
        if (network) {
            if (currency === 'USDT' && network.toLowerCase().includes('sol')) {
                return 'USDT (Solana)'
            }
            if (currency === 'USDT' && network.toLowerCase().includes('eth')) {
                return 'USDT (Ethereum)'
            }
            if (currency === 'USDC' && network.toLowerCase().includes('eth')) {
                return 'USDC (Ethereum)'
            }
        }
        return currency
    }

    const getCurrencyIcon = (currency: string) => {
        return Wallet
    }

    if (loading) {
        return (
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-transparent">
                            <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        Wallet Balances
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (wallets.length === 0) {
        return (
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-transparent">
                                <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <CardTitle>Wallet Balances</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 bg-muted/30 rounded-lg border border-dashed border-border/60">
                        <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">No wallets added yet</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                            Add your wallet addresses in Settings to track balances
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push('/admin/settings')}
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Go to Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm border-border/60">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-transparent">
                            <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <CardTitle>Wallet Balances</CardTitle>
                        {isLive && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs">
                                <Radio className="h-3 w-3 mr-1 animate-pulse" />
                                Live
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {lastRefresh && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                {formatTimeAgo(new Date(lastRefresh).toISOString())}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleManualRefresh}
                            disabled={refreshing}
                            className="text-xs"
                            title="Refresh balances now"
                        >
                            {refreshing ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Refresh
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/admin/settings')}
                            className="text-xs"
                        >
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Manage
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Balance Summary */}
                {totalBalance > 0 && (
                    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent p-4 transition-all duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Total Portfolio Value</p>
                            <div className="flex items-center gap-2">
                                {isLive && (
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                )}
                                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            {formatUSD(totalBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} • Auto-refreshes every 5 min
                        </p>
                    </div>
                )}

                {/* Individual Wallets */}
                <div className="space-y-2">
                    {wallets.map((wallet) => {
                        const CurrencyIcon = getCurrencyIcon(wallet.currency)
                        const gradientClass = getCurrencyColor(wallet.currency, wallet.network)
                        const currencyDisplayName = getCurrencyDisplayName(wallet.currency, wallet.network)
                        const isBalanceLoaded = wallet.balance !== null
                        const isStale = isDataStale(wallet.balanceUpdatedAt)

                        const isETH = wallet.currency.toUpperCase() === 'ETH' && !wallet.network
                        const isUSDC = wallet.currency.toUpperCase() === 'USDC' && wallet.network?.toLowerCase().includes('eth')
                        const isUSDT = wallet.currency.toUpperCase() === 'USDT' && wallet.network?.toLowerCase().includes('eth')

                        return (
                            <div key={wallet.id}>
                                <div
                                    className={`group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 transition-all duration-300 hover:bg-muted/30 hover:border-border ${
                                        isStale ? 'opacity-90' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${gradientClass} flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                                            <CurrencyIcon className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {wallet.label && (
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {wallet.label}
                                                    </span>
                                                )}
                                                <Badge
                                                    variant="outline"
                                                    className={`bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent border-current/20 text-xs font-medium`}
                                                >
                                                    {currencyDisplayName}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p
                                            className={`text-sm font-semibold transition-colors duration-200 ${
                                                isBalanceLoaded
                                                    ? isStale
                                                        ? 'text-muted-foreground'
                                                        : 'text-foreground'
                                                    : 'text-muted-foreground'
                                            }`}
                                        >
                                            {formatBalance(wallet.balance, wallet.currency)}
                                        </p>
                                        {wallet.balanceUpdatedAt && (
                                            <p className="text-xs text-muted-foreground">
                                                {formatTimeAgo(wallet.balanceUpdatedAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {/* Multi-chain balance view for ETH, USDC, and USDT wallets */}
                                {(isETH || isUSDC || isUSDT) && (
                                    <MultiChainETHBalance
                                        walletId={wallet.id}
                                        address={wallet.address}
                                        mainBalance={wallet.balance}
                                        currency={wallet.currency}
                                        network={wallet.network}
                                        onBalanceUpdate={(newBalance) => {
                                            // Update the wallet balance in local state when multi-chain fetch completes
                                            setWallets(prev => prev.map(w => 
                                                w.id === wallet.id 
                                                    ? { ...w, balance: newBalance, balanceUpdatedAt: new Date().toISOString() }
                                                    : w
                                            ))
                                        }}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Quick Link to Settings */}
                <div className="pt-2 border-t border-border/60">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/admin/settings')}
                        className="w-full justify-between text-muted-foreground hover:text-foreground"
                    >
                        <span className="text-sm">Manage wallets in Settings</span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
