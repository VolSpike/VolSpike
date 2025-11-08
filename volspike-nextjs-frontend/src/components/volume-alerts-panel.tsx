'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useVolumeAlerts } from '@/hooks/use-volume-alerts'
import { useAlertSounds } from '@/hooks/use-alert-sounds'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Bell, RefreshCw, AlertCircle, Volume2, VolumeX, Play } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface VolumeAlertsPanelProps {
  onNewAlert?: () => void
}

export function VolumeAlertsPanel({ onNewAlert }: VolumeAlertsPanelProps = {}) {
  const { alerts, isLoading, error, refetch, tier, isConnected, nextUpdate } = useVolumeAlerts({
    pollInterval: 15000, // Poll every 15 seconds as fallback
    autoFetch: true,
    onNewAlert, // Pass callback to hook
  })
  
  const { playSound, enabled: soundsEnabled, setEnabled: setSoundsEnabled } = useAlertSounds()
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const [testAlerts, setTestAlerts] = useState<typeof alerts>([])
  const prevAlertsRef = useRef<typeof alerts>([])
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  // Test mode: Show test buttons only for admins or when ?debug=true
  const isTestMode = 
    searchParams?.get('debug') === 'true' || 
    (session?.user as any)?.role === 'ADMIN' ||
    process.env.NODE_ENV === 'development'
  
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
      
      // Clear "new" status after animation completes (2 seconds)
      setTimeout(() => {
        setNewAlertIds(new Set())
      }, 2000)
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
  
  const formatExactTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a') // e.g., "3:12 PM"
  }
  
  const formatRelativeTime = (timestamp: string) => {
    const relative = formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    return relative.replace('about ', '') // Remove "about" prefix
  }
  
  return (
    <Card className="group h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 whitespace-nowrap mb-1.5">
              <Bell className="h-5 w-5 text-warning-600 dark:text-warning-400" />
              <span className="bg-gradient-to-br from-warning-600 to-danger-600 dark:from-warning-400 dark:to-danger-400 bg-clip-text text-transparent">
                Volume Alerts
              </span>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`text-xs transition-all duration-300 ${isConnected ? 'border-brand-500/30 text-brand-600 dark:text-brand-400' : 'border-warning-500/30 text-warning-600 dark:text-warning-400'}`}
              >
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full transition-all duration-300 ${isConnected ? 'bg-brand-500 animate-pulse-glow' : 'bg-warning-500 animate-pulse-glow'}`} />
                {isConnected ? 'Live' : 'Connecting'}
              </Badge>
              {/* Sound toggle - compact icon-only button */}
              <button
                onClick={() => setSoundsEnabled(!soundsEnabled)}
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
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Only show refresh button for Pro/Elite tiers */}
            {tier !== 'free' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                title="Refresh alerts"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-danger-500/10 border border-danger-500/30">
            <AlertCircle className="h-4 w-4 text-danger-500" />
            <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
          </div>
        )}
        
        {/* Test Buttons - Only visible in test mode */}
        {isTestMode && (
          <div className="mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs bg-warning-500/20 border-warning-500/50 text-warning-600">
                Test Mode
              </Badge>
              <span className="text-xs text-muted-foreground">
                {searchParams?.get('debug') === 'true' && 'Debug enabled'}
                {(session?.user as any)?.role === 'ADMIN' && 'Admin user'}
                {process.env.NODE_ENV === 'development' && 'Development mode'}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Test Sounds:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => playSound('spike')}
                    className="text-xs"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Spike Alert
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => playSound('half_update')}
                    className="text-xs"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    30m Update
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => playSound('full_update')}
                    className="text-xs"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Hourly Update
                  </Button>
                </div>
              </div>
              
              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Create Test Alerts (click them to test):</p>
                
                {/* Spike Alerts */}
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">⚡ Spike Alerts (Maximum Drama):</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('spike', 'bullish')}
                      className="text-xs bg-brand-500/10 hover:bg-brand-500/20 border-brand-500/30"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      ⚡ Lightning (Green)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('spike', 'bearish')}
                      className="text-xs bg-danger-500/10 hover:bg-danger-500/20 border-danger-500/30"
                    >
                      <TrendingDown className="h-3 w-3 mr-1" />
                      ☄️ Meteor (Red)
                    </Button>
                  </div>
                </div>

                {/* 30m Updates */}
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">⚡ 30m Updates (Medium Drama):</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('half_update', 'bullish')}
                      className="text-xs bg-brand-500/10 hover:bg-brand-500/20 border-brand-500/30"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      ✨ Quantum (Green)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('half_update', 'bearish')}
                      className="text-xs bg-danger-500/10 hover:bg-danger-500/20 border-danger-500/30"
                    >
                      <TrendingDown className="h-3 w-3 mr-1" />
                      🚨 Warning (Red)
                    </Button>
                  </div>
                </div>

                {/* Hourly Updates */}
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">🌅 Hourly Updates (Elegant Subtlety):</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('full_update', 'bullish')}
                      className="text-xs bg-brand-500/10 hover:bg-brand-500/20 border-brand-500/30"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      🌅 Aurora (Green)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTestAlert('full_update', 'bearish')}
                      className="text-xs bg-danger-500/10 hover:bg-danger-500/20 border-danger-500/30"
                    >
                      <TrendingDown className="h-3 w-3 mr-1" />
                      🔥 Ember (Red)
                    </Button>
                  </div>
                </div>

                {/* Clear button */}
                {testAlerts.length > 0 && (
                  <div className="mb-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTestAlerts([])}
                      className="text-xs text-muted-foreground"
                    >
                      Clear Test Alerts
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  💡 Tip: Test alerts appear at the top. Click any alert card to re-trigger its animation!
                </p>
              </div>
            </div>
          </div>
        )}
        
        <ScrollArea className="h-[600px] pr-4">
          {isLoading && displayAlerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Loading alerts...
            </div>
          ) : displayAlerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No recent volume spikes</p>
              <p className="text-xs mt-1">Check back soon for new alerts</p>
            </div>
          ) : (
            <div className="space-y-3" style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
              {displayAlerts.map((alert) => {
                // Determine color based on candle direction
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
                      ? 'animate-electric-charge-green'  // Electric charge pulses
                      : 'animate-shockwave-red'          // Shockwave ripples
                  }
                  
                  // 30M UPDATES
                  if (alert.alertType === 'HALF_UPDATE') {
                    return isBullish
                      ? 'animate-energy-wave-green'      // Energy waves
                      : 'animate-alert-beacon-red'       // Alert beacon
                  }
                  
                  // HOURLY UPDATES
                  if (alert.alertType === 'FULL_UPDATE') {
                    return isBullish
                      ? 'animate-gentle-glow-green'      // Gentle glow
                      : 'animate-soft-pulse-red'         // Soft pulse
                  }
                  
                  return ''
                }
                
                // Handler for replaying animations by clicking on alert cards
                // Available for ALL users (desktop click or mobile tap)
                const handleAlertClick = () => {
                  // Determine sound type based on alert type
                  const soundType = alert.alertType === 'HALF_UPDATE' 
                    ? 'half_update' 
                    : alert.alertType === 'FULL_UPDATE'
                      ? 'full_update'
                      : 'spike'
                  
                  // Trigger animation and sound
                  setNewAlertIds(new Set([alert.id]))
                  playSound(soundType)
                  
                  // Clear animation after completion
                  setTimeout(() => {
                    setNewAlertIds(new Set())
                  }, 2000)
                }
                
                return (
                <div
                  key={alert.id}
                  onClick={handleAlertClick}
                  className={`p-3 rounded-lg border transition-all duration-150 cursor-pointer hover:shadow-md ${
                    isBullish
                      ? 'border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10' 
                      : isBearish
                        ? 'border-danger-500/30 bg-danger-500/5 hover:bg-danger-500/10'
                        : 'border-border hover:bg-muted/50'
                  } ${getAnimationClass()} ${getGlowClass()} ${
                    isNew ? 'ring-2 ' + (isBullish ? 'ring-brand-500/50' : isBearish ? 'ring-danger-500/50' : 'ring-brand-500/50') : ''
                  }`}
                  title="Click to replay animation and sound"
                >
                  <div className="space-y-2">
                    {/* Header: Asset name and timestamp */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isBearish ? (
                          <TrendingDown className="h-4 w-4 flex-shrink-0 text-danger-500" />
                        ) : (
                          <TrendingUp className={`h-4 w-4 flex-shrink-0 ${
                            isBullish ? 'text-brand-500' : 'text-muted-foreground'
                          }`} />
                        )}
                        <span className="font-semibold text-base">{alert.asset}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
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
                        <Badge variant="secondary" className="text-xs">
                          {alert.alertType === 'HALF_UPDATE' ? '30m Update' : 'Hourly Update'}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Volume information - current and previous */}
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div>This hour: {formatVolume(alert.currentVolume)}</div>
                      <div className="text-xs opacity-70">Last hour: {formatVolume(alert.previousVolume)}</div>
                    </div>
                    
                    {/* Price and funding on one line */}
                    {(alert.price || alert.fundingRate) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {alert.price && (
                          <span>Price: {formatPrice(alert.price)}</span>
                        )}
                        {alert.fundingRate !== undefined && alert.fundingRate !== null && (
                          <span className={
                            alert.fundingRate > 0.03 
                              ? 'text-brand-600 dark:text-brand-400' 
                              : alert.fundingRate < -0.03 
                                ? 'text-danger-600 dark:text-danger-400' 
                                : ''
                          }>
                            Funding: {(alert.fundingRate * 100).toFixed(3)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
        
        {displayAlerts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
            {testAlerts.length > 0 && (
              <span className="text-warning-600 dark:text-warning-400">
                {testAlerts.length} test alert{testAlerts.length !== 1 ? 's' : ''} + {' '}
              </span>
            )}
            Showing last {alerts.length} alert{alerts.length !== 1 ? 's' : ''} 
            {tier === 'free' && ' (Free tier: 10 max)'}
            {tier === 'pro' && ' (Pro tier: 50 max)'}
            {tier === 'elite' && ' (Elite tier: 100 max)'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

