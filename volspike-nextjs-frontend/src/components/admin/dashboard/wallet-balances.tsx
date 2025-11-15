'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
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

export function DashboardWalletBalances() {
    const { data: session } = useSession()
    const router = useRouter()
    const [wallets, setWallets] = useState<AdminWallet[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        if (session?.accessToken) {
            fetchWallets()
        }
    }, [session])

    const fetchWallets = async () => {
        if (!session?.accessToken) return

        setLoading(true)
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
        } catch (error) {
            console.error('Failed to fetch wallets:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRefreshAll = async () => {
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
            toast.success(`Refreshed ${data.successful} of ${data.total} wallets`)
            fetchWallets()
        } catch (error) {
            toast.error('Failed to refresh balances')
        } finally {
            setRefreshing(false)
        }
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

    // Calculate total balance in USD (simplified - would need price API for real conversion)
    const totalBalance = wallets.reduce((sum, wallet) => {
        if (wallet.balance === null) return sum
        // Rough estimates for display (in production, use real-time price API)
        const priceMap: Record<string, number> = {
            BTC: 60000,
            ETH: 3000,
            SOL: 100,
            USDT: 1,
            USDC: 1,
        }
        const price = priceMap[wallet.currency] || 0
        return sum + wallet.balance * price
    }, 0)

    const getCurrencyColor = (currency: string) => {
        const colors: Record<string, string> = {
            BTC: 'from-orange-500 to-orange-600',
            ETH: 'from-blue-500 to-blue-600',
            SOL: 'from-purple-500 to-purple-600',
            USDT: 'from-green-500 to-green-600',
            USDC: 'from-blue-400 to-blue-500',
        }
        return colors[currency] || 'from-gray-500 to-gray-600'
    }

    const getCurrencyIcon = (currency: string) => {
        // Using Wallet icon for all, but could use specific icons per currency
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
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefreshAll}
                            disabled={refreshing}
                            className="text-xs"
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
                    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Total Portfolio Value</p>
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            {formatUSD(totalBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}

                {/* Individual Wallets */}
                <div className="space-y-2">
                    {wallets.map((wallet) => {
                        const CurrencyIcon = getCurrencyIcon(wallet.currency)
                        const gradientClass = getCurrencyColor(wallet.currency)
                        const isBalanceLoaded = wallet.balance !== null

                        return (
                            <div
                                key={wallet.id}
                                className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 transition-all duration-200 hover:bg-muted/30 hover:border-border"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${gradientClass} flex-shrink-0`}>
                                        <CurrencyIcon className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {wallet.label && (
                                                <span className="text-sm font-medium text-foreground truncate">
                                                    {wallet.label}
                                                </span>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className={`bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent border-current/20 text-xs font-medium`}
                                            >
                                                {wallet.currency}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right ml-4 flex-shrink-0">
                                    <p
                                        className={`text-sm font-semibold ${
                                            isBalanceLoaded
                                                ? 'text-foreground'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        {formatBalance(wallet.balance, wallet.currency)}
                                    </p>
                                    {wallet.balanceUpdatedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(wallet.balanceUpdatedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
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

