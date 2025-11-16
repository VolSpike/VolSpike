'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    Coins,
    Sparkles,
    Crown,
} from 'lucide-react'
import { adminAPI } from '@/lib/admin/api-client'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

interface RevenueBreakdownProps {
    totalRevenue: number
}

interface RevenueMetrics {
    totalRevenue: number
    monthlyRecurringRevenue: number
    revenueByTier: {
        free: number
        pro: number
        elite: number
    }
    revenueBySource?: {
        crypto: number
        stripe: number
    }
    cryptoCurrencyBreakdown?: Array<{
        currency: string
        amount: number
        usdValue: number
        count: number
    }>
    revenueGrowth: any[]
    topCustomers: any[]
}

export function RevenueBreakdown({ totalRevenue }: RevenueBreakdownProps) {
    const { data: session } = useSession()
    const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (session?.accessToken) {
            fetchRevenueBreakdown()
        }
    }, [session])

    const fetchRevenueBreakdown = async () => {
        if (!session?.accessToken) return

        setLoading(true)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const metrics = await adminAPI.getRevenueMetrics('30d')
            setRevenueMetrics(metrics)
        } catch (error) {
            console.error('Failed to fetch revenue breakdown:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    }

    const formatCrypto = (amount: number, decimals: number = 6) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(amount)
    }

    const getPercentage = (value: number, total: number) => {
        if (total === 0) return 0
        return Math.round((value / total) * 100)
    }

    // Format currency display name (e.g., "USDCE" -> "USDC (Ethereum)")
    const formatCurrencyDisplayName = (currency: string): string => {
        const upper = currency.toUpperCase()
        
        // Handle NowPayments currency codes
        // USDCE = USDC on Ethereum
        if (upper === 'USDCE' || upper === 'USDC-E') {
            return 'USDC (Ethereum)'
        }
        // USDTE = USDT on Ethereum
        if (upper === 'USDTE' || upper === 'USDT-E') {
            return 'USDT (Ethereum)'
        }
        // USDTS = USDT on Solana
        if (upper === 'USDTS' || upper === 'USDT-S') {
            return 'USDT (Solana)'
        }
        // Standard currencies
        if (upper === 'BTC') return 'Bitcoin'
        if (upper === 'ETH') return 'Ethereum'
        if (upper === 'SOL') return 'Solana'
        if (upper === 'USDC') return 'USDC'
        if (upper === 'USDT') return 'USDT'
        
        // Fallback: return as-is if unknown
        return upper
    }

    const cryptoRevenue = revenueMetrics?.revenueBySource?.crypto || 0
    const stripeRevenue = revenueMetrics?.revenueBySource?.stripe || 0
    const proRevenue = revenueMetrics?.revenueByTier?.pro || 0
    const eliteRevenue = revenueMetrics?.revenueByTier?.elite || 0
    const mrr = revenueMetrics?.monthlyRecurringRevenue || 0
    const cryptoCurrencyBreakdown = revenueMetrics?.cryptoCurrencyBreakdown || []

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-elite-500/10 via-elite-400/10 to-transparent">
                            <DollarSign className="h-5 w-5 text-elite-600 dark:text-elite-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold">Revenue</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Lifetime revenue breakdown
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Revenue - Prominent Display */}
                <div className="flex items-baseline justify-between pb-4 border-b border-border/60">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-elite-500 to-elite-600 bg-clip-text text-transparent">
                            {formatCurrency(totalRevenue)}
                        </p>
                    </div>
                    {mrr > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">MRR</p>
                            <p className="text-sm font-semibold text-elite-600 dark:text-elite-400">
                                {formatCurrency(mrr)}/mo
                            </p>
                        </div>
                    )}
                </div>

                {/* Always Show Breakdown */}
                {totalRevenue > 0 && (
                    <div className="space-y-4 pt-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                {/* Payment Source Breakdown - Elegant Side-by-Side */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        By Payment Source
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Crypto Payments */}
                                        <div className="p-3 rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/5 to-brand-600/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10">
                                                    <Coins className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                                                </div>
                                                <span className="text-xs font-medium text-foreground/80">Crypto</span>
                                            </div>
                                            <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mb-0.5">
                                                {formatCurrency(cryptoRevenue)}
                                            </p>
                                            {cryptoRevenue > 0 && stripeRevenue > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    {getPercentage(cryptoRevenue, totalRevenue)}% of total
                                                </p>
                                            )}
                                        </div>

                                        {/* Stripe Payments */}
                                        <div className="p-3 rounded-xl border border-sec-500/20 bg-gradient-to-br from-sec-500/5 to-sec-600/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sec-500/10">
                                                    <CreditCard className="h-3.5 w-3.5 text-sec-600 dark:text-sec-400" />
                                                </div>
                                                <span className="text-xs font-medium text-foreground/80">Stripe</span>
                                            </div>
                                            <p className="text-lg font-bold text-sec-600 dark:text-sec-400 mb-0.5">
                                                {formatCurrency(stripeRevenue)}
                                            </p>
                                            {cryptoRevenue > 0 && stripeRevenue > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    {getPercentage(stripeRevenue, totalRevenue)}% of total
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Crypto Currency Breakdown */}
                                {cryptoCurrencyBreakdown.length > 0 && (
                                    <div className="space-y-3 pt-2 border-t border-border/60">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            Crypto Payments by Currency
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {cryptoCurrencyBreakdown.map((item) => {
                                                const displayName = formatCurrencyDisplayName(item.currency)
                                                // Extract base currency for amount display
                                                const upper = item.currency.toUpperCase()
                                                let baseCurrency = upper
                                                if (upper.endsWith('E') || upper.endsWith('-E')) {
                                                    baseCurrency = upper.replace(/E$/, '').replace(/-E$/, '')
                                                } else if (upper.endsWith('S') || upper.endsWith('-S')) {
                                                    baseCurrency = upper.replace(/S$/, '').replace(/-S$/, '')
                                                }
                                                
                                                return (
                                                    <div key={item.currency} className="p-2.5 rounded-lg border border-brand-500/15 bg-brand-500/5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 text-xs font-medium">
                                                                    {displayName}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {item.count} payment{item.count !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                                                    {formatCurrency(item.usdValue)}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {formatCrypto(item.amount)} {baseCurrency}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tier Breakdown - Elegant Grid */}
                                {(proRevenue > 0 || eliteRevenue > 0) && (
                                    <div className="space-y-3 pt-2 border-t border-border/60">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            By Tier
                                        </h4>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Pro Tier */}
                                            {proRevenue > 0 && (
                                                <div className="p-3 rounded-xl border border-sec-500/20 bg-gradient-to-br from-sec-500/5 to-sec-600/5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sec-500/10">
                                                            <Sparkles className="h-3.5 w-3.5 text-sec-600 dark:text-sec-400" />
                                                        </div>
                                                        <span className="text-xs font-medium text-foreground/80">Pro</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-sec-600 dark:text-sec-400 mb-0.5">
                                                        {formatCurrency(proRevenue)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {getPercentage(proRevenue, totalRevenue)}% of total
                                                    </p>
                                                </div>
                                            )}

                                            {/* Elite Tier */}
                                            {eliteRevenue > 0 && (
                                                <div className="p-3 rounded-xl border border-elite-500/20 bg-gradient-to-br from-elite-500/5 to-elite-600/5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-elite-500/10">
                                                            <Crown className="h-3.5 w-3.5 text-elite-600 dark:text-elite-400" />
                                                        </div>
                                                        <span className="text-xs font-medium text-foreground/80">Elite</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-elite-600 dark:text-elite-400 mb-0.5">
                                                        {formatCurrency(eliteRevenue)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {getPercentage(eliteRevenue, totalRevenue)}% of total
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {totalRevenue === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 bg-muted/30 rounded-lg border border-dashed border-border/60">
                        <DollarSign className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">No revenue recorded yet</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                            Revenue will appear here once payments are processed
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
