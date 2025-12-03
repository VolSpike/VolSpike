'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Bell, BarChart3, ExternalLink, Coins, RefreshCw, Loader2, Lock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { format, formatDistanceToNow } from 'date-fns'
import type { VolumeAlert } from '@/hooks/use-volume-alerts'

export default function AlertPreviewPage() {
  const [alerts, setAlerts] = useState<VolumeAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Fetch real alerts from the API
  const fetchAlerts = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      // Use tier=pro to get alerts as Pro users see them
      const response = await fetch(`${apiUrl}/api/volume-alerts?limit=20&tier=pro`)
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`)
      }
      const data = await response.json()
      setAlerts(data.alerts || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchAlerts()
  }, [])

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchAlerts(false) // Don't show loading spinner on auto-refresh
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // Helper functions
  const formatVolume = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
    return `$${value.toFixed(0)}`
  }

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(2)}`
    return `$${price.toFixed(4)}`
  }

  const formatPercentChange = (value: number | undefined | null) => {
    if (value === undefined || value === null) return null
    const pct = value * 100
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(2)}%`
  }

  const getPercentChangeColor = (value: number | undefined | null) => {
    if (value === undefined || value === null) return ''
    return value >= 0
      ? 'text-brand-600 dark:text-brand-400'
      : 'text-danger-600 dark:text-danger-400'
  }

  const formatExactTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a')
  }

  const formatRelativeTime = (timestamp: string) => {
    const relative = formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    return relative.replace('about ', '')
  }

  // Render a single alert card
  const renderAlertCard = (alert: VolumeAlert, tier: 'free' | 'pro' | 'elite') => {
    const isBullish = alert.candleDirection === 'bullish'
    const isBearish = alert.candleDirection === 'bearish'

    return (
      <div
        key={`${alert.id}-${tier}`}
        className={`rounded-lg border p-3 transition-all duration-150 ${
          isBullish
            ? 'border-brand-500/30 bg-brand-500/5'
            : isBearish
              ? 'border-danger-500/30 bg-danger-500/5'
              : 'border-border'
        }`}
      >
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {isBearish ? (
                <TrendingDown className="h-4 w-4 flex-shrink-0 text-danger-500" />
              ) : (
                <TrendingUp className={`h-4 w-4 flex-shrink-0 ${isBullish ? 'text-brand-500' : 'text-muted-foreground'}`} />
              )}
              <span className="text-base font-semibold">{alert.asset}</span>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatExactTime(alert.timestamp)}
              </div>
              <div className="text-xs text-muted-foreground/70 whitespace-nowrap">
                ({formatRelativeTime(alert.timestamp)})
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs font-mono-tabular ${
                isBullish
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400'
                  : isBearish
                    ? 'bg-danger-500/10 border-danger-500/30 text-danger-600 dark:text-danger-400'
                    : 'bg-brand-500/10 border-brand-500/30'
              }`}
            >
              {alert.volumeRatio.toFixed(2)}x
            </Badge>
            {alert.isUpdate && (
              <Badge variant="secondary" className="text-xs">
                {alert.alertType === 'HALF_UPDATE' ? '30m Update' : 'Hourly Update'}
              </Badge>
            )}
          </div>

          {/* Volume */}
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <div>This hour: {formatVolume(alert.currentVolume)}</div>
            <div className="text-xs opacity-70">Last hour: {formatVolume(alert.previousVolume)}</div>
          </div>

          {/* Metrics row - varies by tier */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {/* Price display: Both Free and Pro see % change when available */}
              {formatPercentChange(alert.priceChange) ? (
                <span>
                  Price: <span className={getPercentChangeColor(alert.priceChange)}>{formatPercentChange(alert.priceChange)}</span>
                </span>
              ) : alert.price ? (
                <span>Price: {formatPrice(alert.price)}</span>
              ) : null}

              {/* Funding rate - only color values >0.03% or <-0.03% */}
              {alert.fundingRate !== undefined && alert.fundingRate !== null && (
                <span>
                  Funding:{' '}
                  <span
                    className={
                      alert.fundingRate > 0.0003
                        ? 'text-brand-600 dark:text-brand-400'
                        : alert.fundingRate < -0.0003
                          ? 'text-danger-600 dark:text-danger-400'
                          : ''
                    }
                  >
                    {(alert.fundingRate * 100).toFixed(3)}%
                  </span>
                </span>
              )}

              {/* OI change - Pro sees value, Free sees faded with upgrade tooltip */}
              {tier === 'pro' && formatPercentChange(alert.oiChange) && (
                <span>
                  OI: <span className={getPercentChangeColor(alert.oiChange)}>{formatPercentChange(alert.oiChange)}</span>
                </span>
              )}
              {tier === 'free' && (
                <span className="flex items-center gap-1">
                  OI: <span className="text-muted-foreground/30 select-none blur-[2px]">+0.00%</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">OI change is a Pro feature. Upgrade to see real-time Open Interest changes.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button
                className="group/bn flex-shrink-0 p-1.5 rounded-md transition-all duration-200 hover:bg-warning-500/10 hover:scale-110"
                title="Open in Binance"
              >
                <Coins className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/bn:text-warning-500 transition-colors" />
              </button>
              <button
                className="group/tv flex-shrink-0 p-1.5 rounded-md transition-all duration-200 hover:bg-elite-500/10 hover:scale-110"
                title="Open in TradingView"
              >
                <div className="relative">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/tv:text-elite-500 transition-colors" />
                  <ExternalLink className="absolute -top-0.5 -right-0.5 h-2 w-2 text-muted-foreground/50 group-hover/tv:text-elite-400 transition-colors" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Count alerts with enhanced data
  const alertsWithPriceChange = alerts.filter(a => a.priceChange !== undefined && a.priceChange !== null).length
  const alertsWithOiChange = alerts.filter(a => a.oiChange !== undefined && a.oiChange !== null).length

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Enhanced Alert Cards Preview</h1>
            <p className="text-muted-foreground mt-1">
              Compare how alert cards look for Free vs Pro tiers
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Auto-refresh (30s)
              </label>
              {lastRefresh && (
                <span className="text-xs text-muted-foreground">
                  Last: {format(lastRefresh, 'h:mm:ss a')}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => fetchAlerts()}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Data Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{alerts.length}</div>
                <div className="text-sm text-muted-foreground">Total Alerts</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-brand-500/10">
                <div className="text-2xl font-bold text-brand-600">{alertsWithPriceChange}</div>
                <div className="text-sm text-muted-foreground">With Price %</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-elite-500/10">
                <div className="text-2xl font-bold text-elite-600">{alertsWithOiChange}</div>
                <div className="text-sm text-muted-foreground">With OI %</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{alerts.length - alertsWithPriceChange}</div>
                <div className="text-sm text-muted-foreground">Legacy (no enhanced)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {error && (
          <Card className="border-danger-500/30">
            <CardContent className="pt-6">
              <p className="text-danger-500">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <Card>
            <CardContent className="pt-6 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Side-by-side comparison */}
        {!loading && alerts.length > 0 && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Free Tier */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-muted">Free</Badge>
                    Enhanced Cards (Free)
                  </CardTitle>
                  <CardDescription>
                    Shows price % change, OI locked with upgrade prompt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alerts.slice(0, 3).map((alert) => renderAlertCard(alert, 'free'))}
                </CardContent>
              </Card>

              {/* Pro Tier */}
              <Card className="border-pro-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-pro-500/10 text-pro-600 border-pro-500/30">Pro</Badge>
                    Enhanced Cards (Pro)
                  </CardTitle>
                  <CardDescription>
                    Shows price % and OI % changes (full access)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alerts.slice(0, 3).map((alert) => renderAlertCard(alert, 'pro'))}
                </CardContent>
              </Card>
            </div>

            {/* Full list for Pro */}
            <Card className="border-pro-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-pro-500/10 text-pro-600 border-pro-500/30">Pro</Badge>
                  All Alerts (Pro View)
                </CardTitle>
                <CardDescription>
                  Full list of production alerts as seen by Pro tier users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {alerts.map((alert) => renderAlertCard(alert, 'pro'))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty state */}
        {!loading && alerts.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No alerts found. Volume alerts will appear here once detected.
            </CardContent>
          </Card>
        )}

        {/* Feature info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Feature Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Free Tier</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Price: <span className="text-brand-500">+5.23%</span> - Price change from hour open</li>
                  <li>Funding: value colored only when {'>'}0.03% or {'<'}-0.03%</li>
                  <li>OI: <span className="text-muted-foreground/30 blur-[2px]">+0.00%</span> - Locked with upgrade prompt</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Pro Tier (Full Access)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Price: <span className="text-brand-500">+5.23%</span> - Price change from hour open</li>
                  <li>Funding: value colored only when {'>'}0.03% or {'<'}-0.03%</li>
                  <li>OI: <span className="text-danger-500">-2.14%</span> - Open Interest change from hour start</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Note: Labels (Price, Funding, OI) are never colored - only values are colored based on positive/negative.
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Implementation Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Price Change:</strong> Calculated as (current_price - hour_open_price) / hour_open_price.
              Available from candle data in the Python script.
            </p>
            <p>
              <strong>OI Change:</strong> Calculated as (current_oi - hour_start_oi) / hour_start_oi.
              Requires querying the OI snapshot from the backend at hour start.
            </p>
            <p>
              <strong>Fallback:</strong> If priceChange or oiChange is null/undefined, Pro users see the
              standard format (absolute price, no OI display). This handles legacy alerts and missing data gracefully.
            </p>
            <p>
              <strong>Note:</strong> New alerts generated after deployment will have priceChange and oiChange data.
              Older alerts will show as &quot;Legacy&quot; without enhanced metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
