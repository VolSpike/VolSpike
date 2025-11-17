'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { StatsCards } from '@/components/admin/dashboard/stats-cards'
import { RecentActivity } from '@/components/admin/dashboard/recent-activity'
import { UserGrowthChart } from '@/components/admin/dashboard/user-growth-chart'
import { RevenueChart } from '@/components/admin/dashboard/revenue-chart'
import { QuickActions } from '@/components/admin/dashboard/quick-actions'
import { DashboardWalletBalances } from '@/components/admin/dashboard/wallet-balances'
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
            // Admin API requires JWT token (not user.id)
            const accessToken = (session as any)?.accessToken
            
            if (!accessToken) {
                console.error('[AdminDashboard] No access token in session', {
                    hasSession: !!session,
                    hasUser: !!session?.user,
                    sessionKeys: session ? Object.keys(session) : [],
                    userKeys: session?.user ? Object.keys(session.user) : [],
                    userId: session?.user?.id,
                    role: session?.user?.role,
                    note: 'Admin API requires JWT token in session.accessToken',
                })
                setError('Authentication token missing. Please sign out and sign in again.')
                setLoading(false)
                return
            }

            // Verify token looks like a JWT (contains dots)
            if (!accessToken.includes('.')) {
                console.error('[AdminDashboard] Invalid token format (not a JWT)', {
                    tokenLength: accessToken.length,
                    tokenPreview: accessToken.substring(0, 20),
                    note: 'Admin API requires JWT token format',
                })
                setError('Invalid authentication token. Please sign out and sign in again.')
                setLoading(false)
                return
            }

            try {
                adminAPI.setAccessToken(accessToken as string)
                const data = await adminAPI.getSystemMetrics('30d')
                setMetrics(data)
            } catch (err: any) {
                console.error('[AdminDashboard] Failed to fetch metrics:', err)
                // Check if it's an authentication error
                if (err?.status === 401 || err?.message?.includes('Authentication') || err?.message?.includes('Unauthorized')) {
                    setError('Authentication failed. Your session may have expired. Please sign out and sign in again.')
                } else {
                    setError(`Failed to load dashboard metrics: ${err?.message || 'Unknown error'}`)
                }
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchMetrics()
        } else {
            setLoading(false)
            setError('Please sign in to access the admin dashboard')
        }
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

            <QuickActions />
            <StatsCards stats={stats} />

            <div className="grid gap-6 md:grid-cols-2">
                <UserGrowthChart metrics={metrics} />
                <RevenueChart metrics={metrics} />
            </div>

            <DashboardWalletBalances />

            <RecentActivity />
        </div>
    )
}
