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
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          
          <div className="space-y-8">
            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
              <p className="text-muted-foreground mb-3">
                By accessing and using VolSpike (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). 
                If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p className="text-muted-foreground">
                These Terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground mb-3">
                VolSpike is a real-time market data and alert platform for Binance perpetual futures traders. We provide:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Real-time market data from Binance via WebSocket connections</li>
                <li>Volume spike detection and alert notifications</li>
                <li>Market analytics and data export capabilities</li>
                <li>Tiered subscription plans (Free, Pro, Elite)</li>
              </ul>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground mb-3">
                When you create an account with us, you must provide accurate, complete, and current information. 
                Failure to do so constitutes a breach of the Terms.
              </p>
              <p className="text-muted-foreground mb-3">
                You are responsible for safeguarding your account password and for any activities or actions under your account. 
                You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate your account if you violate these Terms or engage in fraudulent, 
                abusive, or otherwise harmful behavior.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">4. Subscriptions and Billing</h2>
              <p className="text-muted-foreground mb-3">
                <strong>Free Tier:</strong> Available at no cost with limited features (50 symbols, 15-minute updates, 10 alerts).
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>Paid Subscriptions:</strong> Pro ($19/month) and Elite ($49/month) tiers are billed monthly via Stripe.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>Automatic Renewal:</strong> Subscriptions automatically renew each billing period unless canceled.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>Cancellation:</strong> You may cancel your subscription at any time from your Settings page. 
                You will retain access to paid features until the end of your current billing period.
              </p>
              <p className="text-muted-foreground">
                <strong>Refunds:</strong> Refunds are provided on a case-by-case basis. Contact support@volspike.com for refund requests.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">5. Use License and Restrictions</h2>
              <p className="text-muted-foreground mb-3">
                Subject to these Terms, we grant you a limited, non-exclusive, non-transferable license to access and use VolSpike 
                for your personal or commercial trading purposes.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>You may NOT:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Modify, copy, or create derivative works of the Service</li>
                <li>Reverse engineer, decompile, or attempt to extract source code</li>
                <li>Resell, redistribute, or sublicense access to the Service</li>
                <li>Use automated tools to scrape or harvest data beyond intended API usage</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">6. Data and Market Information</h2>
              <p className="text-muted-foreground mb-3">
                All market data is sourced from Binance&apos;s public APIs and WebSocket streams. We do not guarantee:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li>The accuracy, completeness, or timeliness of market data</li>
                <li>Uninterrupted or error-free service availability</li>
                <li>That data will be free from bugs, viruses, or other harmful components</li>
              </ul>
              <p className="text-muted-foreground">
                You acknowledge that market data may be delayed, inaccurate, or unavailable due to factors beyond our control, 
                including but not limited to: Binance API outages, network issues, or third-party service failures.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">7. Trading Disclaimer</h2>
              <p className="text-muted-foreground mb-3">
                <strong className="text-warning-600 dark:text-warning-400">IMPORTANT:</strong> VolSpike is a data analytics tool only. 
                We do NOT provide financial, investment, or trading advice.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>You acknowledge that:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li>Cryptocurrency trading involves substantial risk of loss</li>
                <li>You are solely responsible for your trading decisions</li>
                <li>Past performance does not guarantee future results</li>
                <li>Volume spikes and alerts are informational only, not trading recommendations</li>
                <li>You should consult with qualified financial advisors before making investment decisions</li>
              </ul>
              <p className="text-muted-foreground">
                <strong>We are NOT liable for any trading losses</strong> you may incur while using our Service.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
              <p className="text-muted-foreground mb-3">
                The Service and its original content (excluding user data and third-party data), features, and functionality 
                are and will remain the exclusive property of VolSpike Labs and its licensors.
              </p>
              <p className="text-muted-foreground">
                Our trademarks, logos, and service marks displayed on the Service are our property. You may not use these 
                without our prior written permission.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">9. User Content and Data</h2>
              <p className="text-muted-foreground mb-3">
                You retain ownership of any data you provide to the Service (watchlists, alert preferences, etc.).
              </p>
              <p className="text-muted-foreground">
                By using the Service, you grant us a license to use, store, and process your data solely for the purpose 
                of providing and improving the Service. We will not sell your personal data to third parties.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-3">
                To the maximum extent permitted by law, VolSpike Labs shall not be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li>Loss of profits, revenue, or trading opportunities</li>
                <li>Loss of data or business interruption</li>
                <li>Trading losses resulting from using or inability to use the Service</li>
                <li>Damages resulting from data inaccuracies or delays</li>
              </ul>
              <p className="text-muted-foreground">
                Our total liability for any claim arising out of or relating to these Terms or the Service shall not exceed 
                the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">11. Service Modifications</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time 
                with or without notice. We may also modify these Terms at any time. Continued use of the Service after 
                such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
              <p className="text-muted-foreground mb-3">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, 
                for any reason, including but not limited to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li>Violation of these Terms</li>
                <li>Fraudulent or abusive behavior</li>
                <li>Non-payment of subscription fees</li>
                <li>Violation of applicable laws or regulations</li>
              </ul>
              <p className="text-muted-foreground">
                Upon termination, your right to use the Service will cease immediately. All provisions of the Terms which 
                by their nature should survive termination shall survive.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">13. Third-Party Services</h2>
              <p className="text-muted-foreground mb-3">
                The Service integrates with third-party services including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li><strong>Binance:</strong> Market data provider</li>
                <li><strong>Stripe:</strong> Payment processing</li>
                <li><strong>SendGrid:</strong> Email notifications</li>
                <li><strong>RainbowKit/WalletConnect:</strong> Web3 wallet integration</li>
              </ul>
              <p className="text-muted-foreground">
                Your use of these third-party services is subject to their respective terms and privacy policies. 
                We are not responsible for the actions or policies of these third parties.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">14. API Usage (Elite Tier)</h2>
              <p className="text-muted-foreground mb-3">
                Elite tier subscribers may access our API subject to rate limits and usage policies. API access is provided 
                &quot;as is&quot; and may be modified or discontinued at any time.
              </p>
              <p className="text-muted-foreground">
                Abuse of API access, including excessive requests or attempts to circumvent rate limits, may result in 
                immediate termination of your account.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">15. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless VolSpike Labs, its officers, directors, employees, and agents 
                from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or 
                relating to your use of the Service or violation of these Terms.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">16. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the United States, 
                without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service 
                shall be resolved through binding arbitration or in courts located in the United States.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">17. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material 
                change will be determined at our sole discretion.
              </p>
            </section>

            <section className="p-6 rounded-lg border border-border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-4">18. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:support@volspike.com" className="text-brand-600 hover:text-brand-700 font-semibold">
                  support@volspike.com
                </a>
              </p>
            </section>

            {/* Acceptance Notice */}
            <div className="p-6 rounded-lg border-2 border-brand-500/30 bg-brand-500/5">
              <p className="text-sm text-muted-foreground text-center">
                By using VolSpike, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
    </SessionProvider>
  )
}

