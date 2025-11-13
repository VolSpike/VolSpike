export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getNextAuthSession } from '@/lib/auth-server'
import { Dashboard } from '@/components/dashboard'
import { SessionProvider } from 'next-auth/react'

export default async function DashboardPage() {
    console.log('[Dashboard] Starting dashboard page load')
    const session = await getNextAuthSession()
    console.log('[Dashboard] NextAuth session:', session ? 'Found' : 'Not found')

    const role = (session.user as any).role || 'user'
    console.log('[Dashboard] Authentication successful, user role:', role)

    return (
        <SessionProvider session={session}>
            <Dashboard />
        </SessionProvider>
    )
}
