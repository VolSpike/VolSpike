'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useOIAlerts, type OIAlert } from '@/hooks/use-oi-alerts'
import { useAlertSounds } from '@/hooks/use-alert-sounds'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Volume2, VolumeX, Coins, BarChart3, ExternalLink } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface OIAlertsContentProps {
  compact?: boolean
  /** When true, hide connection status and controls (used when parent AlertsPanel handles them) */
  hideControls?: boolean
  /** When hideControls is true, parent must provide these values */
  externalAlerts?: any[]
  externalIsLoading?: boolean
  externalError?: string | null
  externalRefetch?: () => void
  externalIsConnected?: boolean
  /** External sound controls (when hideControls is true) */
  externalPlaySound?: (type: 'spike' | 'half_update' | 'full_update') => void
  externalSoundsEnabled?: boolean
  externalSetSoundsEnabled?: (enabled: boolean) => void
}

export function OIAlertsContent({
  compact = false,
  hideControls = false,
  externalAlerts,
  externalIsLoading,
  externalError,
  externalRefetch,
  externalIsConnected,
  externalPlaySound,
  externalSoundsEnabled,
  externalSetSoundsEnabled,
}: OIAlertsContentProps) {
  const { data: session } = useSession()
  const userTier = (session?.user as any)?.tier || 'free'

  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const prevAlertsRef = useRef<OIAlert[]>([])

  // Always call hooks (React rules), but only use them when not using external data
  const soundHook = useAlertSounds()

  const playSound = hideControls ? (externalPlaySound || (() => {})) : soundHook.playSound
  const soundsEnabled = hideControls ? (externalSoundsEnabled || false) : soundHook.enabled
  const setSoundsEnabled = hideControls ? (externalSetSoundsEnabled || (() => {})) : soundHook.setEnabled
  const ensureUnlocked = hideControls ? (async () => {}) : soundHook.ensureUnlocked

  // Handle new alert callback (for parent component notifications)
  // Sound and animation are handled by useEffect below
  const handleNewAlert = () => {
    console.log('🔔 New OI alert arrived via WebSocket')
  }

  const hookResult = useOIAlerts({
    autoFetch: !hideControls,
    onNewAlert: handleNewAlert,
  })

  // Use external data if provided (hideControls=true), otherwise use hook data
  const alerts = hideControls ? (externalAlerts || []) : hookResult.alerts
  const isLoading = hideControls ? (externalIsLoading || false) : hookResult.isLoading
  const error = hideControls ? (externalError || null) : hookResult.error
  const refetch = hideControls ? (externalRefetch || (() => {})) : hookResult.refetch
  const isConnected = hideControls ? (externalIsConnected || false) : hookResult.isConnected
  const tier = hookResult.userTier || userTier
  const maxAlerts = hookResult.maxAlerts || 50

  // Detect new alerts and play sounds (matches Volume alerts pattern)
  useEffect(() => {
    if (alerts.length === 0 || prevAlertsRef.current.length === 0) {
      prevAlertsRef.current = alerts
      return
    }

    const prevIds = new Set(prevAlertsRef.current.map(a => a.id))
    const newAlerts = alerts.filter(a => !prevIds.has(a.id))

    if (newAlerts.length > 0) {
      // Mark new alerts for animation
      setNewAlertIds(new Set(newAlerts.map(a => a.id)))

      // Play sound for the first new alert based on timeframe
      const firstNew = newAlerts[0]
      const timeframe = firstNew.timeframe || '5 min'
      const soundType =
        timeframe === '5 min' ? 'spike' :
        timeframe === '15 min' ? 'half_update' :
        timeframe === '1 hour' ? 'full_update' :
        'spike' // Default

      playSound(soundType)

      // Clear "new" status after animation completes (3 seconds)
      setTimeout(() => {
        setNewAlertIds(new Set())
      }, 3000)
    }

    prevAlertsRef.current = alerts
  }, [alerts, playSound])

  // Handle alert card click - replay animation and sound
  const handleAlertClick = (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId)
    if (!alert) return

    setNewAlertIds(prev => {
      const updated = new Set(prev)
      updated.add(alertId)
      return updated
    })

    // Map timeframe to sound type (matching Volume alerts pattern)
    const timeframe = alert.timeframe || '5 min'
    const soundType =
      timeframe === '5 min' ? 'spike' :
      timeframe === '15 min' ? 'half_update' :
      timeframe === '1 hour' ? 'full_update' :
      'spike' // Default

    playSound(soundType)

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
    return format(new Date(timestamp), 'h:mm a') // Match volume alerts format (no seconds)
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

  return (
    <div className="flex flex-col h-full">
      {/* Header with connection status and controls */}
      {!hideControls && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
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
            {/* Sound toggle */}
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
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh alerts"
            className="h-7 w-7"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-danger-500/10 border border-danger-500/30">
          <AlertCircle className="h-4 w-4 text-danger-500" />
          <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
        </div>
      )}

      {isLoading && alerts.length === 0 ? (
        <div className="flex h-[500px] items-center justify-center text-muted-foreground">
          Loading OI alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex h-[500px] flex-col items-center justify-center text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No OI alerts yet</p>
          <p className="mt-1 text-xs">Alerts: ≥3% (5m), ≥7% (15m), ≥12% (1h)</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pb-3 pr-4">
            {alerts.map((alert) => {
              const isNew = newAlertIds.has(alert.id)
              const isLongSpike = alert.direction === 'UP'
              const isShortDump = alert.direction === 'DOWN'
              const pctChange = alert.pctChange * 100 // Convert to percentage

              // Animation classes based on direction and timeframe
              const getAnimationClass = () => {
                if (!isNew) return ''

                const timeframe = alert.timeframe || '5 min'

                // Match Volume alerts animation mapping:
                // 1. UP + 5 min = green no tag = animate-lightning-strike-green
                // 2. UP + 15 min = green 30m tag = animate-quantum-shimmer-green
                // 3. UP + 1 hour = green hourly tag = animate-aurora-wave-green
                // 4. DOWN + 5 min = red no tag = animate-meteor-impact-red
                // 5. DOWN + 15 min = red 30m tag = animate-warning-pulse-red
                // 6. DOWN + 1 hour = red hourly tag = animate-ember-glow-red

                if (isLongSpike) {
                  if (timeframe === '5 min') return 'animate-lightning-strike-green'
                  if (timeframe === '15 min') return 'animate-quantum-shimmer-green'
                  if (timeframe === '1 hour') return 'animate-aurora-wave-green'
                  return 'animate-lightning-strike-green' // Default to 5 min
                } else {
                  if (timeframe === '5 min') return 'animate-meteor-impact-red'
                  if (timeframe === '15 min') return 'animate-warning-pulse-red'
                  if (timeframe === '1 hour') return 'animate-ember-glow-red'
                  return 'animate-meteor-impact-red' // Default to 5 min
                }
              }

              const getGlowClass = () => {
                if (!isNew) return ''

                const timeframe = alert.timeframe || '5 min'

                // Match Volume alerts glow patterns
                if (isLongSpike) {
                  if (timeframe === '5 min') return 'shadow-electric-charge-green'
                  if (timeframe === '15 min') return 'shadow-energy-wave-green'
                  if (timeframe === '1 hour') return 'shadow-gentle-glow-green'
                  return 'shadow-electric-charge-green'
                } else {
                  if (timeframe === '5 min') return 'shadow-shockwave-red'
                  if (timeframe === '15 min') return 'shadow-alert-beacon-red'
                  if (timeframe === '1 hour') return 'shadow-soft-pulse-red'
                  return 'shadow-shockwave-red'
                }
              }

              return (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
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
                        <span className="text-base font-semibold">{alert.symbol.replace('USDT', '')}</span>
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
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          alert.timeframe === '15 min'
                            ? 'bg-violet-500/80 dark:bg-violet-500/70'
                            : alert.timeframe === '1 hour'
                              ? 'bg-amber-500/80 dark:bg-amber-500/70'
                              : ''
                        }`}
                      >
                        {alert.timeframe || '5 min'}
                      </Badge>
                    </div>

                    {/* OI information */}
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      <div>Current OI: {formatOI(alert.current)}</div>
                      <div className="text-xs opacity-70">{alert.timeframe || '5 min'} ago: {formatOI(alert.baseline)}</div>
                    </div>

                    {/* Metrics: Price, Funding with action icons - match volume alerts layout */}
                    <div className="flex items-end justify-between gap-2">
                      <div className={`text-xs text-muted-foreground ${compact ? 'space-y-0.5' : 'flex items-center gap-3 flex-wrap'}`}>
                        {/* Price and Funding (always together on same line for tabs, separate lines for panes) */}
                        <div className="flex items-center gap-3 whitespace-nowrap">
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
                        </div>

                        {/* Funding - same line (tab) or new line (pane) */}
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
                      </div>

                      {/* Action icon buttons */}
                      <div className="flex items-center gap-0">
                        <button
                          onClick={(e) => handleBinanceClick(alert.symbol, e)}
                          className="group/bn flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:bg-warning-500/10 hover:scale-110 active:scale-95"
                          title="Open in Binance"
                          aria-label="Open in Binance"
                        >
                          <Coins className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/bn:text-warning-500 transition-colors" />
                        </button>

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

      {alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
          Showing last {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          {hookResult.isAdmin ? ` (Admin: ${maxAlerts} max)` : tier === 'pro' ? ` (Pro tier: ${maxAlerts} max)` : tier === 'elite' ? ` (Elite tier: ${maxAlerts} max)` : ''}
        </div>
      )}
    </div>
  )
}
