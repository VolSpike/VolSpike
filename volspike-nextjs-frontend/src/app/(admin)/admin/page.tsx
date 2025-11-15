// SERVER COMPONENT – no "use client" here
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AdminDashboardClient from './admin-dashboard-client'

export const metadata: Metadata = {
    title: 'Admin Dashboard - VolSpike',
    description: 'Admin dashboard for managing VolSpike platform',
}

export default async function AdminPage() {
    const session = await auth()

    // Check if user is admin using NextAuth session (works with all auth methods)
    if (!session?.user || session.user.role !== 'ADMIN') {
        // always redirect from the server – consistent tree
        redirect('/auth?next=/admin&mode=admin')
    }

    // Render admin as a stable tree; client components are loaded directly
    return <AdminDashboardClient />
}
