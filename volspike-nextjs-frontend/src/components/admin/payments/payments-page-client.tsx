'use client'

import { useEffect, useMemo, useState } from 'react'
import { PaymentsTable } from './payments-table'
import { PaymentFilters } from './payment-filters'
import { CreatePaymentDialog } from './create-payment-dialog'
import { adminAPI } from '@/lib/admin/api-client'
import { Loader2, AlertCircle, Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PaymentsPageClientProps {
    searchParams: {
        userId?: string
        email?: string
        paymentStatus?: string
        tier?: string
        paymentId?: string
        invoiceId?: string
        orderId?: string
        page?: string
        limit?: string
        sortBy?: string
        sortOrder?: string
    }
    accessToken: string | null
}

export function PaymentsPageClient({ searchParams, accessToken }: PaymentsPageClientProps) {
    const [paymentsData, setPaymentsData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)

    // Parse search params
    const query = useMemo(() => ({
        userId: searchParams.userId,
        email: searchParams.email,
        paymentStatus: searchParams.paymentStatus,
        tier: searchParams.tier as any,
        paymentId: searchParams.paymentId,
        invoiceId: searchParams.invoiceId,
        orderId: searchParams.orderId,
        page: searchParams.page ? parseInt(searchParams.page) : 1,
        limit: searchParams.limit ? parseInt(searchParams.limit) : 20,
        sortBy: (searchParams.sortBy as any) || 'createdAt',
        sortOrder: (searchParams.sortOrder as any) || 'desc',
    }), [
        searchParams.limit,
        searchParams.page,
        searchParams.email,
        searchParams.paymentId,
        searchParams.invoiceId,
        searchParams.orderId,
        searchParams.paymentStatus,
        searchParams.sortBy,
        searchParams.sortOrder,
        searchParams.tier,
        searchParams.userId,
    ])

    useEffect(() => {
        const fetchPayments = async () => {
            if (!accessToken) {
                setError('Authentication required')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError(null)
                adminAPI.setAccessToken(accessToken)
                const data = await adminAPI.getPayments(query)
                setPaymentsData(data)
            } catch (err: any) {
                console.error('Error fetching payments:', err)
                setError(err.message || 'Failed to load payments. Please check your connection and try again.')
            } finally {
                setLoading(false)
            }
        }

        fetchPayments()
    }, [accessToken, query])

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
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Crypto Payments
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage cryptocurrency payments, troubleshoot issues, and manually upgrade users
                    </p>
                </div>
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
                                    onClick={() => window.location.reload()}
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Crypto Payments
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage cryptocurrency payments, troubleshoot issues, and manually upgrade users
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {paymentsData && (
                        <div className="text-right">
                            <div className="text-sm font-medium">
                                {paymentsData.pagination.total.toLocaleString()} total payments
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {paymentsData.payments.length} on this page
                            </div>
                        </div>
                    )}
                    <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
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
            <CreatePaymentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
        </div>
    )
}

