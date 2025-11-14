import { Header } from '@/components/header'
import { PricingTiers } from '@/components/pricing-tiers'
import { FeatureComparison } from '@/components/feature-comparison'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Pricing - VolSpike',
  description: 'Choose the perfect plan for your trading needs. From free real-time data to professional-grade tools.',
}

export default async function PricingPage() {
  const session = await getNextAuthSession()
  const userTier = (session?.user as any)?.tier || 'free'

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-background relative">
        <BackgroundPattern />
        <Header />
      
      <main className="container mx-auto px-4 py-12 relative">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 pb-1 bg-gradient-to-r from-brand-600 to-sec-600 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Choose the perfect plan for your trading needs
          </p>
          <p className="text-base text-muted-foreground">
            All plans include real-time Binance data, volume spike alerts, and beautiful analytics. No hidden fees.
          </p>
        </div>

        {/* Pricing Tier Cards - Extra top padding for hover effects */}
        <div className="pt-8">
          <PricingTiers currentTier={userTier} />
        </div>

        {/* Detailed Feature Comparison */}
        <div className="mt-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold mb-4">Feature Comparison</h2>
            <p className="text-muted-foreground">
              See exactly what you get with each tier
            </p>
          </div>
          <FeatureComparison />
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="p-6 rounded-lg border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground mb-2">
                We accept all major credit cards (Visa, MasterCard, American Express) via Stripe, as well as cryptocurrency payments (USDT on Solana/Ethereum, USDC, SOL, BTC, ETH) via NowPayments. All payments are secure and encrypted.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Credit card subscriptions automatically renew monthly. Cryptocurrency subscriptions require manual renewal every 30 days. You&apos;ll receive email reminders before expiration.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">Is there a free trial for Pro or Elite?</h3>
              <p className="text-sm text-muted-foreground">
                The Free tier gives you full access to core features with no time limit. You can upgrade to Pro or Elite anytime to unlock advanced features.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">How do wall-clock updates work?</h3>
              <p className="text-sm text-muted-foreground">
                Free tier updates at :00, :15, :30, :45 of every hour. Pro tier updates every 5 minutes (:00, :05, :10, etc.). Elite tier streams in real-time. All users get updates simultaneously, regardless of when they logged in.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Absolutely. No long-term commitments. Cancel from your settings page, and you&apos;ll retain access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
    </SessionProvider>
  )
}

