import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { AdminNotificationsTable } from '@/components/admin/notifications/admin-notifications-table'

export const metadata: Metadata = {
    title: 'Notifications - Admin',
    description: 'View and manage admin notifications',
}

export default async function AdminNotificationsPage() {
    const session = await auth()

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    const accessToken = (session as any)?.accessToken ?? null

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Notifications
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage system notifications for admin review.
                    </p>
                </div>
                <AdminNotificationsTable accessToken={accessToken} />
            </div>
        </AdminLayout>
    )
}

