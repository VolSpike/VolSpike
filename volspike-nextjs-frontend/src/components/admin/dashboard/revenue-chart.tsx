'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp } from 'lucide-react'
import type { SystemMetrics } from '@/types/admin'

interface RevenueChartProps {
    metrics?: SystemMetrics | null
}

export function RevenueChart({ metrics }: RevenueChartProps) {
    const totalRevenue = metrics?.totalRevenue || 0

    if (!metrics) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
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
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Current Revenue */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Lifetime revenue</p>
                        </div>
                        {totalRevenue > 0 && (
                            <div className="flex items-center space-x-1">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-600">
                                    Active
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Revenue Info */}
                    <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3">
                            Revenue tracking is currently in development. Detailed analytics will be available soon.
                        </p>
                        {totalRevenue === 0 && (
                            <div className="flex items-center justify-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <p className="text-sm text-muted-foreground">No revenue recorded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
