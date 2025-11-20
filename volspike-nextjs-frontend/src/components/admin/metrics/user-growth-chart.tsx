'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { adminAPI } from '@/lib/admin/api-client'
import { ArrowUpRight, Users, UserPlus } from 'lucide-react'
import type { UserGrowthMetrics } from '@/types/admin'

const PERIODS = [
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: '1y', value: '1y' },
]

export function UserGrowthChart() {
    const { data: session } = useSession()
    const [period, setPeriod] = useState<string>('30d')
    const [data, setData] = useState<UserGrowthMetrics | null>(null)
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
                const growth = await adminAPI.getUserGrowth(period)
                if (mounted) {
                    setData(growth)
                }
            } catch (err) {
                console.error('[UserGrowthChart] Failed to load growth metrics', err)
                if (mounted) {
                    setError('Unable to load user growth data')
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
        if (!data?.daily?.length) return []
        return data.daily.map((item) => ({
            ...item,
            label: format(parseISO(item.date), 'MMM d'),
        }))
    }, [data])

    const growthBadge = useMemo(() => {
        if (!data) return null
        const change = data.summary.growthRate
        const status = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
        const color =
            status === 'up'
                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40'
                : status === 'down'
                    ? 'bg-red-500/15 text-red-200 border border-red-500/40'
                    : 'bg-slate-500/20 text-slate-200 border border-slate-500/40'

        return (
            <Badge className={color}>
                {status === 'up' ? '▲' : status === 'down' ? '▼' : '■'}{' '}
                {Math.abs(change).toFixed(1)}% vs prev period
            </Badge>
        )
    }, [data])

    if (loading) {
        return (
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span>User Growth</span>
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
                    <LoadingSpinner text="Loading signup trend from Prisma" variant="brand" />
                </CardContent>
            </Card>
        )
    }

    if (error || !data) {
        return (
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span>User Growth</span>
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
                        {error || 'No growth data for this window yet.'}
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
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 opacity-40" />
            <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                        <span>User Growth</span>
                        <Badge variant="outline" className="capitalize">
                            {period}
                        </Badge>
                        {growthBadge}
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
                            New users
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-500" />
                            <span className="text-2xl font-semibold">
                                {data.summary.newUsers.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Avg {data.summary.averagePerDay.toFixed(1)} / day
                        </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground uppercase mb-1 tracking-wide">
                            Tier mix
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Free {data.summary.perTier.free}</Badge>
                            <Badge variant="secondary">Pro {data.summary.perTier.pro}</Badge>
                            <Badge variant="secondary">Elite {data.summary.perTier.elite}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">New signups only</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground uppercase mb-1 tracking-wide">
                            Period delta
                        </div>
                        <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-sky-400" />
                            <span className="text-lg font-semibold">
                                {data.summary.previousPeriod} prior period
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Comparing equal-length window
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                {chartData.length === 0 ? (
                    <div className="flex h-[320px] items-center justify-center text-muted-foreground text-sm">
                        No signups recorded in this window.
                    </div>
                ) : (
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10 }}>
                                <defs>
                                    <linearGradient id="growthTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="growthPro" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="growthElite" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} dy={8} />
                                <YAxis tick={{ fontSize: 12 }} width={46} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0b1224',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: 10,
                                    }}
                                    formatter={(value: number, name) => [value, name]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="newUsers"
                                    name="New users"
                                    stroke="#22c55e"
                                    fill="url(#growthTotal)"
                                    strokeWidth={2.2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="pro"
                                    name="Pro"
                                    stroke="#6366f1"
                                    fill="url(#growthPro)"
                                    strokeWidth={1.6}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="elite"
                                    name="Elite"
                                    stroke="#f59e0b"
                                    fill="url(#growthElite)"
                                    strokeWidth={1.6}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    <span>
                        Data comes straight from user signups (Prisma). Missing days are plotted as zero so trends stay honest.
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
