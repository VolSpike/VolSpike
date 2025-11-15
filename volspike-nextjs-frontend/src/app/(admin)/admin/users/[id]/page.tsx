import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { UserDetailClient } from '@/components/admin/users/user-detail-client'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'User Details - Admin',
    description: 'View and manage user account details',
}

interface UserDetailPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
    const session = await auth()
    const { id } = await params

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    // Set access token for API client
    adminAPI.setAccessToken(session.accessToken || null)

    try {
        console.log('[UserDetailPage] Fetching user:', id)
        
        // Fetch user details
        const userData = await adminAPI.getUserById(id)

        if (!userData?.user) {
            console.error('[UserDetailPage] User not found:', id)
            notFound()
        }

        console.log('[UserDetailPage] User fetched successfully:', userData.user.email)

        return (
            <AdminLayout>
                <UserDetailClient user={userData.user} subscription={userData.subscription} />
            </AdminLayout>
        )
    } catch (error: any) {
        console.error('[UserDetailPage] Error fetching user:', {
            userId: id,
            error: error?.message,
            status: error?.status,
            response: error?.response,
        })

        // If user not found, return 404
        if (error?.status === 404) {
            notFound()
        }

        // Otherwise show error
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading user</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                            We couldn&apos;t load the user data. Please try again.
                        </p>
                        {process.env.NODE_ENV === 'development' && (
                            <details className="mt-4 text-left">
                                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                                    Debug Information
                                </summary>
                                <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify({ 
                                        userId: id,
                                        error: error?.message,
                                        status: error?.status,
                                    }, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            </AdminLayout>
        )
    }
}

