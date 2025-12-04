'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Bell, Lock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { VolumeAlertsContent } from '@/components/volume-alerts-content'
import { OIAlertsContent } from '@/components/oi-alerts-content'

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

  // Free tier users cannot access OI alerts
  const canAccessOIAlerts = userTier === 'pro' || userTier === 'elite'

  return (
    <Card className="group h-full flex flex-col border border-border/60 shadow-md">
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'volume' | 'oi')} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="volume" className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Volume
            </TabsTrigger>
            <TabsTrigger
              value="oi"
              disabled={!canAccessOIAlerts}
              className="flex items-center gap-1.5 relative"
            >
              <Bell className="h-3.5 w-3.5" />
              OI Alerts
              {!canAccessOIAlerts && (
                <Lock className="h-3 w-3 text-sec-500 ml-1" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="volume" className="flex-1 mt-0 overflow-hidden">
            <VolumeAlertsContent
              onNewAlert={onNewAlert}
              guestMode={guestMode}
              guestVisibleCount={guestVisibleCount}
              compact={compact}
            />
          </TabsContent>

          <TabsContent value="oi" className="flex-1 mt-0 overflow-hidden">
            {canAccessOIAlerts ? (
              <OIAlertsContent
                compact={compact}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sec-500/20 via-elite-500/10 to-brand-500/20 mb-4 ring-1 ring-sec-500/30">
                  <Lock className="h-8 w-8 text-sec-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2 bg-gradient-to-br from-sec-600 to-elite-600 dark:from-sec-400 dark:to-elite-400 bg-clip-text text-transparent">
                  OI Alerts - Pro Feature
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
    </Card>
  )
}
