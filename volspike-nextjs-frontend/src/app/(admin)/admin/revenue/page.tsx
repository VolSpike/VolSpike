// SERVER COMPONENT – no "use client" here
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import RevenueAnalyticsClient from './revenue-analytics-client'

export const metadata: Metadata = {
    title: 'Revenue Analytics - Admin - VolSpike',
    description: 'Detailed revenue analytics and insights for VolSpike platform',
}

export default async function RevenueAnalyticsPage() {
    const session = await auth()

    // SECURITY: Strict admin check
    if (!session?.user) {
        redirect('/auth?next=/admin/revenue&mode=admin')
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/revenue&mode=admin&error=access_denied')
    }

    return (
        <AdminLayout>
            <RevenueAnalyticsClient />
        </AdminLayout>
    )
}

