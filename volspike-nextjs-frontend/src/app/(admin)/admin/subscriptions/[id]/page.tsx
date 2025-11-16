import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { SubscriptionDetailClient } from '@/components/admin/subscriptions/subscription-detail-client'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Subscription Details - Admin',
    description: 'View subscription details',
}

interface SubscriptionDetailPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function SubscriptionDetailPage({ params }: SubscriptionDetailPageProps) {
    const session = await auth()
    const { id } = await params

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    // Set access token for API client
    adminAPI.setAccessToken(session.accessToken || null)

    try {
        console.log('[SubscriptionDetailPage] Fetching subscription:', id)
        
        // Fetch subscription details
        const subscriptionData = await adminAPI.getSubscriptionById(id)

        if (!subscriptionData?.subscription) {
            console.error('[SubscriptionDetailPage] Subscription not found:', id)
            notFound()
        }

        console.log('[SubscriptionDetailPage] Subscription fetched successfully:', subscriptionData.subscription.userEmail)

        return (
            <AdminLayout>
                <SubscriptionDetailClient 
                    subscription={subscriptionData.subscription} 
                    user={subscriptionData.user}
                />
            </AdminLayout>
        )
    } catch (error: any) {
        console.error('[SubscriptionDetailPage] Error fetching subscription:', error)
        
        const errorMessage = error?.message || error?.error || 'Unknown error'
        const errorDetails = error?.response || error?.details || null
        
        console.error('[SubscriptionDetailPage] Error details:', {
            message: errorMessage,
            details: errorDetails,
            stack: error?.stack,
        })

        if (error?.status === 404 || errorMessage.includes('not found')) {
            notFound()
        }

        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading subscription</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                            We couldn&apos;t load the subscription data. Please refresh the page to try again.
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

