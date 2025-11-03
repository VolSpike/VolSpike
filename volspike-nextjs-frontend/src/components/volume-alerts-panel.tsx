'use client'

import { useVolumeAlerts } from '@/hooks/use-volume-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { TrendingUp, Bell, RefreshCw, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function VolumeAlertsPanel() {
  const { alerts, isLoading, error, refetch, tier, isConnected } = useVolumeAlerts({
    pollInterval: 15000, // Poll every 15 seconds as fallback
    autoFetch: true,
  })
  
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
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Volume Alerts
            </CardTitle>
            <CardDescription>
              Real-time volume spike notifications from Binance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`text-xs ${isConnected ? 'border-brand-500/30 text-brand-600 dark:text-brand-400' : 'border-muted'}`}
            >
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-brand-500 animate-pulse' : 'bg-muted-foreground'}`} />
              {isConnected ? 'Live' : tier}
            </Badge>
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
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-danger-500/10 border border-danger-500/30">
            <AlertCircle className="h-4 w-4 text-danger-500" />
            <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
          </div>
        )}
        
        <ScrollArea className="h-[500px]">
          {isLoading && alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No recent volume spikes</p>
              <p className="text-xs mt-1">Check back soon for new alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-all duration-150 hover:shadow-md ${
                    alert.alertType === 'SPIKE' 
                      ? 'border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Asset name and timestamp */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-brand-500 flex-shrink-0" />
                        <span className="font-semibold text-base">{alert.asset}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {/* Multiplier and Update badges on second line */}
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs font-mono-tabular bg-brand-500/10 border-brand-500/30"
                      >
                        {alert.volumeRatio.toFixed(2)}x
                      </Badge>
                      {alert.isUpdate && (
                        <Badge variant="secondary" className="text-xs">
                          {alert.alertType === 'HALF_UPDATE' ? 'Half Update' : 'Update'}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Volume information - compact format */}
                    <div className="text-sm text-muted-foreground">
                      {formatVolume(alert.currentVolume)} <span className="text-xs opacity-70">({alert.volumeRatio.toFixed(1)}x prev)</span>
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
              ))}
            </div>
          )}
        </ScrollArea>
        
        {alerts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
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

