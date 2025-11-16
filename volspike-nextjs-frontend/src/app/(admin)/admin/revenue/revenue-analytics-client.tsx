'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { adminAPI } from '@/lib/admin/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Loader2,
    CreditCard,
    Coins,
    Sparkles,
    Crown,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'

interface RevenueAnalyticsData {
    dailyRevenue: Array<{
        date: string
        total: number
        crypto: number
        stripe: number
        pro: number
        elite: number
    }>
    monthlyRevenue: Array<{
        month: string
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
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' },
    { value: 'all', label: 'All Time' },
]

export default function RevenueAnalyticsClient() {
    const { data: session } = useSession()
    const [data, setData] = useState<RevenueAnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [period, setPeriod] = useState<string>('1y')

    useEffect(() => {
        fetchData()
    }, [session, period])

    const fetchData = async () => {
        if (!session?.accessToken) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const analytics = await adminAPI.getRevenueAnalytics(period)
            setData(analytics)
        } catch (err) {
            console.error('[RevenueAnalytics] Failed to fetch analytics:', err)
            setError('Failed to load revenue analytics')
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

    const formatDate = (dateString: string) => {
        try {
            return format(parseISO(dateString), 'MMM d')
        } catch {
            return dateString
        }
    }

    const formatMonth = (monthString: string) => {
        try {
            return format(parseISO(`${monthString}-01`), 'MMM yyyy')
        } catch {
            return monthString
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Loading revenue analytics...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                    <Button onClick={fetchData} variant="outline">
                        Retry
                    </Button>
                </div>
            </div>
        )
    }

    if (!data) {
        return null
    }

    // Prepare chart data
    const dailyChartData = data.dailyRevenue.map((item) => ({
        ...item,
        dateLabel: formatDate(item.date),
    }))

    const monthlyChartData = data.monthlyRevenue.map((item) => ({
        ...item,
        monthLabel: formatMonth(item.month),
    }))

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return ((current - previous) / previous) * 100
    }

    const todayGrowth = calculateGrowth(data.summary.today.total, data.summary.thisWeek.total / 7)
    const weekGrowth = calculateGrowth(data.summary.thisWeek.total, data.summary.thisMonth.total / 4)
    const monthGrowth = calculateGrowth(data.summary.thisMonth.total, data.summary.thisYear.total / 12)
    const yearGrowth = calculateGrowth(
        data.summary.thisYear.total,
        data.summary.allTime.total - data.summary.thisYear.total
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Revenue Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        Detailed revenue insights and trends over time
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {PERIODS.map((p) => (
                        <Button
                            key={p.value}
                            variant={period === p.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPeriod(p.value)}
                        >
                            {p.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.summary.today.total)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {todayGrowth !== 0 && (
                                <>
                                    {todayGrowth > 0 ? (
                                        <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                                    )}
                                    <span className={todayGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {Math.abs(todayGrowth).toFixed(1)}%
                                    </span>
                                    <span className="ml-1">vs daily avg</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Week</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.summary.thisWeek.total)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {weekGrowth !== 0 && (
                                <>
                                    {weekGrowth > 0 ? (
                                        <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                                    )}
                                    <span className={weekGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {Math.abs(weekGrowth).toFixed(1)}%
                                    </span>
                                    <span className="ml-1">vs monthly avg</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.summary.thisMonth.total)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {monthGrowth !== 0 && (
                                <>
                                    {monthGrowth > 0 ? (
                                        <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                                    )}
                                    <span className={monthGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {Math.abs(monthGrowth).toFixed(1)}%
                                    </span>
                                    <span className="ml-1">vs yearly avg</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Year</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.summary.thisYear.total)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {yearGrowth !== 0 && (
                                <>
                                    {yearGrowth > 0 ? (
                                        <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                                    )}
                                    <span className={yearGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {Math.abs(yearGrowth).toFixed(1)}%
                                    </span>
                                    <span className="ml-1">vs previous</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="daily" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="daily">Daily Revenue</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly Revenue</TabsTrigger>
                    <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Revenue Trend</CardTitle>
                            <CardDescription>
                                Revenue breakdown by day showing total, crypto, and Stripe payments
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dailyChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <AreaChart data={dailyChartData}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorCrypto" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorStripe" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="dateLabel"
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                        />
                                        <YAxis
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                            }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="total"
                                            stroke="#3b82f6"
                                            fillOpacity={1}
                                            fill="url(#colorTotal)"
                                            name="Total Revenue"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="crypto"
                                            stroke="#10b981"
                                            fillOpacity={1}
                                            fill="url(#colorCrypto)"
                                            name="Crypto"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="stripe"
                                            stroke="#8b5cf6"
                                            fillOpacity={1}
                                            fill="url(#colorStripe)"
                                            name="Stripe"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                                    No daily revenue data available for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Revenue</CardTitle>
                            <CardDescription>
                                Revenue breakdown by month with tier and payment source details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {monthlyChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={monthlyChartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="monthLabel"
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                        />
                                        <YAxis
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                            }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                        <Legend />
                                        <Bar dataKey="total" fill="#3b82f6" name="Total Revenue" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="pro" fill="#06b6d4" name="Pro Tier" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="elite" fill="#8b5cf6" name="Elite Tier" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                                    No monthly revenue data available for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="breakdown" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Payment Source Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle>By Payment Source</CardTitle>
                                <CardDescription>Revenue breakdown by payment method</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                        <div className="flex items-center gap-3">
                                            <Coins className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                                            <span className="font-medium">Crypto Payments</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">
                                                {formatCurrency(data.summary.allTime.crypto)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {data.summary.allTime.total > 0
                                                    ? Math.round((data.summary.allTime.crypto / data.summary.allTime.total) * 100)
                                                    : 0}
                                                %
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                        <div className="flex items-center gap-3">
                                            <CreditCard className="h-5 w-5 text-sec-600 dark:text-sec-400" />
                                            <span className="font-medium">Stripe Payments</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">
                                                {formatCurrency(data.summary.allTime.stripe)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {data.summary.allTime.total > 0
                                                    ? Math.round((data.summary.allTime.stripe / data.summary.allTime.total) * 100)
                                                    : 0}
                                                %
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tier Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle>By Tier</CardTitle>
                                <CardDescription>Revenue breakdown by subscription tier</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    {data.monthlyRevenue.length > 0 && (
                                        <>
                                            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                                <div className="flex items-center gap-3">
                                                    <Sparkles className="h-5 w-5 text-sec-600 dark:text-sec-400" />
                                                    <span className="font-medium">Pro Tier</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold">
                                                        {formatCurrency(
                                                            data.monthlyRevenue.reduce((sum, m) => sum + m.pro, 0)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                                <div className="flex items-center gap-3">
                                                    <Crown className="h-5 w-5 text-elite-600 dark:text-elite-400" />
                                                    <span className="font-medium">Elite Tier</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold">
                                                        {formatCurrency(
                                                            data.monthlyRevenue.reduce((sum, m) => sum + m.elite, 0)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

