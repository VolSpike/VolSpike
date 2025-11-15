'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { StatsCards } from '@/components/admin/dashboard/stats-cards'
import { RecentActivity } from '@/components/admin/dashboard/recent-activity'
import { UserGrowthChart } from '@/components/admin/dashboard/user-growth-chart'
import { RevenueChart } from '@/components/admin/dashboard/revenue-chart'
import { SystemHealth } from '@/components/admin/dashboard/system-health'
import { QuickActions } from '@/components/admin/dashboard/quick-actions'
import { adminAPI } from '@/lib/admin/api-client'
import type { SystemMetrics } from '@/types/admin'
import { Loader2 } from 'lucide-react'

export default function AdminDashboardClient() {
    const { data: session } = useSession()
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!session?.accessToken) {
                setLoading(false)
                return
            }

            try {
                adminAPI.setAccessToken(session.accessToken as string)
                const data = await adminAPI.getSystemMetrics('30d')
                setMetrics(data)
            } catch (err) {
                console.error('[AdminDashboard] Failed to fetch metrics:', err)
                setError('Failed to load dashboard metrics')
            } finally {
                setLoading(false)
            }
        }

        fetchMetrics()
    }, [session])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        )
    }

    const stats = metrics || {
        totalUsers: 0,
        activeUsers: 0,
        totalRevenue: 0,
        recentSignups: 0,
        usersByTier: [],
        failedLogins: 0,
        adminSessions: 0,
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Admin Dashboard
                </h1>
                <p className="text-muted-foreground mt-1">
                    Welcome back, Administrator
                </p>
            </div>

            <QuickActions />
            <StatsCards stats={stats} />

            <div className="grid gap-6 md:grid-cols-2">
                <UserGrowthChart metrics={metrics} />
                <RevenueChart metrics={metrics} />
            </div>

            <SystemHealth />
            <RecentActivity activities={[]} />
        </div>
    )
}
