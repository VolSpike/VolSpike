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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Growth</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Current Users */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold">{totalUsers.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Total users</p>
                        </div>
                        {totalUsers > 0 && (
                            <div className="flex items-center space-x-1">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-600">
                                    Active
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Tier Breakdown */}
                    <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3 font-medium">Users by Tier</p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Free</span>
                                <span className="text-sm font-medium">{freeCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-blue-600 dark:text-blue-400">Pro</span>
                                <span className="text-sm font-medium">{proCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-purple-600 dark:text-purple-400">Elite</span>
                                <span className="text-sm font-medium">{eliteCount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Active Users (30d)</span>
                            <span className="font-medium">{metrics.activeUsers.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-muted-foreground">Recent Signups (30d)</span>
                            <span className="font-medium flex items-center">
                                <UserPlus className="h-3 w-3 mr-1" />
                                {metrics.recentSignups.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
