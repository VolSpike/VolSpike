import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { PaymentsPageClient } from '@/components/admin/payments/payments-page-client'
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

    if (!session?.user) {
        redirect('/auth?next=/admin/payments&mode=admin')
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/payments&mode=admin&error=access_denied')
    }

    // CRITICAL: Check if accessToken exists - required for admin API calls
    const accessToken = (session as any)?.accessToken
    if (!accessToken) {
        console.error('[PaymentsPage] No access token in session - redirecting to re-authenticate', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            role: session?.user?.role,
            note: 'Admin API requires JWT token in session.accessToken',
        })
        redirect('/auth?next=/admin/payments&mode=admin&error=token_missing')
    }

    // Verify token looks like a JWT (contains dots)
    if (!accessToken.includes('.')) {
        console.error('[PaymentsPage] Invalid token format (not a JWT)', {
            tokenLength: accessToken.length,
            tokenPreview: accessToken.substring(0, 20),
            note: 'Admin API requires JWT token format',
        })
        redirect('/auth?next=/admin/payments&mode=admin&error=invalid_token')
    }

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

    try {
        adminAPI.setAccessToken(accessToken)
        const paymentsData = await adminAPI.getPayments(query)

        return (
            <AdminLayout>
                <PaymentsPageClient
                    initialData={paymentsData}
                    query={query}
                    accessToken={accessToken}
                />
            </AdminLayout>
        )
    } catch (error) {
        console.error('Error fetching payments (server):', error)
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30 p-6">
                        <p className="text-red-700 dark:text-red-200 font-semibold mb-2">Error loading payments</p>
                        <p className="text-sm text-red-600 dark:text-red-300">
                            We couldn&apos;t load the payments data. Please refresh the page to try again.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        )
    }
}

