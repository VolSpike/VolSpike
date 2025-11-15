import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { AdminAssetsTable } from '@/components/admin/assets/assets-table'

export default async function AdminAssetsPage() {
    const session = await getServerSession(authOptions as any)
    const accessToken = (session as any)?.accessToken ?? null

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Asset Mappings</h1>
                <p className="text-sm text-muted-foreground">
                    Manage how Binance perpetual symbols map to underlying projects (CoinGecko ids, names, and links).
                </p>
            </div>
            <AdminAssetsTable accessToken={accessToken} />
        </div>
    )
}

