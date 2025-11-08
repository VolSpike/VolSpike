'use client'

import { Header } from '@/components/header'
import Link from 'next/link'
import { XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function CheckoutCancelPage() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-12 max-w-2xl">
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
                    <div className="flex justify-center mb-4">
                        <XCircle className="h-14 w-14 text-danger-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Checkout Canceled</h1>
                    <p className="text-muted-foreground mb-6">
                        No problem — you haven&apos;t been charged. You can resume the upgrade anytime.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Link href="/pricing" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 transition">
                            Return to Pricing
                        </Link>
                        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-border hover:bg-muted transition">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}


