import { Header } from '@/components/header'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Terms of Service - VolSpike',
  description: 'VolSpike terms of service and usage agreement',
}

export default async function TermsPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-background">
        <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg text-muted-foreground mb-8">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using VolSpike, you agree to be bound by these Terms of Service and all applicable 
                laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Use License</h2>
              <p className="text-muted-foreground">
                Permission is granted to access and use VolSpike for personal or commercial trading purposes. 
                This license shall automatically terminate if you violate any of these restrictions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Disclaimer</h2>
              <p className="text-muted-foreground">
                VolSpike provides market data and analytics for informational purposes only. We do not provide 
                financial, investment, or trading advice. Trading cryptocurrencies carries risk, and you should 
                conduct your own research before making trading decisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Subscription and Billing</h2>
              <p className="text-muted-foreground">
                Paid subscriptions are billed monthly or annually. You may cancel your subscription at any time, 
                and you will retain access until the end of your billing period.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@volspike.com" className="text-brand-600 hover:text-brand-700">
                  legal@volspike.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
    </SessionProvider>
  )
}

