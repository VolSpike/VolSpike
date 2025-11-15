'use client'

import { useEffect, useMemo, useState } from 'react'
import { PaymentsTable } from './payments-table'
import { PaymentFilters } from './payment-filters'
import { CreatePaymentDialog } from './create-payment-dialog'
import { adminAPI } from '@/lib/admin/api-client'
import { Loader2, AlertCircle, Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AdminPageHeader } from '../layout/admin-page-header'

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
                <div className="flex items-center gap-3">
                    {paymentsData && (
                        <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
                            <span className="text-sm font-semibold text-foreground">
                                {paymentsData.pagination.total.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1.5">payments</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
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
