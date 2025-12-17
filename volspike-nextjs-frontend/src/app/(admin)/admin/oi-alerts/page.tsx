'use client'

import { useState, useRef } from 'react'
import { useOIAlerts, type OIAlert } from '@/hooks/use-oi-alerts'
import { useAlertSounds } from '@/hooks/use-alert-sounds'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Bell, RefreshCw, AlertCircle, Volume2, VolumeX, Coins, BarChart3, ExternalLink } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { AddToTwitterButton } from '@/components/admin/add-to-twitter-button'
import { useSession } from 'next-auth/react'

export default function OIAlertsPage() {
  const { data: session } = useSession()
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const prevAlertsRef = useRef<OIAlert[]>([])

  const { playSound, enabled: soundsEnabled, setEnabled: setSoundsEnabled, ensureUnlocked } = useAlertSounds()

  // Handle new alert callback (for sound and animation)
  const handleNewAlert = () => {
    console.log('🔔 New OI alert arrived, playing sound')
    playSound('spike') // Use 'spike' type for OI alerts
  }

  const { alerts, isLoading, error, refetch, isConnected, isAdmin } = useOIAlerts({
    autoFetch: true,
    onNewAlert: handleNewAlert,
  })

  // Track new alerts for animation
  if (alerts.length > 0 && prevAlertsRef.current.length > 0) {
    const prevIds = new Set(prevAlertsRef.current.map(a => a.id))
    const newIds = alerts.filter(a => !prevIds.has(a.id)).map(a => a.id)

    if (newIds.length > 0) {
      setNewAlertIds(prev => {
        const updated = new Set(prev)
        newIds.forEach(id => updated.add(id))
        return updated
      })

      // Remove "new" status after animation completes
      setTimeout(() => {
        setNewAlertIds(prev => {
          const updated = new Set(prev)
          newIds.forEach(id => updated.delete(id))
          return updated
        })
      }, 3000)
    }
  }
  prevAlertsRef.current = alerts

  // Handle alert card click - replay animation and sound
  const handleAlertClick = (alertId: string) => {
    setNewAlertIds(prev => {
      const updated = new Set(prev)
      updated.add(alertId)
      return updated
    })

    playSound('spike')

    setTimeout(() => {
      setNewAlertIds(prev => {
        const updated = new Set(prev)
        updated.delete(alertId)
        return updated
      })
    }, 3000)
  }

  const formatOI = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(2)}B`
    }
    if (abs >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`
    }
    if (abs >= 1_000) {
      return `${(value / 1_000).toFixed(2)}K`
    }
    return value.toFixed(0)
  }

  const formatExactTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm:ss a')
  }

  const formatRelativeTime = (timestamp: string) => {
    const relative = formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    return relative.replace('about ', '')
  }

  // TradingView link handler - opens chart in new browser tab with referral
  const handleTradingViewClick = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent alert card click animation
    e.preventDefault()

    // Remove USDT suffix for TradingView symbol format
    const asset = symbol.replace('USDT', '')
    const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=BINANCE:${asset}USDT.P&share_your_love=moneygarden`
    window.open(tradingViewUrl, '_blank', 'noopener,noreferrer')
  }

  // Binance link handler - opens futures via referral link in new browser tab
  const handleBinanceClick = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent alert card click animation
    e.preventDefault()

    // Referral link with symbol parameter for tracking
    const binanceReferralUrl = `https://www.binance.com/activity/referral-entry/CPA?ref=CPA_0090FDRWPL&utm_source=volspike&symbol=${symbol}`
    window.open(binanceReferralUrl, '_blank', 'noopener,noreferrer')
  }

  // Non-admin users
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>OI Alerts are only available to admin users.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="h-[calc(100vh-8rem)]">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 whitespace-nowrap mb-1.5">
                <Bell className="h-5 w-5 text-warning-600 dark:text-warning-400" />
                <span className="bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  OI Alerts
                </span>
                <Badge variant="outline" className="text-xs bg-sec-500/10 border-sec-500/30 text-sec-600 dark:text-sec-400">
                  Admin Only
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs transition-all duration-300 ${
                    isConnected
                      ? 'border-brand-500/30 text-brand-600 dark:text-brand-400'
                      : 'border-warning-500/30 text-warning-600 dark:text-warning-400'
                  }`}
                >
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    isConnected ? 'bg-brand-500 animate-pulse-glow' : 'bg-warning-500'
                  }`} />
                  {isConnected ? 'Live' : 'Connecting'}
                </Badge>
                <button
                  onClick={async () => {
                    const next = !soundsEnabled
                    setSoundsEnabled(next)
                    if (next) {
                      await ensureUnlocked()
                    }
                  }}
                  title={soundsEnabled ? 'Disable alert sounds' : 'Enable alert sounds'}
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
                >
                  {soundsEnabled ? (
                    <Volume2 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              title="Refresh alerts"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)]">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-danger-500/10 border border-danger-500/30">
              <AlertCircle className="h-4 w-4 text-danger-500" />
              <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
            </div>
          )}

          {isLoading && alerts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading OI alerts...</div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground">No OI alerts yet</p>
                <p className="text-xs text-muted-foreground/70">Alerts will appear when OI changes ≥3% in 5 minutes</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-4">
                {alerts.map((alert) => {
                  const isNew = newAlertIds.has(alert.id)
                  const isLongSpike = alert.direction === 'UP'
                  const isShortDump = alert.direction === 'DOWN'
                  const pctChange = alert.pctChange * 100 // Convert to percentage

                  // Animation classes
                  const getAnimationClass = () => {
                    if (!isNew) return ''
                    return 'animate-slide-in-right'
                  }

                  const getGlowClass = () => {
                    if (!isNew) return ''
                    return isLongSpike
                      ? 'shadow-brand-glow'
                      : 'shadow-danger-glow'
                  }

                  return (
                    <div
                      key={alert.id}
                      id={`oi-alert-${alert.id}`}
                      onClick={() => handleAlertClick(alert.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        isLongSpike
                          ? 'border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10'
                          : isShortDump
                            ? 'border-danger-500/30 bg-danger-500/5 hover:bg-danger-500/10'
                            : 'border-border hover:bg-muted/50'
                      } ${getAnimationClass()} ${getGlowClass()} ${
                        isNew ? 'ring-2 ' + (isLongSpike ? 'ring-brand-500/50' : 'ring-danger-500/50') : ''
                      }`}
                      title="Click to replay animation and sound"
                    >
                      <div className="space-y-2">
                        {/* Header: Symbol and timestamp */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {isShortDump ? (
                              <TrendingDown className="h-4 w-4 flex-shrink-0 text-danger-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 flex-shrink-0 text-brand-500" />
                            )}
                            <span className="text-base font-semibold">{alert.symbol}</span>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatExactTime(alert.ts)}
                            </div>
                            <div className="text-xs text-muted-foreground/70 whitespace-nowrap">
                              ({formatRelativeTime(alert.ts)})
                            </div>
                          </div>
                        </div>

                        {/* Percentage badge and time period badge */}
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono-tabular ${
                              isLongSpike
                                ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400'
                                : 'bg-danger-500/10 border-danger-500/30 text-danger-600 dark:text-danger-400'
                            }`}
                          >
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            5 min
                          </Badge>
                        </div>

                        {/* OI information */}
                        <div className="space-y-0.5 text-sm text-muted-foreground">
                          <div>Current OI: {formatOI(alert.current)}</div>
                          <div className="text-xs opacity-70">5 mins ago: {formatOI(alert.baseline)}</div>
                        </div>

                        {/* Metrics: Price %, Funding with action icons */}
                        <div className="flex items-end justify-between gap-2">
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                            {/* Price % change during OI measurement period */}
                            {alert.priceChange !== undefined && alert.priceChange !== null ? (
                              <span>
                                Price:{' '}
                                <span
                                  className={
                                    alert.priceChange > 0
                                      ? 'text-brand-600 dark:text-brand-400'
                                      : alert.priceChange < 0
                                        ? 'text-danger-600 dark:text-danger-400'
                                        : ''
                                  }
                                >
                                  {alert.priceChange >= 0 ? '+' : ''}{(alert.priceChange * 100).toFixed(2)}%
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">
                                Price: <span>—</span>
                              </span>
                            )}

                            {/* Funding rate at time of alert */}
                            {alert.fundingRate !== undefined && alert.fundingRate !== null ? (
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
                            ) : (
                              <span className="text-muted-foreground/50">
                                Funding: <span>—</span>
                              </span>
                            )}
                          </div>

                          {/* Action icon buttons */}
                          <div className="flex items-end gap-0">
                            {/* Add to Twitter button (admin only) - positioned above Binance/TradingView row */}
                            {session?.user?.role === 'ADMIN' && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <AddToTwitterButton
                                  alertId={alert.id}
                                  alertType="OPEN_INTEREST"
                                  alertCardId={`oi-alert-${alert.id}`}
                                />
                              </div>
                            )}

                            {/* Binance icon button */}
                            <button
                              onClick={(e) => handleBinanceClick(alert.symbol, e)}
                              className="group/bn flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:bg-warning-500/10 hover:scale-110 active:scale-95"
                              title="Open in Binance"
                              aria-label="Open in Binance"
                            >
                              <Coins className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/bn:text-warning-500 transition-colors" />
                            </button>

                            {/* TradingView icon button */}
                            <button
                              onClick={(e) => handleTradingViewClick(alert.symbol, e)}
                              className="group/tv flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:bg-elite-500/10 hover:scale-110 active:scale-95"
                              title="Open in TradingView"
                              aria-label="Open in TradingView"
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
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
