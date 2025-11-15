import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { PaymentsPageClient } from '@/components/admin/payments/payments-page-client'

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

    // SECURITY: Strict admin check - only users with role === 'ADMIN' can access
    if (!session?.user) {
        redirect('/auth?next=/admin/payments&mode=admin')
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/payments&mode=admin&error=access_denied')
    }

    // User is authenticated AND has ADMIN role - allow access
    return (
        <AdminLayout>
            <PaymentsPageClient searchParams={params} accessToken={session.accessToken || null} />
        </AdminLayout>
    )
}

