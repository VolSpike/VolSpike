import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { AcademyDashboard } from './academy-dashboard'

export const metadata: Metadata = {
    title: 'Academy Management - Admin',
    description: 'Manage VolSpike Academy content',
}

export default async function AcademyPage() {
    const session = await auth()

    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/academy&mode=admin')
    }

    return (
        <AdminLayout>
            <AcademyDashboard accessToken={session.accessToken || ''} />
        </AdminLayout>
    )
}
