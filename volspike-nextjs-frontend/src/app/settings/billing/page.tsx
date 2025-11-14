'use client'

// Billing page: beautiful, action‑oriented, and consistent with Settings UI
// - Shows current tier and renewal window
// - Opens Stripe Billing Portal
// - Upgrade CTA when on Free tier
// - Graceful unauthenticated handling

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'react-hot-toast'
import { CreditCard, ExternalLink, ShieldCheck, Clock, ArrowLeft, Sparkles } from 'lucide-react'

// Mark dynamic to avoid static caching with auth cookies
export const dynamic = 'force-dynamic'

type SubscriptionInfo = {
  id: string
  status: string
  currentPeriodStart: number
  currentPeriodEnd: number
  price: {
    id: string
    amount: number | null
    currency: string | null
    interval?: string | null
  }
}

function useAuthToken(session: any) {
  return useMemo(() => (session?.accessToken || session?.user?.id || null) as string | null, [session])
}

function formatDate(ts?: number) {
  if (!ts) return '—'
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch {
    return '—'
  }
}

function TierBadge({ tier }: { tier: string | null | undefined }) {
  const label = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Free'
  const cls = tier === 'elite'
    ? 'bg-elite-600 dark:bg-elite-500 text-white border-0 shadow-sm'
    : tier === 'pro'
      ? 'bg-sec-600 dark:bg-sec-500 text-white border-0 shadow-sm'
      : 'bg-gray-600 dark:bg-gray-500 text-white border-0 shadow-sm'
  return <Badge className={`text-xs ${cls}`}>{label}</Badge>
}

function BillingInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const token = useAuthToken(session as any)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch(`${API_URL}/api/payments/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setSub(data?.subscription || null)
      } catch (err) {
        console.error('[billing] subscription fetch failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [API_URL, token])

  const tier = (session?.user as any)?.tier || 'free'

  const handlePortal = async () => {
    if (!token) return toast.error('Please sign in again')
    setPortalLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/payments/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Unable to open billing portal')
      window.location.href = data.url
    } catch (e: any) {
      toast.error(e?.message || 'Unable to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!session) { router.push('/auth'); return }
    setUpgradeLoading(true)
    try {
      const { startProCheckout } = await import('@/lib/payments')
      await startProCheckout(session)
    } catch (e: any) {
      toast.error(e?.message || 'Upgrade failed')
    } finally {
      setUpgradeLoading(false)
    }
  }

  return (
    <div className="flex-1 bg-background">
      <HeaderWithBanner />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-4">
          <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Settings
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Billing</CardTitle>
            </div>
            <CardDescription>Manage your subscription, invoices, and payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan summary */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border p-4 bg-card/50">
              <div>
                <div className="text-sm text-muted-foreground">Current Plan</div>
                <div className="mt-1 flex items-center gap-2">
                  <TierBadge tier={tier} />
                  {sub?.price?.amount && sub?.price?.currency && (
                    <div className="text-sm text-muted-foreground">
                      {(sub.price.amount / 100).toLocaleString(undefined, { style: 'currency', currency: (sub.price.currency || 'usd').toUpperCase() })}
                      {sub.price.interval ? ` / ${sub.price.interval}` : ''}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {tier === 'free' ? (
                  <Button onClick={handleUpgrade} disabled={upgradeLoading} className="bg-gradient-to-r from-brand-600 to-sec-600 text-white">
                    <Sparkles className="h-4 w-4 mr-2" /> {upgradeLoading ? 'Loading…' : 'Upgrade to Pro'}
                  </Button>
                ) : (
                  <Button onClick={handlePortal} disabled={portalLoading} className="bg-brand-600 text-white hover:bg-brand-700">
                    {portalLoading ? 'Opening…' : 'Manage Billing'}
                  </Button>
                )}
              </div>
            </div>

            {/* Renewal window */}
            <div className="rounded-lg border p-4 bg-card/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Billing cycle</div>
              </div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading subscription…</div>
              ) : sub ? (
                <div className="text-sm text-muted-foreground">Current period {formatDate(sub.currentPeriodStart)} → <span className="text-foreground">{formatDate(sub.currentPeriodEnd)}</span></div>
              ) : (
                <div className="text-sm text-muted-foreground">No active subscription found.</div>
              )}
            </div>

            <Separator />

            {/* Benefits & reassurance */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 bg-card/50">
                <div className="text-sm font-medium mb-1">What you get</div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Faster market refresh (Pro: 5 min, Elite: live)</li>
                  <li>Open Interest visibility and more symbols</li>
                  <li>Email alerts, in-app notifications</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4 bg-card/50">
                <div className="text-sm font-medium mb-1">Billing control</div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Update payment method anytime</li>
                  <li>Cancel or resume in Stripe portal</li>
                  <li>Immediate proration on plan changes</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4 bg-card/50">
                <div className="text-sm font-medium mb-1">Security</div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><ShieldCheck className="inline h-3.5 w-3.5 mr-1" />Stripe-secured payments</li>
                  <li>Never store card details on VolSpike</li>
                  <li>Receipt & invoices via Stripe</li>
                </ul>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Questions? Visit <Link href="/support" className="underline underline-offset-4">Support</Link> or <Link href="/pricing" className="underline underline-offset-4">Pricing</Link>.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 bg-background">
        <HeaderWithBanner />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Loading…</div>
        </main>
      </div>
    }>
      <BillingInner />
    </Suspense>
  )
}

