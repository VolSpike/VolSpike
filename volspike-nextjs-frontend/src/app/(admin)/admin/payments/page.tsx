import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PaymentsTable } from '@/components/admin/payments/payments-table'
import { PaymentFilters } from '@/components/admin/payments/payment-filters'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Payments - Admin',
    description: 'Manage crypto payments and troubleshoot payment issues',
}

interface PaymentsPageProps {
    searchParams: Promise<{
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
    }>
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
    const session = await auth()
    const params = await searchParams

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    // Set access token for API client
    adminAPI.setAccessToken(session.accessToken || null)

    try {
        // Parse search params
        const query = {
            userId: params.userId,
            email: params.email,
            paymentStatus: params.paymentStatus,
            tier: params.tier as any,
            paymentId: params.paymentId,
            invoiceId: params.invoiceId,
            orderId: params.orderId,
            page: params.page ? parseInt(params.page) : 1,
            limit: params.limit ? parseInt(params.limit) : 20,
            sortBy: (params.sortBy as any) || 'createdAt',
            sortOrder: (params.sortOrder as any) || 'desc',
        }

        // Fetch payments data
        const paymentsData = await adminAPI.getPayments(query)

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Crypto Payments</h1>
                        <p className="text-muted-foreground">
                            View and manage cryptocurrency payments, troubleshoot issues, and manually upgrade users
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                            {paymentsData.pagination.total} total payments
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <PaymentFilters currentFilters={query} />

                {/* Payments Table */}
                <PaymentsTable
                    payments={paymentsData.payments}
                    pagination={paymentsData.pagination}
                    currentQuery={query}
                />
            </div>
        )
    } catch (error) {
        console.error('Error fetching payments:', error)
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Crypto Payments</h1>
                    <p className="text-muted-foreground">
                        View and manage cryptocurrency payments
                    </p>
                </div>
                <div className="text-center py-12">
                    <p className="text-red-600">Error loading payments. Please try again.</p>
                </div>
            </div>
        )
    }
}

