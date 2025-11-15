'use client'

import { RevenueBreakdown } from './revenue-breakdown'
import type { SystemMetrics } from '@/types/admin'

interface RevenueChartProps {
    metrics?: SystemMetrics | null
}

export function RevenueChart({ metrics }: RevenueChartProps) {
    const totalRevenue = metrics?.totalRevenue || 0

    return <RevenueBreakdown totalRevenue={totalRevenue} />
}
