'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CreditCard, User, Calendar, DollarSign, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { SubscriptionSummary } from '@/types/admin'

interface SubscriptionDetailClientProps {
    subscription: SubscriptionSummary
    user?: any
}

export function SubscriptionDetailClient({ subscription, user }: SubscriptionDetailClientProps) {
    const router = useRouter()

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'bg-purple-500 text-white'
            case 'pro':
                return 'bg-blue-500 text-white'
            default:
                return 'bg-gray-500 text-white'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            case 'trialing':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'past_due':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'canceled':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            case 'unpaid':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="h-9 w-9"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-purple-700 bg-clip-text text-transparent">
                            Subscription Details
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            View and manage subscription information
                        </p>
                    </div>
                </div>
            </div>

            {/* Subscription Info */}
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscription Information
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(subscription.status)}>
                                {subscription.status}
                            </Badge>
                            <Badge className={getTierColor(subscription.tier)}>
                                {subscription.tier.toUpperCase()}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Subscription ID
                            </label>
                            <p className="text-sm font-mono mt-1">{subscription.id}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                User Email
                            </label>
                            <p className="text-sm mt-1">{subscription.userEmail}</p>
                        </div>
                        {subscription.stripeCustomerId && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Stripe Customer ID
                                </label>
                                <p className="text-sm font-mono mt-1">{subscription.stripeCustomerId}</p>
                            </div>
                        )}
                        {subscription.stripeSubscriptionId && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Stripe Subscription ID
                                </label>
                                <p className="text-sm font-mono mt-1">{subscription.stripeSubscriptionId}</p>
                            </div>
                        )}
                        {subscription.currentPeriodStart && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Current Period Start
                                </label>
                                <p className="text-sm mt-1">
                                    {format(new Date(subscription.currentPeriodStart), 'MMM d, yyyy HH:mm:ss')}
                                </p>
                            </div>
                        )}
                        {subscription.currentPeriodEnd && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Current Period End
                                </label>
                                <p className="text-sm mt-1">
                                    {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy HH:mm:ss')}
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Created At
                            </label>
                            <p className="text-sm mt-1">
                                {format(new Date(subscription.createdAt), 'MMM d, yyyy HH:mm:ss')}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Last Updated
                            </label>
                            <p className="text-sm mt-1">
                                {format(new Date(subscription.updatedAt), 'MMM d, yyyy HH:mm:ss')}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Info */}
            {user && (
                <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            User Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">{user.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">User ID: {user.id}</p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/admin/users/${user.id}`)}
                            >
                                View User
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    onClick={() => router.push('/admin/subscriptions')}
                >
                    Back to Subscriptions
                </Button>
                {subscription.stripeCustomerId && (
                    <Button
                        variant="outline"
                        onClick={() => router.push(`/admin/users/${subscription.userId}`)}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync with Stripe
                    </Button>
                )}
            </div>
        </div>
    )
}

