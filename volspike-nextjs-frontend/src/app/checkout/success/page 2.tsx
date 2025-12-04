import { Header } from '@/components/header'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'
import { CheckoutSuccessContent } from '@/components/checkout-success-content'

export default async function CheckoutSuccessPage() {
    const session = await getNextAuthSession()

    return (
        <SessionProvider session={session}>
            <div className="min-h-screen bg-background">
                <Header />
                <CheckoutSuccessContent />
            </div>
        </SessionProvider>
    )
}


