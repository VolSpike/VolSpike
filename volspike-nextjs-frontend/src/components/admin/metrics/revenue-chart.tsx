'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format, parseISO } from 'date-fns'
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { adminAPI } from '@/lib/admin/api-client'
import { ArrowUpRight, CreditCard, Wallet } from 'lucide-react'

type RevenueAnalytics = {
    dailyRevenue: Array<{
        date: string
        total: number
        crypto: number
        stripe: number
        pro: number
        elite: number
    }>
    summary: {
        today: { total: number; crypto: number; stripe: number }
        thisWeek: { total: number; crypto: number; stripe: number }
        thisMonth: { total: number; crypto: number; stripe: number }
        thisYear: { total: number; crypto: number; stripe: number }
        allTime: { total: number; crypto: number; stripe: number }
    }
    period: string
}

const PERIODS = [
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: '1y', value: '1y' },
]

export function RevenueChart() {
    const { data: session } = useSession()
    const [period, setPeriod] = useState<string>('30d')
    const [data, setData] = useState<RevenueAnalytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            if (!session?.accessToken) {
                setLoading(false)
                setError('No admin session detected')
                return
            }

            setLoading(true)
            setError(null)

            try {
                adminAPI.setAccessToken(session.accessToken as string)
                const analytics = await adminAPI.getRevenueAnalytics(period)
                if (mounted) {
                    setData(analytics)
                }
            } catch (err) {
                console.error('[RevenueChart] Failed to load revenue analytics', err)
                if (mounted) {
                    setError('Unable to load revenue data')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        load()
        return () => {
            mounted = false
        }
    }, [session?.accessToken, period])

    const chartData = useMemo(() => {
        if (!data?.dailyRevenue?.length) return []

        return data.dailyRevenue.map((item) => ({
            ...item,
            label: format(parseISO(item.date), 'MMM d'),
        }))
    }, [data])

    const periodTotal = useMemo(() => {
        if (!data?.dailyRevenue?.length) return 0
        const sum = data.dailyRevenue.reduce((acc, cur) => acc + cur.total, 0)
        return Math.round(sum * 100) / 100
    }, [data])

    const cryptoShare = useMemo(() => {
        if (!data?.dailyRevenue?.length) return 0
        const crypto = data.dailyRevenue.reduce((acc, cur) => acc + cur.crypto, 0)
        return periodTotal === 0 ? 0 : (crypto / periodTotal) * 100
    }, [data, periodTotal])

    const stripeShare = periodTotal === 0 ? 0 : Math.max(0, 100 - cryptoShare)

    if (loading) {
        return (
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span>Revenue Overview</span>
                        <Badge variant="outline">Refreshing…</Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setPeriod(p.value)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    <LoadingSpinner text="Loading live revenue from Stripe + crypto" variant="brand" />
                </CardContent>
            </Card>
        )
    }

    if (error || !data) {
        return (
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span>Revenue Overview</span>
                        <Badge variant="outline">Fallback</Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setPeriod(p.value)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {error || 'No revenue data available for this range.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setPeriod(period)}>
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-emerald-500 to-cyan-500 opacity-40" />
            <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                        <span>Revenue Overview</span>
                        <Badge variant="outline" className="capitalize">
                            {period}
                        </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setPeriod(p.value)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground uppercase mb-1 tracking-wide">
                            Period Total
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold">${periodTotal.toLocaleString()}</span>
                            <Badge variant="outline" className="text-xs">
                                {data?.dailyRevenue?.length || 0} days
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Live Stripe + crypto receipts</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <CreditCard className="h-4 w-4 text-brand-500" />
                                Stripe
                            </div>
                            <Badge variant="secondary">{stripeShare.toFixed(1)}%</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ${data.summary.thisMonth.stripe.toLocaleString()} this month
                        </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                Crypto
                            </div>
                            <Badge variant="secondary">{cryptoShare.toFixed(1)}%</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ${data.summary.thisMonth.crypto.toLocaleString()} this month
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                {chartData.length === 0 ? (
                    <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                        No revenue events yet for this window.
                    </div>
                ) : (
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="revStripe" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="revCrypto" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} dy={8} />
                                <YAxis
                                    tickFormatter={(v) => `$${v}`}
                                    width={60}
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0b1224',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: 10,
                                    }}
                                    formatter={(value: number, name) => [
                                        `$${value.toLocaleString()}`,
                                        name.charAt(0).toUpperCase() + name.slice(1),
                                    ]}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    name="Total"
                                    stroke="#10b981"
                                    fill="url(#revTotal)"
                                    strokeWidth={2.4}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="stripe"
                                    name="Stripe"
                                    stroke="#6366f1"
                                    fill="url(#revStripe)"
                                    strokeWidth={1.8}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="crypto"
                                    name="Crypto"
                                    stroke="#22d3ee"
                                    fill="url(#revCrypto)"
                                    strokeWidth={1.8}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    <span>
                        Live totals combine Stripe invoices and finished crypto payments; data refreshes every load.
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
