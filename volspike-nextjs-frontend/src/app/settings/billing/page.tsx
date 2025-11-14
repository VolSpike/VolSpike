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
import { toast } from 'react-hot-toast'
import { CreditCard, ExternalLink, ShieldCheck, Clock, ArrowLeft, Sparkles, FileText } from 'lucide-react'

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

type Invoice = {
  id: string
  number?: string | null
  status?: string | null
  amountDue?: number
  amountPaid?: number
  currency?: string | null
  hostedInvoiceUrl?: string | null
  invoicePdf?: string | null
  created?: number
  periodStart?: number | null
  periodEnd?: number | null
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
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)

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
        // Load invoices in parallel once we know user is authenticated
        const invRes = await fetch(`${API_URL}/api/payments/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const invData = await invRes.json().catch(() => ({}))
        if (!cancelled) setInvoices(Array.isArray(invData?.invoices) ? invData.invoices : [])
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

        {/* Hero plan card with gradient and cycle progress */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-brand-900/20 via-slate-900/20 to-sec-900/20 backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-sec-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Your Plan</div>
                <div className="mt-1 flex items-center gap-3">
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
                  <Button onClick={handleUpgrade} disabled={upgradeLoading} className="bg-gradient-to-r from-brand-600 to-sec-600 text-white shadow hover:from-brand-700 hover:to-sec-700">
                    <Sparkles className="h-4 w-4 mr-2" /> {upgradeLoading ? 'Loading…' : 'Upgrade to Pro'}
                  </Button>
                ) : (
                  <Button onClick={handlePortal} disabled={portalLoading} className="bg-brand-600 text-white hover:bg-brand-700 shadow">
                    {portalLoading ? 'Opening…' : 'Manage Billing'}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border bg-card/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Billing cycle</div>
              </div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading subscription…</div>
              ) : sub ? (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">{formatDate(sub.currentPeriodStart)} → <span className="text-foreground">{formatDate(sub.currentPeriodEnd)}</span></div>
                  {/* progress bar */}
                  {(() => {
                    const now = Date.now() / 1000
                    const start = sub.currentPeriodStart
                    const end = sub.currentPeriodEnd
                    const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100))
                    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400))
                    return (
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted/60 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sec-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{daysLeft} day{daysLeft === 1 ? '' : 's'} left</div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active subscription found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Details grid: benefits and invoices */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Benefits</CardTitle>
              <CardDescription>Highlights of your current access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 bg-card/50">
                  <div className="text-sm font-medium mb-1">Market data</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Elite: live; Pro: 5 min; Free: 15 min</li>
                    <li>More symbols + Open Interest on Pro/Elite</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4 bg-card/50">
                  <div className="text-sm font-medium mb-1">Alerts</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Email notifications on Pro</li>
                    <li>SMS on Elite (when enabled)</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4 bg-card/50">
                  <div className="text-sm font-medium mb-1">Control</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Update payment method anytime</li>
                    <li>Cancel or resume in Stripe portal</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4 bg-card/50">
                  <div className="text-sm font-medium mb-1">Security</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><ShieldCheck className="inline h-3.5 w-3.5 mr-1" />Stripe‑secured payments</li>
                    <li>No card data stored by VolSpike</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent invoices</CardTitle>
              </div>
              <CardDescription>Download receipts or open in Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices === null ? (
                <div className="text-sm text-muted-foreground">Loading invoices…</div>
              ) : invoices.length === 0 ? (
                <div className="text-sm text-muted-foreground">No invoices yet.</div>
              ) : (
                <div className="space-y-2">
                  {invoices.slice(0, 6).map((inv) => (
                    <a key={inv.id} href={inv.hostedInvoiceUrl || inv.invoicePdf || '#'} target="_blank" rel="noreferrer" className="group flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{inv.number || inv.id}</div>
                        <div className="text-xs text-muted-foreground">{inv.created ? formatDate(inv.created) : '—'} • {(inv.amountPaid ?? inv.amountDue ?? 0) / 100}
                          {inv.currency ? ` ${(inv.currency || 'usd').toUpperCase()}` : ''}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    </a>
                  ))}
                  <div className="pt-2">
                    <Button variant="outline" onClick={handlePortal} className="w-full">Open Stripe Portal</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          Questions? Visit <Link href="/support" className="underline underline-offset-4">Support</Link> or <Link href="/pricing" className="underline underline-offset-4">Pricing</Link>.
        </div>
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
