import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { PromoCodesPageClient } from '@/components/admin/promo-codes/promo-codes-page-client'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Promo Codes - Admin',
    description: 'Manage promotional codes and discounts',
}

interface PromoCodesPageProps {
    searchParams: Promise<{
        status?: string
        sortBy?: string
        sortOrder?: string
        page?: string
        limit?: string
    }>
}

export default async function PromoCodesPage({ searchParams }: PromoCodesPageProps) {
    const session = await auth()
    const params = await searchParams

    if (!session?.user) {
        redirect('/auth?next=/admin/promo-codes&mode=admin')
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/promo-codes&mode=admin&error=access_denied')
    }

    // Check access token
    const accessToken = (session as any)?.accessToken
    if (!accessToken) {
        console.error('[PromoCodesPage] No access token in session')
        redirect('/auth?next=/admin/promo-codes&mode=admin&error=token_missing')
    }

    if (!accessToken.includes('.')) {
        console.error('[PromoCodesPage] Invalid token format (not a JWT)')
        redirect('/auth?next=/admin/promo-codes&mode=admin&error=invalid_token')
    }

    const query = {
        status: (params.status as any) || 'all',
        sortBy: (params.sortBy as any) || 'createdAt',
        sortOrder: (params.sortOrder as any) || 'desc',
        page: params.page ? parseInt(params.page) : 1,
        limit: params.limit ? parseInt(params.limit) : 20,
    }

    try {
        adminAPI.setAccessToken(accessToken)
        const promoCodesData = await adminAPI.getPromoCodes(query)

        return (
            <AdminLayout>
                <PromoCodesPageClient
                    initialData={promoCodesData}
                    query={query}
                    accessToken={accessToken}
                />
            </AdminLayout>
        )
    } catch (error) {
        console.error('Error fetching promo codes (server):', error)
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30 p-6">
                        <p className="text-red-700 dark:text-red-200 font-semibold mb-2">Error loading promo codes</p>
                        <p className="text-sm text-red-600 dark:text-red-300">
                            We couldn&apos;t load the promo codes data. Please refresh the page to try again.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        )
    }
}
