import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { CreateUserForm } from '@/components/admin/users/create-user-form'

export const metadata: Metadata = {
    title: 'Create User - Admin',
    description: 'Create a new user account',
}

export default async function CreateUserPage() {
    const session = await auth()

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Create New User
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create a new user account and send them an invitation
                    </p>
                </div>

                <CreateUserForm />
            </div>
        </AdminLayout>
    )
}
