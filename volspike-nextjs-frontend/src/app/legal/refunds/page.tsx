import { Header } from '@/components/header'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Refund & Cancellation Policy - VolSpike',
  description: 'Refunds, cancellations, and subscription terms for VolSpike plans.',
}

export default async function RefundsPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">Refund & Cancellation Policy</h1>

            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground mb-8">
                Effective date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Overview</h2>
                <p className="text-muted-foreground">
                  VolSpike is a subscription-based analytics platform for Binance Perpetual Futures.
                  We strive to deliver reliable, real‑time data and alerts. This policy explains how refunds,
                  cancellations, renewals, and downgrades work for our Free, Pro, and Elite plans.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Subscriptions & Billing</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Plans renew automatically each billing cycle (monthly or annually, if available).</li>
                  <li>Payments are processed securely by Stripe; we do not store full card details.</li>
                  <li>Prices and features are listed on the Pricing page and may change with prior notice.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Cancellations</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You may cancel at any time from your account settings or by contacting support.</li>
                  <li>When you cancel, your subscription remains active until the end of the current paid period.</li>
                  <li>After the period ends, your account reverts to the Free tier automatically.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Refunds</h2>
                <p className="text-muted-foreground mb-3">
                  We offer a fair‑use refund approach to protect both customers and service quality:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>
                    <strong>Initial purchase (first subscription):</strong> If the service did not function
                    as described and we cannot resolve a verified issue within a reasonable time,
                    you may request a refund within 7 days of purchase.
                  </li>
                  <li>
                    <strong>Renewals:</strong> Renewal charges are generally non‑refundable. Please cancel before
                    the renewal date to avoid future charges.
                  </li>
                  <li>
                    <strong>Partial/Pro‑rata:</strong> We do not offer partial refunds for unused time in a billing period
                    unless required by applicable law.
                  </li>
                  <li>
                    <strong>Abuse prevention:</strong> Repeated refunds, chargebacks, or abuse of the policy may result
                    in account restriction.
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Downgrades & Upgrades</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Downgrades take effect at the next billing period; current access remains until then.</li>
                  <li>Upgrades apply immediately; we may prorate the difference per Stripe’s standard proration rules.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Non‑Refundable Items</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Fees paid for previous billing periods.</li>
                  <li>Promotional/discounted plans unless required by law.</li>
                  <li>Third‑party services, network issues, or exchange outages beyond our control.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">How to Request a Refund</h2>
                <p className="text-muted-foreground mb-3">
                  To request a refund, contact us at{' '}
                  <a className="underline" href="mailto:support@volspike.com">support@volspike.com</a>{' '}
                  from your registered email and include:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Your account email and purchase/renewal receipt or invoice ID.</li>
                  <li>A brief description of the issue and relevant screenshots/logs.</li>
                </ul>
                <p className="text-muted-foreground">
                  We typically respond within 2–3 business days. Approved refunds are processed back to your original
                  payment method by Stripe and may take 5–10 business days to appear.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">Contact</h2>
                <p className="text-muted-foreground">
                  Questions? Contact us at{' '}
                  <a className="underline" href="mailto:support@volspike.com">support@volspike.com</a>.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </SessionProvider>
  )
}


