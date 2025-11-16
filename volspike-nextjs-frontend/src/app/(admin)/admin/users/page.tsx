import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { UsersTable } from '@/components/admin/users/users-table'
import { UserFilters } from '@/components/admin/users/user-filters'
import { UserActions } from '@/components/admin/users/user-actions'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Users Management - Admin',
    description: 'Manage users and their accounts',
}

interface UsersPageProps {
    searchParams: Promise<{
        search?: string
        role?: string
        tier?: string
        status?: string
        page?: string
        limit?: string
        sortBy?: string
        sortOrder?: string
    }>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
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
            search: params.search,
            role: params.role as any,
            tier: params.tier as any,
            status: params.status as any,
            page: params.page ? parseInt(params.page) : 1,
            limit: params.limit ? parseInt(params.limit) : 20,
            sortBy: params.sortBy as any || 'createdAt',
            sortOrder: params.sortOrder as any || 'desc',
        }

        // Fetch users data
        const usersData = await adminAPI.getUsers(query)

        return (
            <AdminLayout>
                <div className="space-y-4 sm:space-y-6">
                    {/* Header with user count and actions - Responsive */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-sm">
                                <span className="text-sm sm:text-base font-semibold text-foreground">
                                    {usersData.pagination.total.toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1.5">users</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <UserActions />
                        </div>
                    </div>

                    {/* Filters */}
                    <UserFilters currentFilters={query} />

                    {/* Users Table */}
                    <UsersTable
                        users={usersData.users}
                        pagination={usersData.pagination}
                        currentQuery={query}
                    />
                </div>
            </AdminLayout>
        )
    } catch (error: any) {
        console.error('[UsersPage] Error fetching users:', error)
        
        // Extract error message for better debugging
        const errorMessage = error?.message || error?.error || 'Unknown error'
        const errorDetails = error?.response || error?.details || null
        
        console.error('[UsersPage] Error details:', {
            message: errorMessage,
            details: errorDetails,
            stack: error?.stack,
        })
        
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading users</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                            We couldn&apos;t load the users data. Please refresh the page to try again.
                        </p>
                        {process.env.NODE_ENV === 'development' && (
                            <details className="mt-4 text-left">
                                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                                    Debug Information
                                </summary>
                                <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify({ errorMessage, errorDetails }, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            </AdminLayout>
        )
    }
}
