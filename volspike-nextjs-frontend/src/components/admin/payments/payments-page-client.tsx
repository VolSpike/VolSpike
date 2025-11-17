'use client'

import { useEffect, useMemo, useState } from 'react'
import { PaymentsTable } from './payments-table'
import { PaymentFilters } from './payment-filters'
import { CreatePaymentDialog } from './create-payment-dialog'
import { adminAPI } from '@/lib/admin/api-client'
import { Loader2, AlertCircle, Plus, CreditCard, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAutoSyncPayments } from '@/hooks/use-auto-sync-payments'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface PaymentsPageClientProps {
    initialData: any
    query: Record<string, any>
    accessToken: string | null
}

export function PaymentsPageClient({ initialData, query, accessToken }: PaymentsPageClientProps) {
    const [paymentsData, setPaymentsData] = useState<any>(initialData)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

    useEffect(() => {
        if (accessToken) {
            adminAPI.setAccessToken(accessToken)
        }
    }, [accessToken])

    const queryKey = useMemo(() => JSON.stringify(query), [query])

    // Keep local state in sync when server-side filters change (e.g. email, status, tier)
    useEffect(() => {
        setPaymentsData(initialData)
        setError(null)
    }, [initialData, queryKey])

    // Auto-sync payments from NowPayments
    const { syncingPayments, lastSyncTime, syncCount, paymentsToSyncCount, syncAllPayments } =
        useAutoSyncPayments({
            payments: paymentsData?.payments || [],
            enabled: autoSyncEnabled,
            interval: 30000, // 30 seconds
            onPaymentUpdated: () => {
                // Refresh data when payment is updated
                fetchPayments()
            },
            accessToken,
        })

    const fetchPayments = async () => {
        if (!accessToken) {
            setError('Authentication required')
            return
        }
        try {
            setLoading(true)
            setError(null)
            adminAPI.setAccessToken(accessToken)
            const data = await adminAPI.getPayments(JSON.parse(queryKey))
            setPaymentsData(data)
        } catch (err: any) {
            console.error('Error fetching payments:', err)
            setError(err.message || 'Failed to load payments. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Loading payments...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                                    Error Loading Payments
                                </h3>
                                <p className="text-sm text-red-800 dark:text-red-200 mb-4">
                                    {error}
                                </p>
                                <Button
                                    onClick={fetchPayments}
                                    variant="outline"
                                    className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900"
                                >
                                    <Loader2 className="h-4 w-4 mr-2" />
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with count and actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                    {paymentsData && (
                        <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
                            <span className="text-sm font-semibold text-foreground">
                                {paymentsData.pagination.total.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1.5">payments</span>
                        </div>
                    )}

                    {/* Auto-sync status indicator */}
                    {autoSyncEnabled && paymentsToSyncCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 backdrop-blur-sm">
                            <div className="relative">
                                <RefreshCw
                                    className={cn(
                                        'h-3.5 w-3.5 transition-all',
                                        syncingPayments.size > 0 && 'animate-spin text-sec-500'
                                    )}
                                />
                                {syncingPayments.size > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sec-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sec-500"></span>
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-foreground">
                                    Auto-syncing {paymentsToSyncCount} payment{paymentsToSyncCount !== 1 ? 's' : ''}
                                </span>
                                {lastSyncTime && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {syncingPayments.size > 0
                                            ? 'Syncing now...'
                                            : `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {syncCount > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                {syncCount} update{syncCount !== 1 ? 's' : ''} synced
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Auto-sync toggle */}
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 backdrop-blur-sm">
                        <Switch
                            id="auto-sync"
                            checked={autoSyncEnabled}
                            onCheckedChange={setAutoSyncEnabled}
                        />
                        <Label
                            htmlFor="auto-sync"
                            className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Auto-sync
                        </Label>
                    </div>

                    {/* Manual sync button */}
                    {paymentsToSyncCount > 0 && (
                        <Button
                            onClick={() => {
                                syncAllPayments()
                                toast.success('Syncing payments from NowPayments...', { duration: 2000 })
                            }}
                            variant="outline"
                            size="sm"
                            disabled={syncingPayments.size > 0}
                            className="gap-2"
                        >
                            <RefreshCw
                                className={cn('h-3.5 w-3.5', syncingPayments.size > 0 && 'animate-spin')}
                            />
                            <span className="hidden sm:inline">Sync Now</span>
                        </Button>
                    )}

                    <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Payment
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <PaymentFilters currentFilters={query} />

            {/* Payments Table */}
            {paymentsData ? (
                <PaymentsTable
                    payments={paymentsData.payments}
                    pagination={paymentsData.pagination}
                    currentQuery={query}
                />
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">No payment data available</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Create Payment Dialog */}
            <CreatePaymentDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onPaymentCreated={fetchPayments}
            />
        </div>
    )
}
