import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { AdminAssetsTable } from '@/components/admin/assets/assets-table'

export const metadata: Metadata = {
    title: 'Asset Mappings - Admin',
    description: 'Manage how Binance perpetual symbols map to underlying projects',
}

export default async function AdminAssetsPage() {
    const session = await auth()

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    const accessToken = (session as any)?.accessToken ?? null

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Asset Mappings
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage how Binance perpetual symbols map to underlying projects (CoinGecko ids, names, and links).
                    </p>
                </div>
                <AdminAssetsTable accessToken={accessToken} />
            </div>
        </AdminLayout>
    )
}

