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
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-transparent">
                            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold">Revenue</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Lifetime revenue breakdown
                            </p>
                        </div>
                    </div>
                    {totalRevenue > 0 && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Active
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Revenue - Prominent Display */}
                <div className="flex items-baseline justify-between pb-4 border-b border-border/60">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {formatCurrency(totalRevenue)}
                        </p>
                    </div>
                    {mrr > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">MRR</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
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
                                {/* Payment Source Breakdown */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        By Payment Source
                                    </h4>
                                    
                                    {/* Crypto Payments */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                                                    <Coins className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                                </div>
                                                <span className="text-sm font-medium">Crypto Payments</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold">
                                                    {formatCurrency(cryptoRevenue)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {getPercentage(cryptoRevenue, totalRevenue)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                                                style={{ width: `${getPercentage(cryptoRevenue, totalRevenue)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stripe Payments */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="text-sm font-medium">Stripe Payments</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold">
                                                    {formatCurrency(stripeRevenue)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {getPercentage(stripeRevenue, totalRevenue)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                                style={{ width: `${getPercentage(stripeRevenue, totalRevenue)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Crypto Currency Breakdown */}
                                {cryptoCurrencyBreakdown.length > 0 && (
                                    <div className="space-y-3 pt-2 border-t border-border/60">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            Crypto Payments by Currency
                                        </h4>
                                        <div className="space-y-2">
                                            {cryptoCurrencyBreakdown.map((item) => (
                                                <div key={item.currency} className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-xs font-medium">
                                                                {item.currency}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                {item.count} payment{item.count !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold">
                                                                {formatCurrency(item.usdValue)}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatCrypto(item.amount)} {item.currency}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                                                            style={{ width: `${getPercentage(item.usdValue, cryptoRevenue)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tier Breakdown */}
                                {(proRevenue > 0 || eliteRevenue > 0) && (
                                    <div className="space-y-3 pt-2 border-t border-border/60">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            By Tier
                                        </h4>
                                        
                                        {/* Pro Tier */}
                                        {proRevenue > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                                            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <span className="text-sm font-medium">Pro Tier</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold">
                                                            {formatCurrency(proRevenue)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {getPercentage(proRevenue, totalRevenue)}%
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                                        style={{ width: `${getPercentage(proRevenue, totalRevenue)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Elite Tier */}
                                        {eliteRevenue > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                                                            <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                        </div>
                                                        <span className="text-sm font-medium">Elite Tier</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold">
                                                            {formatCurrency(eliteRevenue)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {getPercentage(eliteRevenue, totalRevenue)}%
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                                                        style={{ width: `${getPercentage(eliteRevenue, totalRevenue)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
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
