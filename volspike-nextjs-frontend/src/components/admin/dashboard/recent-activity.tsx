'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
    User,
    CreditCard,
    Settings,
    Shield,
    Eye,
    ExternalLink,
    FileText
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface RecentActivityProps {
    activities: Array<{
        id: string
        action: string
        actor: { email: string }
        targetType: string
        targetId: string
        createdAt: Date
    }>
}

const actionIcons = {
    USER_CREATED: User,
    USER_UPDATED: User,
    USER_DELETED: User,
    SUBSCRIPTION_CREATED: CreditCard,
    SUBSCRIPTION_UPDATED: CreditCard,
    SUBSCRIPTION_CANCELLED: CreditCard,
    SETTINGS_UPDATED: Settings,
    SECURITY_EVENT: Shield,
}

const actionColors = {
    USER_CREATED: 'bg-green-100 text-green-800',
    USER_UPDATED: 'bg-blue-100 text-blue-800',
    USER_DELETED: 'bg-red-100 text-red-800',
    SUBSCRIPTION_CREATED: 'bg-green-100 text-green-800',
    SUBSCRIPTION_UPDATED: 'bg-blue-100 text-blue-800',
    SUBSCRIPTION_CANCELLED: 'bg-red-100 text-red-800',
    SETTINGS_UPDATED: 'bg-yellow-100 text-yellow-800',
    SECURITY_EVENT: 'bg-red-100 text-red-800',
}

const actionLabels = {
    USER_CREATED: 'User Created',
    USER_UPDATED: 'User Updated',
    USER_DELETED: 'User Deleted',
    SUBSCRIPTION_CREATED: 'Subscription Created',
    SUBSCRIPTION_UPDATED: 'Subscription Updated',
    SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
    SETTINGS_UPDATED: 'Settings Updated',
    SECURITY_EVENT: 'Security Event',
}

export function RecentActivity({ activities }: RecentActivityProps) {
    const router = useRouter()

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/admin/audit')}
                >
                    <Eye className="h-4 w-4 mr-2" />
                    View All
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                <FileText className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">No recent activity</h3>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Administrative actions and system events will appear here
                            </p>
                        </div>
                    ) : (
                        activities.map((activity) => {
                            const Icon = actionIcons[activity.action as keyof typeof actionIcons] || User
                            const colorClass = actionColors[activity.action as keyof typeof actionColors] || 'bg-gray-100 text-gray-800'
                            const label = actionLabels[activity.action as keyof typeof actionLabels] || activity.action

                            return (
                                <div key={activity.id} className="group flex items-center space-x-4 p-3 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/30 transition-all duration-200">
                                    <div className="flex-shrink-0">
                                        <div className={`p-2.5 rounded-lg ${colorClass} shadow-sm`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <p className="text-sm font-medium text-foreground">
                                                {label}
                                            </p>
                                            <Badge variant="outline" className="text-xs border-border/60">
                                                {activity.targetType}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                            by {activity.actor.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70">
                                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                const params = new URLSearchParams()
                                                if (activity.targetType) {
                                                    params.set('targetType', activity.targetType)
                                                }
                                                if (activity.targetId) {
                                                    params.set('targetId', activity.targetId)
                                                }
                                                router.push(`/admin/audit?${params.toString()}`)
                                            }}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// Activity summary component
export function ActivitySummary({ activities }: RecentActivityProps) {
    const activityCounts = activities.reduce((acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const topActions = Object.entries(activityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {topActions.map(([action, count]) => {
                        const label = actionLabels[action as keyof typeof actionLabels] || action
                        const colorClass = actionColors[action as keyof typeof actionColors] || 'bg-gray-100 text-gray-800'

                        return (
                            <div key={action} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Badge className={`text-xs ${colorClass}`}>
                                        {label}
                                    </Badge>
                                </div>
                                <span className="text-sm font-medium">{count}</span>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
