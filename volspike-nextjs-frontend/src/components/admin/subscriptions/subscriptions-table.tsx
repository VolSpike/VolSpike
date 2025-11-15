'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    MoreHorizontal,
    DollarSign,
    RefreshCw,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    CreditCard,
    AlertTriangle,
    CheckCircle,
    XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { SubscriptionSummary } from '@/types/admin'
import { adminAPI } from '@/lib/admin/api-client'

interface SubscriptionsTableProps {
    subscriptions: SubscriptionSummary[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
    currentQuery: any
}

const statusIcons = {
    active: CheckCircle,
    trialing: RefreshCw,
    past_due: AlertTriangle,
    canceled: XCircle,
    unpaid: AlertTriangle,
}

const statusColors = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-red-100 text-red-800',
    unpaid: 'bg-red-100 text-red-800',
}

export function SubscriptionsTable({ subscriptions, pagination, currentQuery }: SubscriptionsTableProps) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)

    const handleSort = (field: string) => {
        const newSortOrder = currentQuery.sortBy === field && currentQuery.sortOrder === 'asc' ? 'desc' : 'asc'
        const params = new URLSearchParams(currentQuery)
        params.set('sortBy', field)
        params.set('sortOrder', newSortOrder)
        router.push(`/admin/subscriptions?${params.toString()}`)
    }

    const getSortIcon = (field: string) => {
        if (currentQuery.sortBy !== field) {
            return <ChevronsUpDown className="h-4 w-4" />
        }
        return currentQuery.sortOrder === 'asc' ?
            <ChevronUp className="h-4 w-4" /> :
            <ChevronDown className="h-4 w-4" />
    }

    const handleAction = async (action: string, subscriptionId: string) => {
        setLoading(subscriptionId)
        try {
            switch (action) {
                case 'sync':
                    await adminAPI.syncStripeSubscription(subscriptionId)
                    toast.success('Subscription synced')
                    router.refresh()
                    break
                case 'cancel':
                    if (confirm('Are you sure you want to cancel this subscription?')) {
                        await adminAPI.cancelSubscription(subscriptionId)
                        toast.success('Subscription cancelled')
                        router.refresh()
                    }
                    break
                case 'refund':
                    const subscription = subscriptions.find(sub => sub.id === subscriptionId)
                    if (subscription && confirm('Are you sure you want to process a refund for this subscription?')) {
                        await adminAPI.processRefund(subscription.userId, { reason: 'Admin refund' })
                        toast.success('Refund processed')
                        router.refresh()
                    }
                    break
            }
        } catch (error) {
            toast.error('Action failed')
        } finally {
            setLoading(null)
        }
    }

    const getTierFromPrice = (priceId: string) => {
        // This would map Stripe price IDs to tiers
        if (priceId.includes('pro')) return 'pro'
        if (priceId.includes('elite')) return 'elite'
        return 'free'
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'bg-purple-500'
            case 'pro':
                return 'bg-blue-500'
            default:
                return 'bg-gray-500'
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Status</span>
                                    {getSortIcon('status')}
                                </div>
                            </TableHead>
                            <TableHead>Tier</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('current_period_end')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Next Billing</span>
                                    {getSortIcon('current_period_end')}
                                </div>
                            </TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('created')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Created</span>
                                    {getSortIcon('created')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subscriptions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-64">
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                            <CreditCard className="h-8 w-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground mb-1">No subscriptions found</h3>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            {currentQuery.status || currentQuery.tier || currentQuery.userId
                                                ? 'Try adjusting your filters to see more results'
                                                : 'No subscriptions have been created yet'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            subscriptions.map((subscription) => {
                                const StatusIcon = statusIcons[subscription.status as keyof typeof statusIcons] || CheckCircle
                                const statusColorClass = statusColors[subscription.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
                                const tier = getTierFromPrice(subscription.stripePriceId || '')

                                return (
                                <TableRow
                                    key={subscription.id}
                                    className="group cursor-pointer transition-colors hover:bg-muted/50 border-border/60"
                                    onClick={() => router.push(`/admin/subscriptions/${subscription.id}`)}
                                >
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">{subscription.userEmail}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ID: {subscription.id.slice(0, 8)}...
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={statusColorClass}>
                                            <StatusIcon className="h-3 w-3 mr-1" />
                                            {subscription.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={getTierColor(tier)}>
                                            {tier.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {subscription.currentPeriodEnd ? (
                                            <div className="flex flex-col">
                                                <span className="text-sm">
                                                    {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(subscription.currentPeriodEnd), 'HH:mm:ss')}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">N/A</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-1">
                                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-sm font-medium">
                                                $0.00
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">
                                                {format(new Date(subscription.createdAt), 'MMM d, yyyy')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(subscription.createdAt), 'HH:mm:ss')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={loading === subscription.id}
                                                >
                                                    {loading === subscription.id ? (
                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('sync', subscription.id)}
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Sync with Stripe
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {subscription.status === 'active' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleAction('cancel', subscription.id)}
                                                        className="text-red-600"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Cancel Subscription
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('refund', subscription.id)}
                                                    className="text-yellow-600"
                                                >
                                                    <DollarSign className="h-4 w-4 mr-2" />
                                                    Process Refund
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} subscriptions
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() => {
                                const params = new URLSearchParams(currentQuery)
                                params.set('page', String(pagination.page - 1))
                                router.push(`/admin/subscriptions?${params.toString()}`)
                            }}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= pagination.pages}
                            onClick={() => {
                                const params = new URLSearchParams(currentQuery)
                                params.set('page', String(pagination.page + 1))
                                router.push(`/admin/subscriptions?${params.toString()}`)
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
