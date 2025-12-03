'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Bell, BarChart3, ExternalLink, Coins, RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { VolumeAlert } from '@/hooks/use-volume-alerts'

// Mock alerts with enhanced data for preview
const mockAlerts: VolumeAlert[] = [
  {
    id: 'preview-1',
    symbol: 'BTCUSDT',
    asset: 'BTC',
    currentVolume: 850000000,
    previousVolume: 220000000,
    volumeRatio: 3.86,
    price: 97500,
    fundingRate: 0.0125,
    candleDirection: 'bullish',
    message: 'BTC hourly volume $850.00M (3.86x prev) - VOLUME SPIKE!',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    hourTimestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    isUpdate: false,
    alertType: 'SPIKE',
    priceChange: 0.0523, // +5.23%
    oiChange: 0.0345,    // +3.45%
  },
  {
    id: 'preview-2',
    symbol: 'ETHUSDT',
    asset: 'ETH',
    currentVolume: 420000000,
    previousVolume: 95000000,
    volumeRatio: 4.42,
    price: 3890,
    fundingRate: -0.0085,
    candleDirection: 'bearish',
    message: 'ETH hourly volume $420.00M (4.42x prev) - VOLUME SPIKE!',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    hourTimestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    isUpdate: false,
    alertType: 'SPIKE',
    priceChange: -0.0214, // -2.14%
    oiChange: -0.0156,    // -1.56%
  },
  {
    id: 'preview-3',
    symbol: '1000PEPEUSDT',
    asset: '1000PEPE',
    currentVolume: 180000000,
    previousVolume: 45000000,
    volumeRatio: 4.0,
    price: 0.00002345,
    fundingRate: 0.065,
    candleDirection: 'bullish',
    message: 'HALF-UPDATE: 1000PEPE hourly volume $180.00M (4.00x prev) - VOLUME SPIKE!',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    hourTimestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    isUpdate: true,
    alertType: 'HALF_UPDATE',
    priceChange: 0.1245,  // +12.45%
    oiChange: 0.0789,     // +7.89%
  },
  {
    id: 'preview-4',
    symbol: 'SOLUSDT',
    asset: 'SOL',
    currentVolume: 320000000,
    previousVolume: 85000000,
    volumeRatio: 3.76,
    price: 245.67,
    fundingRate: 0.0023,
    candleDirection: 'bullish',
    message: 'UPDATE: SOL hourly volume $320.00M (3.76x prev) - VOLUME SPIKE!',
    timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
    hourTimestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    isUpdate: true,
    alertType: 'FULL_UPDATE',
    priceChange: 0.0089,  // +0.89%
    oiChange: -0.0234,    // -2.34%
  },
  {
    id: 'preview-5',
    symbol: 'DOGEUSDT',
    asset: 'DOGE',
    currentVolume: 95000000,
    previousVolume: 28000000,
    volumeRatio: 3.39,
    price: 0.4125,
    fundingRate: -0.042,
    candleDirection: 'bearish',
    message: 'DOGE hourly volume $95.00M (3.39x prev) - VOLUME SPIKE!',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    hourTimestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    isUpdate: false,
    alertType: 'SPIKE',
    priceChange: -0.0567, // -5.67%
    oiChange: 0.0123,     // +1.23%
  },
]

// Alert without enhanced data (legacy/no data available)
const mockLegacyAlert: VolumeAlert = {
  id: 'preview-legacy',
  symbol: 'XRPUSDT',
  asset: 'XRP',
  currentVolume: 75000000,
  previousVolume: 22000000,
  volumeRatio: 3.41,
  price: 2.45,
  fundingRate: 0.0015,
  candleDirection: 'bullish',
  message: 'XRP hourly volume $75.00M (3.41x prev) - VOLUME SPIKE!',
  timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
  hourTimestamp: new Date(Date.now() - 60 * 60000).toISOString(),
  isUpdate: false,
  alertType: 'SPIKE',
  // No priceChange or oiChange - simulates legacy alert or missing OI data
}

export default function AlertPreviewPage() {
  const [showLegacy, setShowLegacy] = useState(true)
  const allAlerts = showLegacy ? [...mockAlerts, mockLegacyAlert] : mockAlerts

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
              {/* Price display: Pro sees % change, others see absolute */}
              {tier === 'pro' && formatPercentChange(alert.priceChange) ? (
                <span className={getPercentChangeColor(alert.priceChange)}>
                  Price: {formatPercentChange(alert.priceChange)}
                </span>
              ) : alert.price ? (
                <span>Price: {formatPrice(alert.price)}</span>
              ) : null}

              {/* Funding rate */}
              {alert.fundingRate !== undefined && alert.fundingRate !== null && (
                <span
                  className={
                    alert.fundingRate > 0.03
                      ? 'text-brand-600 dark:text-brand-400'
                      : alert.fundingRate < -0.03
                        ? 'text-danger-600 dark:text-danger-400'
                        : ''
                  }
                >
                  Funding: {(alert.fundingRate * 100).toFixed(3)}%
                </span>
              )}

              {/* OI change - Pro only */}
              {tier === 'pro' && formatPercentChange(alert.oiChange) && (
                <span className={getPercentChangeColor(alert.oiChange)}>
                  OI: {formatPercentChange(alert.oiChange)}
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Enhanced Alert Cards Preview</h1>
            <p className="text-muted-foreground mt-1">
              Compare how alert cards look across different tiers with enhanced metrics
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowLegacy(!showLegacy)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {showLegacy ? 'Hide' : 'Show'} Legacy Alert
          </Button>
        </div>

        {/* Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Feature Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">New Enhanced Metrics (Pro Only)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><span className="text-brand-500">Price: +5.23%</span> - Price change from hour open</li>
                  <li><span className="text-danger-500">OI: -2.14%</span> - Open Interest change from hour start</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Standard Display (Free/Elite)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Price: $97,500.00 - Absolute price at alert time</li>
                  <li>Funding rate shown for all tiers</li>
                  <li>No OI change display</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side-by-side comparison */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Free Tier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="bg-muted">Free</Badge>
                Standard Cards
              </CardTitle>
              <CardDescription>
                Shows absolute price, no OI data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allAlerts.slice(0, 3).map((alert) => renderAlertCard(alert, 'free'))}
            </CardContent>
          </Card>

          {/* Pro Tier */}
          <Card className="border-pro-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="bg-pro-500/10 text-pro-600 border-pro-500/30">Pro</Badge>
                Enhanced Cards
              </CardTitle>
              <CardDescription>
                Shows price %, OI % changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allAlerts.slice(0, 3).map((alert) => renderAlertCard(alert, 'pro'))}
            </CardContent>
          </Card>

          {/* Elite Tier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="bg-elite-500/10 text-elite-600 border-elite-500/30">Elite</Badge>
                Standard Cards
              </CardTitle>
              <CardDescription>
                Same as Free (no enhanced metrics yet)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allAlerts.slice(0, 3).map((alert) => renderAlertCard(alert, 'elite'))}
            </CardContent>
          </Card>
        </div>

        {/* Full list for Pro */}
        <Card className="border-pro-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="bg-pro-500/10 text-pro-600 border-pro-500/30">Pro</Badge>
              All Sample Alerts (Enhanced)
            </CardTitle>
            <CardDescription>
              Full list showing various scenarios including missing OI data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {allAlerts.map((alert) => renderAlertCard(alert, 'pro'))}
            </div>
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
              <strong>Fallback:</strong> If priceChange or oiChange is null/undefined, Elite users see the
              standard format (absolute price, no OI display). This handles legacy alerts and missing data gracefully.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
