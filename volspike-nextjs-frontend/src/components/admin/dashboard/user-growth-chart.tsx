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
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                        <Users className="h-5 w-5 text-muted-foreground" />
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
                        <p className="text-3xl font-bold text-foreground">
                            {totalUsers.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Compact Grid Layout - Neutral Design */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Tier Breakdown - Left Column */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">By Tier</p>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded border border-border/40 bg-muted/20">
                                <span className="text-sm text-foreground/90">Free</span>
                                <span className="text-sm font-semibold text-foreground">{freeCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 px-2 rounded border border-border/40 bg-muted/20">
                                <span className="text-sm text-foreground/90">Pro</span>
                                <span className="text-sm font-semibold text-foreground">{proCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 px-2 rounded border border-border/40 bg-muted/20">
                                <span className="text-sm text-foreground/90">Elite</span>
                                <span className="text-sm font-semibold text-foreground">{eliteCount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Metrics - Right Column */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Activity (30d)</p>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded border border-border/40 bg-muted/20">
                                <span className="text-xs text-muted-foreground">Active Users</span>
                                <span className="text-sm font-semibold text-foreground">{metrics.activeUsers.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 px-2 rounded border border-border/40 bg-muted/20">
                                <span className="text-xs text-muted-foreground">New Signups</span>
                                <span className="text-sm font-semibold text-foreground">{metrics.recentSignups.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
