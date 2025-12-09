'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Bell,
    Trash2,
    RefreshCw,
    TrendingUp,
    Zap,
    BarChart3,
    Mail,
    Monitor,
    AlertCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface UserAlert {
    id: string
    symbol: string
    alertType: 'PRICE_CROSS' | 'FUNDING_CROSS' | 'OI_CROSS'
    threshold: number
    isActive: boolean
    deliveryMethod: 'DASHBOARD' | 'EMAIL' | 'BOTH'
    triggeredAt: string | null
    triggeredValue: number | null
    createdAt: string
}

const ALERT_TYPE_ICONS: Record<string, any> = {
    PRICE_CROSS: TrendingUp,
    FUNDING_CROSS: Zap,
    OI_CROSS: BarChart3,
}

const ALERT_TYPE_NAMES: Record<string, string> = {
    PRICE_CROSS: 'Price Cross',
    FUNDING_CROSS: 'Funding Rate Cross',
    OI_CROSS: 'Open Interest Cross',
}

export default function AlertsPage() {
    const { data: session } = useSession()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState('active')

    // Fetch alerts
    const { data: alertsData, isLoading } = useQuery({
        queryKey: ['user-cross-alerts'],
        queryFn: async () => {
            if (!session?.user?.id) throw new Error('Not authenticated')

            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session.user.id

            const response = await fetch(`${API_URL}/api/user-alerts`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) throw new Error('Failed to fetch alerts')

            return response.json()
        },
        enabled: !!session?.user?.id,
    })

    const alerts: UserAlert[] = alertsData?.alerts || []
    const activeAlerts = alerts.filter(a => a.isActive)
    const inactiveAlerts = alerts.filter(a => !a.isActive)

    // Get user tier info
    const userTier = (session?.user as any)?.tier || 'free'
    const tierLimits: Record<string, number> = {
        free: 3,
        pro: 10,
        elite: 999999,
    }
    const maxAlerts = tierLimits[userTier] || 3

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts/${alertId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
            toast.success('Alert deleted successfully')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Reactivate mutation
    const reactivateMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts/${alertId}/reactivate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to reactivate alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
            toast.success('Alert reactivated successfully')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    const formatValue = (value: number, type: string): string => {
        if (type === 'PRICE_CROSS' || type === 'OI_CROSS') {
            return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        } else if (type === 'FUNDING_CROSS') {
            return `${(value * 100).toFixed(4)}%`
        }
        return value.toString()
    }

    const formatSymbol = (symbol: string) => symbol.replace(/USDT$/i, '')

    const renderAlert = (alert: UserAlert) => {
        const Icon = ALERT_TYPE_ICONS[alert.alertType]
        const typeName = ALERT_TYPE_NAMES[alert.alertType]

        return (
            <Card key={alert.id} className="overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 rounded-lg bg-brand-500/10">
                                <Icon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-semibold">
                                        {formatSymbol(alert.symbol)} - {typeName}
                                    </h3>
                                    {!alert.isActive && (
                                        <Badge variant="secondary" className="text-xs">
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <p>
                                        <span className="font-medium">Threshold:</span>{' '}
                                        {formatValue(alert.threshold, alert.alertType)}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-medium">Delivery:</span>
                                        {alert.deliveryMethod === 'DASHBOARD' && (
                                            <span className="flex items-center gap-1">
                                                <Monitor className="h-3 w-3" />
                                                Dashboard
                                            </span>
                                        )}
                                        {alert.deliveryMethod === 'EMAIL' && (
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                Email
                                            </span>
                                        )}
                                        {alert.deliveryMethod === 'BOTH' && (
                                            <span className="flex items-center gap-1">
                                                <Monitor className="h-3 w-3" />
                                                Dashboard +
                                                <Mail className="h-3 w-3" />
                                                Email
                                            </span>
                                        )}
                                    </p>
                                    <p>
                                        <span className="font-medium">Created:</span>{' '}
                                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                    </p>
                                    {alert.triggeredAt && (
                                        <p>
                                            <span className="font-medium">Triggered:</span>{' '}
                                            {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                                            {alert.triggeredValue && (
                                                <span className="ml-1">
                                                    at {formatValue(alert.triggeredValue, alert.alertType)}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!alert.isActive && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => reactivateMutation.mutate(alert.id)}
                                    disabled={reactivateMutation.isPending}
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${reactivateMutation.isPending ? 'animate-spin' : ''}`} />
                                    Reactivate
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    if (confirm('Are you sure you want to delete this alert?')) {
                                        deleteMutation.mutate(alert.id)
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!session) {
        return (
            <div className="container max-w-4xl py-8">
                <Card>
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
                        <p className="text-muted-foreground">
                            Please sign in to manage your alerts.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container max-w-4xl py-8">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Alerts</h1>
                    <p className="text-muted-foreground">
                        Manage your price, funding rate, and open interest alerts
                    </p>
                </div>

                {/* Tier Info Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Active Alerts</p>
                                <p className="text-2xl font-bold">
                                    {activeAlerts.length} / {userTier === 'elite' ? '∞' : maxAlerts}
                                </p>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline" className="text-sm capitalize">
                                    {userTier} Tier
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {userTier === 'free' && 'Upgrade to Pro for 10 alerts'}
                                    {userTier === 'pro' && 'Upgrade to Elite for unlimited alerts'}
                                    {userTier === 'elite' && 'Unlimited alerts'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Alerts Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="active">
                            <Bell className="h-4 w-4 mr-2" />
                            Active ({activeAlerts.length})
                        </TabsTrigger>
                        <TabsTrigger value="inactive">
                            Inactive ({inactiveAlerts.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="space-y-4 mt-6">
                        {isLoading ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto" />
                                    <p className="mt-4 text-sm text-muted-foreground">Loading alerts...</p>
                                </CardContent>
                            </Card>
                        ) : activeAlerts.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Create your first alert from the market table by clicking the bell icon
                                    </p>
                                    <Button asChild>
                                        <a href="/dashboard">
                                            Go to Dashboard
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            activeAlerts.map(renderAlert)
                        )}
                    </TabsContent>

                    <TabsContent value="inactive" className="space-y-4 mt-6">
                        {isLoading ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto" />
                                    <p className="mt-4 text-sm text-muted-foreground">Loading alerts...</p>
                                </CardContent>
                            </Card>
                        ) : inactiveAlerts.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No Inactive Alerts</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Alerts that have been triggered will appear here
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            inactiveAlerts.map(renderAlert)
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
