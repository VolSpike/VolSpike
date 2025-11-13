export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getNextAuthSession } from '@/lib/auth-server'
import { SessionProvider } from 'next-auth/react'
import { Dashboard } from '@/components/dashboard'

export default async function HomePage() {
    const session = await getNextAuthSession()

    return (
        <SessionProvider session={session}>
            <Dashboard />
        </SessionProvider>
    )
}
// Force Vercel rebuild - Sat Oct 25 21:45:18 EST 2025
