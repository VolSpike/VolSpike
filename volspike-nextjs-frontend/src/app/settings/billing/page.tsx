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
import { CreditCard, ExternalLink, Clock, ArrowLeft, Sparkles, FileText, Bell, Download, Lock, Activity, Database } from 'lucide-react'

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

type CryptoPayment = {
  id: string
  paymentId?: string | null
  invoiceId?: string | number | null
  orderId?: string | null
  status?: string | null
  tier?: string | null
  payAmount?: number | null
  payCurrency?: string | null
  actuallyPaid?: number | null
  actuallyPaidCurrency?: string | null
  createdAt?: string | null
  paidAt?: string | null
  expiresAt?: string | null
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

function formatISODate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

function CryptoStatusBadge({ status }: { status?: string | null }) {
  const normalized = (status || '').toLowerCase()
  let cls =
    'bg-gray-600 dark:bg-gray-500 text-white border-0 shadow-sm'
  let label = status || 'Unknown'

  if (normalized === 'finished' || normalized === 'confirmed') {
    cls = 'bg-emerald-600 dark:bg-emerald-500 text-white border-0 shadow-sm'
    label = 'Completed'
  } else if (
    normalized === 'waiting' ||
    normalized === 'confirming' ||
    normalized === 'sending' ||
    normalized === 'partially_paid'
  ) {
    cls = 'bg-amber-500 dark:bg-amber-500 text-white border-0 shadow-sm'
    label = 'Processing'
  } else if (
    normalized === 'failed' ||
    normalized === 'expired' ||
    normalized === 'refunded'
  ) {
    cls = 'bg-destructive text-destructive-foreground border-0 shadow-sm'
    label = 'Problem'
  }

  return <Badge className={`text-[10px] ${cls}`}>{label}</Badge>
}

function BillingInner() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const token = useAuthToken(session as any)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [cryptoPayments, setCryptoPayments] = useState<CryptoPayment[] | null>(null)

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

        // Load crypto payment history (NOWPayments)
        const cryptoRes = await fetch(`${API_URL}/api/payments/nowpayments/history`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }).catch(() => null)

        if (cryptoRes && cryptoRes.ok) {
          const cryptoData = await cryptoRes.json().catch(() => ({}))
          if (!cancelled) {
            setCryptoPayments(Array.isArray(cryptoData?.payments) ? cryptoData.payments : [])
          }
        } else if (!cancelled) {
          setCryptoPayments([])
        }
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

  // Feature chips — dynamic to current tier
  const includedFeatures = useMemo(() => {
    switch (tier) {
      case 'elite':
        return [
          { icon: Activity, label: 'Live WebSocket updates' },
          { icon: TrendingUpIcon, label: 'Unlimited symbols' },
          { icon: Database, label: 'Open Interest' },
          { icon: Bell, label: 'Email + SMS alerts' },
          { icon: Download, label: 'CSV / JSON export' },
        ]
      case 'pro':
        return [
          { icon: Clock, label: '5‑min refresh' },
          { icon: TrendingUpIcon, label: '100 symbols' },
          { icon: Database, label: 'Open Interest' },
          { icon: Bell, label: 'Email alerts' },
          { icon: Download, label: 'CSV / JSON export' },
        ]
      default:
        return [
          { icon: Clock, label: '15‑min refresh' },
          { icon: TrendingUpIcon, label: 'Top 50 symbols' },
          { icon: Bell, label: 'In‑app notifications' },
        ]
    }
  }, [tier])

  const lockedFeatures = useMemo(() => {
    if (tier === 'elite') return []
    if (tier === 'pro') {
      return [
        { icon: Activity, label: 'Live WebSocket updates' },
        { icon: TrendingUpIcon, label: 'Unlimited symbols' },
        { icon: Bell, label: 'SMS alerts' },
      ]
    }
    // free
    return [
      { icon: Clock, label: '5‑min refresh' },
      { icon: Database, label: 'Open Interest' },
      { icon: TrendingUpIcon, label: '100+ symbols' },
      { icon: Bell, label: 'Email alerts' },
      { icon: Download, label: 'CSV / JSON export' },
      { icon: Activity, label: 'Live WebSocket updates' },
      { icon: Bell, label: 'SMS alerts' },
    ]
  }, [tier])

  function TrendingUpIcon(props: any) {
    // small local alias to keep imports tidy
    return <svg {...props} viewBox="0 0 24 24" className={(props.className || '') + ' fill-none stroke-current'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
  }

  function FeatureChip({ icon: Icon, label, locked = false }: { icon: any; label: string; locked?: boolean }) {
    return (
      <div className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${locked ? 'border-border/60 bg-muted/40 text-muted-foreground' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300'} transition-colors`}
           title={locked ? 'Unlock with upgrade' : 'Included in your plan'}>
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${locked ? 'bg-muted/60 text-muted-foreground' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        </span>
        <span className="truncate">{label}</span>
      </div>
    )
  }

  // No auth checks - just render the page
  // The header will handle showing login state correctly

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

        {/* Details grid: feature chips and invoices */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Included in your plan</CardTitle>
              <CardDescription>Fast overview of what you get</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {includedFeatures.map((f, i) => (
                  <FeatureChip key={i} icon={f.icon} label={f.label} />
                ))}
              </div>

              {lockedFeatures.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Unlock more</div>
                  <div className="flex flex-wrap gap-2">
                    {lockedFeatures.map((f, i) => (
                      <FeatureChip key={`l-${i}`} icon={f.icon} label={f.label} locked />
                    ))}
                  </div>
                  <div className="mt-3">
                    <Link href="/pricing" className="text-sm text-brand-500 hover:underline inline-flex items-center">See full comparison<ExternalLink className="h-3.5 w-3.5 ml-1" /></Link>
                  </div>
                </div>
              )}
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

              {cryptoPayments && cryptoPayments.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Crypto payments
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Powered by NOWPayments
                    </span>
                  </div>
                  <div className="space-y-2">
                    {cryptoPayments.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border p-3 bg-background/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">
                              {p.tier ? `${p.tier.charAt(0).toUpperCase()}${p.tier.slice(1)} tier` : 'Crypto payment'}
                            </span>
                            <CryptoStatusBadge status={p.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatISODate(p.paidAt || p.createdAt)} •{' '}
                            {p.actuallyPaid ?? p.payAmount ?? 0}{' '}
                            {(p.actuallyPaidCurrency || p.payCurrency || 'usd').toString().toUpperCase()}
                          </div>
                          {p.paymentId && (
                            <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                              NOWPayments ID: {p.paymentId}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
