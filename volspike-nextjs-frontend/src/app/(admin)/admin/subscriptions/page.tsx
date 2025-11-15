import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { SubscriptionsTable } from '@/components/admin/subscriptions/subscriptions-table'
import { SubscriptionFilters } from '@/components/admin/subscriptions/subscription-filters'
import { BulkSyncButton } from '@/components/admin/subscriptions/bulk-sync-button'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Subscriptions - Admin',
    description: 'Manage user subscriptions and billing',
}

interface SubscriptionsPageProps {
    searchParams: Promise<{
        userId?: string
        status?: string
        tier?: string
        page?: string
        limit?: string
        sortBy?: string
        sortOrder?: string
    }>
}

export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
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
            userId: params.userId,
            status: params.status as any,
            tier: params.tier as any,
            page: params.page ? parseInt(params.page) : 1,
            limit: params.limit ? parseInt(params.limit) : 20,
            sortBy: params.sortBy as any || 'createdAt',
            sortOrder: params.sortOrder as any || 'desc',
        }

        // Fetch subscriptions data
        const subscriptionsData = await adminAPI.getSubscriptions(query)

        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Subscriptions
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Manage user subscriptions and billing
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <BulkSyncButton subscriptions={subscriptionsData.subscriptions} />
                            <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
                                <span className="text-sm font-medium text-foreground">
                                    {subscriptionsData.pagination.total.toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">total subscriptions</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <SubscriptionFilters currentFilters={query} />

                    {/* Subscriptions Table */}
                    <SubscriptionsTable
                        subscriptions={subscriptionsData.subscriptions}
                        pagination={subscriptionsData.pagination}
                        currentQuery={query}
                    />
                </div>
            </AdminLayout>
        )
    } catch (error) {
        console.error('Error fetching subscriptions:', error)
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Subscriptions
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage user subscriptions and billing
                        </p>
                    </div>
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading subscriptions</h3>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            We couldn&apos;t load the subscriptions data. Please refresh the page to try again.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        )
    }
}
