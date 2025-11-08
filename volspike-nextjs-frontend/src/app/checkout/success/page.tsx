import { Header } from '@/components/header'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export default async function CheckoutSuccessPage() {
    const session = await getNextAuthSession()

    return (
        <SessionProvider session={session}>
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-12 max-w-2xl">
                    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
                        <div className="flex justify-center mb-4">
                            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Payment Successful</h1>
                        <p className="text-muted-foreground mb-6">
                            Thank you for upgrading! Your Pro features will be available shortly.
                            If you don&apos;t see changes immediately, refresh your session.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 transition">
                                Go to Dashboard
                            </Link>
                            <Link href="/pricing" className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-border hover:bg-muted transition">
                                Back to Pricing
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        </SessionProvider>
    )
}


