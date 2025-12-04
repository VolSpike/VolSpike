'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, Lock, TrendingUp, Activity, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import { VolumeAlertsContent } from '@/components/volume-alerts-content'
import { OIAlertsContent } from '@/components/oi-alerts-content'
import { useVolumeAlerts } from '@/hooks/use-volume-alerts'
import { useOIAlerts } from '@/hooks/use-oi-alerts'
import { useAlertSounds } from '@/hooks/use-alert-sounds'
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

interface AlertsPanelProps {
  onNewAlert?: () => void
  guestMode?: boolean
  guestVisibleCount?: number
  /** When true (side-by-side pane), Price+OI on line 1, Funding on line 2. When false (tab), all on one line. */
  compact?: boolean
}

export function AlertsPanel({ onNewAlert, guestMode = false, guestVisibleCount = 2, compact = false }: AlertsPanelProps = {}) {
  const { data: session } = useSession()
  const userTier = (session?.user as any)?.tier || 'free'
  const [activeTab, setActiveTab] = useState<'volume' | 'oi'>('volume')
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [oiNextUpdate, setOiNextUpdate] = useState(0)
  const [, setTick] = useState(0) // Force re-render every second for countdown display
  const oiNextUpdateRef = useRef(0) // Ref to avoid stale closure in interval

  // Free tier users cannot access OI alerts
  const canAccessOIAlerts = userTier === 'pro' || userTier === 'elite'

  // Keep ref in sync with state
  useEffect(() => {
    oiNextUpdateRef.current = oiNextUpdate
  }, [oiNextUpdate])

  // Get connection state and controls for the active tab
  const { alerts: volumeAlerts, isConnected: volumeConnected, isLoading: volumeLoading, error: volumeError, refetch: volumeRefetch, tier: volumeTier, nextUpdate: volumeNextUpdate } = useVolumeAlerts({
    pollInterval: 15000,
    autoFetch: activeTab === 'volume',
    guestLive: guestMode,
    guestVisibleCount,
    onNewAlert,
  })

  const { alerts: oiAlerts, isConnected: oiConnected, isLoading: oiLoading, error: oiError, refetch: oiRefetch } = useOIAlerts({
    autoFetch: activeTab === 'oi' && canAccessOIAlerts,
  })

  const { enabled: soundsEnabled, setEnabled: setSoundsEnabled, ensureUnlocked } = useAlertSounds()

  // 30-second countdown for OI alerts (matches Digital Ocean polling interval)
  useEffect(() => {
    if (activeTab !== 'oi' || !canAccessOIAlerts) return

    // Start at 30 seconds
    const initialTime = Date.now() + 30000
    setOiNextUpdate(initialTime)
    oiNextUpdateRef.current = initialTime

    // Update every second to refresh the countdown display and reset when needed
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = oiNextUpdateRef.current - now

      if (remaining <= 0) {
        // Reset to 30 seconds when countdown completes
        const newTime = Date.now() + 30000
        setOiNextUpdate(newTime)
        oiNextUpdateRef.current = newTime
      }

      // Force re-render to update countdown display
      setTick(t => t + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeTab, canAccessOIAlerts])

  const getOICountdownDisplay = () => {
    const now = Date.now()
    const remaining = Math.max(0, oiNextUpdate - now)

    if (remaining === 0) return ''

    const seconds = Math.floor(remaining / 1000)
    return `0:${seconds.toString().padStart(2, '0')}`
  }

  const getVolumeCountdownDisplay = () => {
    const now = Date.now()
    const remaining = Math.max(0, volumeNextUpdate - now)

    if (remaining === 0) return ''

    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isConnected = activeTab === 'volume' ? volumeConnected : oiConnected
  const isLoading = activeTab === 'volume' ? volumeLoading : oiLoading
  const refetch = activeTab === 'volume' ? volumeRefetch : oiRefetch
  const showNextUpdate = activeTab === 'volume' ? (userTier !== 'elite' && volumeNextUpdate > 0) : canAccessOIAlerts
  const nextUpdateDisplay = activeTab === 'volume' ? getVolumeCountdownDisplay() : getOICountdownDisplay()

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLockDialogOpen(true)
  }

  return (
    <Card className="group h-full flex flex-col border border-border/60 shadow-md min-w-[420px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2 whitespace-nowrap mb-1.5">
          <Bell className="h-5 w-5 text-warning-600 dark:text-warning-400" />
          <span className="bg-gradient-to-br from-warning-600 to-danger-600 dark:from-warning-400 dark:to-danger-400 bg-clip-text text-transparent">
            Alerts
          </span>
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Volume spikes and Open Interest changes
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col">
        {/* Connection status and controls - ABOVE tabs */}
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
            {showNextUpdate && nextUpdateDisplay && (
              <span className="text-blue-500 text-xs">
                • Next update in {nextUpdateDisplay}
              </span>
            )}
          </div>
          {userTier !== 'free' && (
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'volume' | 'oi')} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 w-full mb-4 mr-4">
            <TabsTrigger value="volume" className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Volume
            </TabsTrigger>
            <TabsTrigger
              value="oi"
              disabled={!canAccessOIAlerts}
              className="flex items-center gap-1.5 relative data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Open Interest</span>
              {!canAccessOIAlerts && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 min-w-0 cursor-pointer ml-1 relative z-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleLockClick(e)
                        }}
                      >
                        <Lock className="h-3 w-3 text-sec-500 hover:text-sec-400 transition-colors" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[180px] p-2"
                      sideOffset={4}
                    >
                      <p className="text-xs text-center">
                        Open Interest alerts are a Pro feature
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="volume" className="flex-1 mt-0 overflow-hidden">
            <VolumeAlertsContent
              onNewAlert={onNewAlert}
              guestMode={guestMode}
              guestVisibleCount={guestVisibleCount}
              compact={compact}
              hideControls={true}
              externalAlerts={volumeAlerts}
              externalIsLoading={volumeLoading}
              externalError={volumeError}
              externalRefetch={volumeRefetch}
              externalTier={volumeTier}
              externalIsConnected={volumeConnected}
              externalNextUpdate={volumeNextUpdate}
            />
          </TabsContent>

          <TabsContent value="oi" className="flex-1 mt-0 overflow-hidden">
            {canAccessOIAlerts ? (
              <OIAlertsContent
                compact={compact}
                hideControls={true}
                externalAlerts={oiAlerts}
                externalIsLoading={oiLoading}
                externalError={oiError}
                externalRefetch={oiRefetch}
                externalIsConnected={oiConnected}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sec-500/20 via-elite-500/10 to-brand-500/20 mb-4 ring-1 ring-sec-500/30">
                  <Lock className="h-8 w-8 text-sec-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2 bg-gradient-to-br from-sec-600 to-elite-600 dark:from-sec-400 dark:to-elite-400 bg-clip-text text-transparent">
                  Open Interest Alerts - Pro Feature
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Get real-time alerts when Open Interest changes ≥3% in 5 minutes. Track smart money movements and spot major position changes before the crowd.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-sec-600 to-elite-600 hover:from-sec-700 hover:to-elite-700 text-white shadow-lg shadow-sec-500/20 transition-all"
                  >
                    Upgrade to Pro
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/pricing"
                    className="text-xs text-muted-foreground hover:text-sec-500 transition-colors"
                  >
                    View pricing details
                  </Link>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Lock dialog for Free tier users */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent className="max-w-[280px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sec-500" />
              Open Interest Alerts
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sec-500/15">
                <Lock className="h-3 w-3 text-sec-500" />
              </div>
              <span className="font-semibold text-sm">Pro Feature</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Track real-time Open Interest changes when OI spikes or dumps ≥3% in 5 minutes.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sec-500 hover:text-sec-400 transition-colors"
              onClick={() => setLockDialogOpen(false)}
            >
              Unlock with Pro
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
