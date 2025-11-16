'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp, UserPlus } from 'lucide-react'
import type { SystemMetrics } from '@/types/admin'

interface UserGrowthChartProps {
    metrics?: SystemMetrics | null
}

export function UserGrowthChart({ metrics }: UserGrowthChartProps) {
    const totalUsers = metrics?.totalUsers || 0
    const usersByTier = metrics?.usersByTier || []
    
    // Calculate tier breakdown
    const freeCount = usersByTier.find(t => t.tier === 'free')?.count || 0
    const proCount = usersByTier.find(t => t.tier === 'pro')?.count || 0
    const eliteCount = usersByTier.find(t => t.tier === 'elite')?.count || 0

    if (!metrics) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">User Growth</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-muted-foreground">No data available</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/10 via-brand-400/10 to-transparent">
                        <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-semibold">User Growth</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            User distribution and activity
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Users - Prominent */}
                <div className="flex items-baseline justify-between pb-3 border-b border-border/60">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
                            {totalUsers.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Compact Grid Layout */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Tier Breakdown - Left Column */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">By Tier</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                                    <span className="text-sm text-foreground/80">Free</span>
                                </div>
                                <span className="text-sm font-semibold">{freeCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-sec-500/5 border border-sec-500/20">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-sec-500" />
                                    <span className="text-sm text-sec-600 dark:text-sec-400">Pro</span>
                                </div>
                                <span className="text-sm font-semibold text-sec-600 dark:text-sec-400">{proCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-elite-500/5 border border-elite-500/20">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-elite-500" />
                                    <span className="text-sm text-elite-600 dark:text-elite-400">Elite</span>
                                </div>
                                <span className="text-sm font-semibold text-elite-600 dark:text-elite-400">{eliteCount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Metrics - Right Column */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">Activity (30d)</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                                <span className="text-xs text-muted-foreground">Active Users</span>
                                <span className="text-sm font-semibold">{metrics.activeUsers.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                <div className="flex items-center gap-1.5">
                                    <UserPlus className="h-3 w-3 text-rose-500" />
                                    <span className="text-xs text-muted-foreground">New Signups</span>
                                </div>
                                <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{metrics.recentSignups.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
