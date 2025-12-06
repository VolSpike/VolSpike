'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useVolumeAlerts } from '@/hooks/use-volume-alerts'
import { useAlertSounds } from '@/hooks/use-alert-sounds'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { GuestCTA } from '@/components/guest-cta'
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Volume2, VolumeX, Play, BarChart3, ExternalLink, Coins, Lock } from 'lucide-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistanceToNow, format } from 'date-fns'

/**
 * OI Lock component - Stable standalone component to prevent re-renders
 * Shows tooltip on hover and dialog on click for Free tier users
 */
const OILockButton = memo(function OILockButton() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDialogOpen(true)
  }

  const tooltipContent = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-sec-500/15">
          <Lock className="h-2.5 w-2.5 text-sec-500" />
        </div>
        <span className="font-semibold text-xs">Pro Feature</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
        See OI changes on alerts.
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 text-xs font-medium text-sec-500 hover:text-sec-400 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        Upgrade to Pro
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </>
  )

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 min-w-0 cursor-help"
              onClick={handleClick}
            >
              <Lock className="h-3 w-3 text-sec-500 hover:text-sec-400 transition-colors" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="oi-teaser-tooltip max-w-[240px] p-0 overflow-hidden"
            sideOffset={4}
          >
            <div className="oi-teaser-tooltip-gradient h-1 w-full" />
            <div className="px-2.5 py-2">
              {tooltipContent}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[280px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sec-500" />
              OI Change
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-3">
              See real-time Open Interest changes on volume alerts.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sec-500 hover:text-sec-400 transition-colors"
              onClick={() => setDialogOpen(false)}
            >
              Unlock with Pro
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

interface VolumeAlertsContentProps {
  onNewAlert?: () => void
  guestMode?: boolean
  guestVisibleCount?: number
  /** When true (side-by-side pane), Price+OI on line 1, Funding on line 2. When false (tab), all on one line. */
  compact?: boolean
  /** When true, hide connection status and controls (used when parent AlertsPanel handles them) */
  hideControls?: boolean
  /** When hideControls is true, parent must provide these values */
  externalAlerts?: any[]
  externalIsLoading?: boolean
  externalError?: string | null
  externalRefetch?: () => void
  externalTier?: string
  externalIsConnected?: boolean
  externalNextUpdate?: number
  /** External sound controls (when hideControls is true) */
  externalPlaySound?: (type: 'spike' | 'half_update' | 'full_update') => void
  externalSoundsEnabled?: boolean
  externalSetSoundsEnabled?: (enabled: boolean) => void
}

export function VolumeAlertsContent({
  onNewAlert,
  guestMode = false,
  guestVisibleCount = 2,
  compact = false,
  hideControls = false,
  externalAlerts,
  externalIsLoading,
  externalError,
  externalRefetch,
  externalTier,
  externalIsConnected,
  externalNextUpdate,
  externalPlaySound,
  externalSoundsEnabled,
  externalSetSoundsEnabled,
}: VolumeAlertsContentProps = {}) {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role
  const isAdmin = userRole === 'ADMIN'

  // Always call hooks (React rules), but only use them when not using external data
  const hookResult = useVolumeAlerts({
    pollInterval: 15000,
    autoFetch: !hideControls,
    onNewAlert,
    guestLive: guestMode,
    guestVisibleCount,
  })

  const soundHook = useAlertSounds()

  // Use external data if provided (hideControls=true), otherwise use hook data
  const alerts = hideControls ? (externalAlerts || []) : hookResult.alerts
  const isLoading = hideControls ? (externalIsLoading || false) : hookResult.isLoading
  const error = hideControls ? (externalError || null) : hookResult.error
  const refetch = hideControls ? (externalRefetch || (() => {})) : hookResult.refetch
  const tier = hideControls ? (externalTier || 'free') : hookResult.tier
  const isConnected = hideControls ? (externalIsConnected || false) : hookResult.isConnected
  const nextUpdate = hideControls ? (externalNextUpdate || 0) : hookResult.nextUpdate

  const playSound = hideControls ? (externalPlaySound || (() => {})) : soundHook.playSound
  const soundsEnabled = hideControls ? (externalSoundsEnabled || false) : soundHook.enabled
  const setSoundsEnabled = hideControls ? (externalSetSoundsEnabled || (() => {})) : soundHook.setEnabled
  const ensureUnlocked = hideControls ? (async () => {}) : soundHook.ensureUnlocked
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const [testAlerts, setTestAlerts] = useState<typeof alerts>([])
  const prevAlertsRef = useRef<typeof alerts>([])
  const searchParams = useSearchParams()

  const debugParamEnabled = searchParams?.get('debug') === 'true'
  const isLocalDevBuild = process.env.NODE_ENV !== 'production'
  const showTestHarness = debugParamEnabled || isLocalDevBuild

  // Sound test controls stay limited to explicit debug/dev contexts
  const showSoundTestControls = debugParamEnabled || isLocalDevBuild

  // Surface console debugging so we can verify when test controls are intentionally hidden
  useEffect(() => {
    const reason = debugParamEnabled ? 'debug-param' : isLocalDevBuild ? 'local-dev-build' : 'disabled'
    console.debug(`[VolumeAlertsContent] Test harness ${showTestHarness ? 'visible' : 'hidden'} (${reason}).`)
  }, [debugParamEnabled, isLocalDevBuild, showTestHarness])

  // Create mock test alerts
  const createTestAlert = (type: 'spike' | 'half_update' | 'full_update', direction: 'bullish' | 'bearish' = 'bullish') => {
    const now = new Date().toISOString()
    const mockAlert = {
      id: `test-${type}-${Date.now()}`,
      asset: type === 'spike' ? 'TEST' : type === 'half_update' ? 'HALF' : 'HOUR',
      currentVolume: 50000000,
      previousVolume: 15000000,
      volumeRatio: 3.33,
      price: 45000,
      fundingRate: direction === 'bullish' ? 0.001 : -0.001,
      candleDirection: direction,
      timestamp: now,
      isUpdate: type !== 'spike',
      alertType: type === 'spike' ? 'SPIKE' : type === 'half_update' ? 'HALF_UPDATE' : 'FULL_UPDATE',
      createdAt: now,
      updatedAt: now,
    }

    // Add to test alerts
    setTestAlerts(prev => [mockAlert as any, ...prev.slice(0, 4)]) // Keep max 5 test alerts

    // Mark as new for animation
    setNewAlertIds(new Set([mockAlert.id]))

    // Play sound
    const soundType = type === 'spike' ? 'spike' : type === 'half_update' ? 'half_update' : 'full_update'
    playSound(soundType)

    // Clear animation after 2 seconds
    setTimeout(() => {
      setNewAlertIds(new Set())
    }, 2000)
  }

  // Merge real alerts with test alerts
  const displayAlerts = [...testAlerts, ...alerts]

  // Detect new alerts and play sounds
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

      // Play sound for the first new alert
      const firstNew = newAlerts[0]
      const soundType = firstNew.alertType === 'HALF_UPDATE'
        ? 'half_update'
        : firstNew.alertType === 'FULL_UPDATE'
          ? 'full_update'
          : 'spike'

      playSound(soundType)

      // Clear "new" status after animation completes (3 seconds)
      setTimeout(() => {
        setNewAlertIds(new Set())
      }, 3000)
    }

    prevAlertsRef.current = alerts
  }, [alerts, playSound])

  // Format countdown timer
  const getCountdownDisplay = () => {
    if (tier === 'elite' || nextUpdate === 0) return ''

    const now = Date.now()
    const remaining = Math.max(0, nextUpdate - now)

    if (remaining === 0) return ''

    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatVolume = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`
    }
    if (abs >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`
    }
    if (abs >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return `$${price.toFixed(2)}`
    }
    return `$${price.toFixed(4)}`
  }

  // Format percentage change with sign and color
  const formatPercentChange = (value: number | undefined | null) => {
    if (value === undefined || value === null) return null
    const pct = value * 100
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(2)}%`
  }

  // Get color class for percentage change
  const getPercentChangeColor = (value: number | undefined | null) => {
    if (value === undefined || value === null) return ''
    return value >= 0
      ? 'text-brand-600 dark:text-brand-400'
      : 'text-danger-600 dark:text-danger-400'
  }

  const formatExactTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a') // e.g., "3:12 PM"
  }

  const formatRelativeTime = (timestamp: string) => {
    const relative = formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    return relative.replace('about ', '') // Remove "about" prefix
  }


  // TradingView link handler - opens chart in new browser tab with referral
  const handleTradingViewClick = (asset: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent alert card click animation
    e.preventDefault()

    // Referral link with symbol parameter to open the correct chart
    const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=BINANCE:${asset}USDT.P&share_your_love=moneygarden`
    window.open(tradingViewUrl, '_blank', 'noopener,noreferrer')
  }

  // Binance link handler - opens futures via referral link in new browser tab
  const handleBinanceClick = (asset: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent alert card click animation
    e.preventDefault()

    const symbol = `${asset}USDT`
    // Referral link with symbol parameter for tracking
    const binanceReferralUrl = `https://www.binance.com/activity/referral-entry/CPA?ref=CPA_0090FDRWPL&utm_source=volspike&symbol=${symbol}`
    window.open(binanceReferralUrl, '_blank', 'noopener,noreferrer')
  }

  // Render alert card (extracted for reuse)
  const renderAlertCard = (alert: any, index: number, isBlurred: boolean) => {
    const isBullish = alert.candleDirection === 'bullish'
    const isBearish = alert.candleDirection === 'bearish'
    const isNew = newAlertIds.has(alert.id)

    // 🎨 Sophisticated animation selection based on type AND direction
    const getAnimationClass = () => {
      if (!isNew) return ''

      // SPIKE ALERTS - Maximum Drama
      if (alert.alertType === 'SPIKE' || !alert.isUpdate) {
        return isBullish
          ? 'animate-lightning-strike-green' // ⚡ Lightning from above
          : 'animate-meteor-impact-red'      // ☄️ Meteor from diagonal
      }

      // 30M UPDATES - Medium Drama
      if (alert.alertType === 'HALF_UPDATE') {
        return isBullish
          ? 'animate-quantum-shimmer-green'  // ✨ Quantum phase-in
          : 'animate-warning-pulse-red'      // 🚨 Warning pulse
      }

      // HOURLY UPDATES - Elegant Subtlety
      if (alert.alertType === 'FULL_UPDATE') {
        return isBullish
          ? 'animate-aurora-wave-green'      // 🌅 Aurora wave
          : 'animate-ember-glow-red'         // 🔥 Ember glow
      }

      return ''
    }

    // 🌟 Complementary glow effects for each animation
    const getGlowClass = () => {
      if (!isNew) return ''

      // SPIKE ALERTS
      if (alert.alertType === 'SPIKE' || !alert.isUpdate) {
        return isBullish
          ? 'shadow-electric-charge-green'  // Electric charge pulses
          : 'shadow-shockwave-red'          // Shockwave ripples
      }

      // 30M UPDATES
      if (alert.alertType === 'HALF_UPDATE') {
        return isBullish
          ? 'shadow-energy-wave-green'      // Energy waves
          : 'shadow-alert-beacon-red'       // Alert beacon
      }

      // HOURLY UPDATES
      if (alert.alertType === 'FULL_UPDATE') {
        return isBullish
          ? 'shadow-gentle-glow-green'      // Gentle glow
          : 'shadow-soft-pulse-red'         // Soft pulse
      }

      return ''
    }

    // Handler for replaying animations by clicking on alert cards
    const handleAlertClick = () => {
      const soundType = alert.alertType === 'HALF_UPDATE'
        ? 'half_update'
        : alert.alertType === 'FULL_UPDATE'
          ? 'full_update'
          : 'spike'

      setNewAlertIds(new Set([alert.id]))
      playSound(soundType)

      setTimeout(() => {
        setNewAlertIds(new Set())
      }, 2000)
    }

    return (
      <div
        key={alert.id}
        onClick={handleAlertClick}
        className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md ${
          isBullish
            ? 'border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10'
            : isBearish
              ? 'border-danger-500/30 bg-danger-500/5 hover:bg-danger-500/10'
              : 'border-border hover:bg-muted/50'
        } ${getAnimationClass()} ${getGlowClass()} ${
          isNew ? 'ring-2 ' + (isBullish ? 'ring-brand-500/50' : isBearish ? 'ring-danger-500/50' : 'ring-brand-500/50') : ''
        } ${isBlurred ? 'pointer-events-none select-none filter blur-[2px] opacity-70' : ''}`}
        title="Click to replay animation and sound"
      >
        <div className="space-y-2">
          {/* Header: Asset name and timestamp */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {isBearish ? (
                <TrendingDown className="h-4 w-4 flex-shrink-0 text-danger-500" />
              ) : (
                <TrendingUp
                  className={`h-4 w-4 flex-shrink-0 ${
                    isBullish ? 'text-brand-500' : 'text-muted-foreground'
                  }`}
                />
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

          {/* Multiplier and Update badges on second line */}
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
              <Badge
                variant="secondary"
                className={`text-xs ${
                  alert.alertType === 'FULL_UPDATE'
                    ? 'bg-amber-500/80 dark:bg-amber-500/70'
                    : ''
                }`}
              >
                {alert.alertType === 'HALF_UPDATE' ? '30m Update' : 'Hourly Update'}
              </Badge>
            )}
          </div>

          {/* Volume information - current and previous */}
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <div>This hour: {formatVolume(alert.currentVolume)}</div>
            <div className="text-xs opacity-70">Last hour: {formatVolume(alert.previousVolume)}</div>
          </div>

          {/* Metrics: Price, OI, Funding with action icons */}
          <div className="flex items-end justify-between gap-2">
            <div className={`text-xs text-muted-foreground ${compact ? 'space-y-0.5' : 'flex items-center gap-3 flex-wrap'}`}>
              {/* Price and OI (always together, no wrap) */}
              <div className="flex items-center gap-3 whitespace-nowrap">
                {/* Price display */}
                {(tier === 'pro' || tier === 'free') && formatPercentChange(alert.priceChange) ? (
                  <span>
                    Price: <span className={getPercentChangeColor(alert.priceChange)}>{formatPercentChange(alert.priceChange)}</span>
                  </span>
                ) : alert.price ? (
                  <span>Price: {formatPrice(alert.price)}</span>
                ) : null}

                {/* OI change - Pro/Elite see value, Free sees faded with lock */}
                {(tier === 'pro' || tier === 'elite') && formatPercentChange(alert.oiChange) && (
                  <span>
                    OI: <span className={getPercentChangeColor(alert.oiChange)}>{formatPercentChange(alert.oiChange)}</span>
                  </span>
                )}
                {tier === 'free' && (
                  <span className="flex items-center gap-1">
                    OI: <span className="text-muted-foreground/30 select-none blur-[2px]">+0.0%</span>
                    <OILockButton />
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
                onClick={(e) => handleBinanceClick(alert.asset, e)}
                className="group/bn flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:bg-warning-500/10 hover:scale-110 active:scale-95"
                title="Open in Binance"
                aria-label="Open in Binance"
              >
                <Coins className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/bn:text-warning-500 transition-colors" />
              </button>

              <button
                onClick={(e) => handleTradingViewClick(alert.asset, e)}
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
                guestMode
                  ? 'border-brand-500/30 text-brand-600 dark:text-brand-400'
                  : isConnected
                    ? 'border-brand-500/30 text-brand-600 dark:text-brand-400'
                    : 'border-warning-500/30 text-warning-600 dark:text-warning-400'
              }`}
            >
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                guestMode ? 'bg-brand-500' : isConnected ? 'bg-brand-500' : 'bg-warning-500'
              } ${guestMode ? 'animate-pulse-glow' : isConnected ? 'animate-pulse-glow' : ''}`} />
              {guestMode ? 'Live' : isConnected ? 'Live' : 'Connecting'}
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
            {tier !== 'elite' && nextUpdate > 0 && (
              <span className="text-blue-500 text-xs">
                • Next update in {getCountdownDisplay()}
              </span>
            )}
          </div>
          {tier !== 'free' && (
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
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-danger-500/10 border border-danger-500/30">
          <AlertCircle className="h-4 w-4 text-danger-500" />
          <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
        </div>
      )}

      {isLoading && displayAlerts.length === 0 ? (
        <div className="flex h-[500px] items-center justify-center text-center text-muted-foreground">
          Loading alerts...
        </div>
      ) : displayAlerts.length === 0 ? (
        <div className="flex h-[500px] flex-col items-center justify-center text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No recent volume spikes</p>
          <p className="mt-1 text-xs">Check back soon for new alerts</p>
        </div>
      ) : guestMode ? (
        <div className="h-[500px] overflow-hidden">
          <div className="space-y-3">
            {displayAlerts.map((alert, index) => renderAlertCard(alert, index, guestMode && index >= guestVisibleCount))}
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[500px]" direction="vertical" showHint>
          <div className="space-y-3 pb-3 pr-4">
            {displayAlerts.map((alert, index) => renderAlertCard(alert, index, false))}
          </div>
        </ScrollArea>
      )}

      {guestMode && (
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent via-background/70 to-background" />
          <div className="flex items-center justify-center">
            <GuestCTA size="sm" />
          </div>
        </div>
      )}

      {displayAlerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
          {testAlerts.length > 0 && (
            <span className="text-warning-600 dark:text-warning-400">
              {testAlerts.length} test alert{testAlerts.length !== 1 ? 's' : ''} + {' '}
            </span>
          )}
          Showing last {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          {isAdmin ? ' (Admin: 100 max)' : tier === 'free' ? ' (Free tier: 10 max)' : tier === 'pro' ? ' (Pro tier: 50 max)' : tier === 'elite' ? ' (Elite tier: 100 max)' : ''}
        </div>
      )}
    </div>
  )
}
