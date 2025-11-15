import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { AuditLogTable } from '@/components/admin/audit/audit-log-table'
import { AuditFilters } from '@/components/admin/audit/audit-filters'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Audit Logs - Admin',
    description: 'View and manage audit logs',
}

interface AuditPageProps {
    searchParams: Promise<{
        actorUserId?: string
        action?: string
        targetType?: string
        targetId?: string
        startDate?: string
        endDate?: string
        page?: string
        limit?: string
        sortBy?: string
        sortOrder?: string
    }>
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
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
            actorUserId: params.actorUserId,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
            startDate: params.startDate ? new Date(params.startDate) : undefined,
            endDate: params.endDate ? new Date(params.endDate) : undefined,
            page: params.page ? parseInt(params.page) : 1,
            limit: params.limit ? parseInt(params.limit) : 20,
            sortBy: params.sortBy as any || 'createdAt',
            sortOrder: params.sortOrder as any || 'desc',
        }

        // Fetch audit logs data
        const auditData = await adminAPI.getAuditLogs(query)

        return (
            <AdminLayout>
                <div className="space-y-6">
                    {/* Header with count */}
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
                            <span className="text-sm font-semibold text-foreground">
                                {auditData.pagination.total.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1.5">logs</span>
                        </div>
                    </div>

                    {/* Filters */}
                    <AuditFilters currentFilters={query} />

                    {/* Audit Logs Table */}
                    <AuditLogTable
                        logs={auditData.logs}
                        pagination={auditData.pagination}
                        currentQuery={query}
                    />
                </div>
            </AdminLayout>
        )
    } catch (error) {
        console.error('Error fetching audit logs:', error)
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading audit logs</h3>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            We couldn&apos;t load the audit logs. Please refresh the page to try again.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        )
    }
}
