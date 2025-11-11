import { Header } from '@/components/header'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Privacy Policy - VolSpike',
  description: 'VolSpike privacy policy and data protection',
}

export default async function PrivacyPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-background">
        <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

          <div className="space-y-8">
            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
              <p className="text-muted-foreground">
                VolSpike Labs (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
              <p className="text-muted-foreground mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Email address and account credentials</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Trading preferences and watchlist data</li>
                <li>Usage data and analytics</li>
              </ul>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use your information to provide, maintain, and improve our services, including sending you 
                volume spike alerts, processing payments, and providing customer support.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:support@volspike.com" className="text-brand-600 hover:text-brand-700 font-semibold">
                  support@volspike.com
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

