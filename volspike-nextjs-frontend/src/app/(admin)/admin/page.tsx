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

    // SECURITY: Strict admin check - only users with role === 'ADMIN' can access
    // This check happens on the server side and cannot be bypassed
    if (!session?.user) {
        // No session - redirect to auth
        redirect('/auth?next=/admin&mode=admin')
    }

    // SECURITY: Explicit role check - must be exactly 'ADMIN' (case-sensitive)
    if (session.user.role !== 'ADMIN') {
        // User is authenticated but not admin - redirect to auth with error
        redirect('/auth?next=/admin&mode=admin&error=access_denied')
    }

    // User is authenticated AND has ADMIN role - allow access
    return <AdminDashboardClient />
}
