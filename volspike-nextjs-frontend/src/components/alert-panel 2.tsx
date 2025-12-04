'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, TrendingUp, BellRing, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { AlertBuilder } from '@/components/alert-builder'

interface Alert {
    id: string
    symbol: string
    volume: number
    threshold: number
    timestamp: number
    reason: string
}

interface AlertPanelProps {
    alerts: Alert[]
    isLoading?: boolean
    userTier?: 'free' | 'pro' | 'elite'
}

// Skeleton loader for alerts
function AlertSkeleton() {
    return (
        <div className="p-3 border border-border/50 rounded-lg bg-muted/30 animate-pulse">
            <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="h-3 w-16 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="flex items-center justify-between">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="flex items-center justify-between">
                    <div className="h-3 w-12 bg-muted rounded" />
                    <div className="h-3 w-16 bg-muted rounded" />
                </div>
            </div>
        </div>
    )
}

// Beautiful empty state
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="text-center py-12 px-4">
            {/* Animated icon */}
            <div className="relative inline-flex items-center justify-center mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-sec-500/20 rounded-full blur-xl animate-pulse-glow" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50">
                    <BellRing className="h-10 w-10 text-muted-foreground" />
                </div>
            </div>

            {/* Text */}
            <h3 className="text-lg font-semibold text-foreground mb-2">
                No alerts yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                Volume spike alerts will appear here when significant market movements are detected
            </p>

            {/* CTA Button */}
            <Button 
                variant="outline" 
                size="sm"
                onClick={onCreateClick}
                className="group transition-all duration-200 hover:border-brand-500/50 hover:bg-brand-500/5"
            >
                <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
                Create Alert
            </Button>

            {/* Feature hints */}
            <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-brand-500" />
                        <span>Real-time spike detection</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center">
                        <Bell className="h-3.5 w-3.5 text-sec-500" />
                        <span>Instant notifications</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-elite-500" />
                        <span>Customizable thresholds</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function AlertPanel({ alerts, isLoading = false, userTier = 'free' }: AlertPanelProps) {
    const [showBuilder, setShowBuilder] = useState(false)

    return (
        <>
            <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center text-h3">
                                <Bell className="h-5 w-5 mr-2 text-brand-500" />
                                Volume Alerts
                            </CardTitle>
                            <CardDescription>
                                Real-time volume spike notifications
                            </CardDescription>
                        </div>
                        {alerts.length > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowBuilder(true)}
                                className="hover:border-brand-500/50 hover:bg-brand-500/5"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                New
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="flex-1">
                    {isLoading ? (
                        <div className="space-y-3">
                            <AlertSkeleton />
                            <AlertSkeleton />
                            <AlertSkeleton />
                        </div>
                    ) : alerts.length === 0 ? (
                        <EmptyState onCreateClick={() => setShowBuilder(true)} />
                    ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {alerts.map((alert, index) => {
                            // Determine severity by reason
                            const severity = alert.reason.includes('extreme') ? 'high' : 
                                           alert.reason.includes('significant') ? 'medium' : 'low'
                            
                            const severityStyles = {
                                high: 'border-danger-500/50 bg-danger-500/5',
                                medium: 'border-warning-500/50 bg-warning-500/5',
                                low: 'border-brand-500/50 bg-brand-500/5'
                            }

                            const badgeStyles = {
                                high: 'bg-danger-600 dark:bg-danger-500 text-white',
                                medium: 'bg-warning-600 dark:bg-warning-500 text-white',
                                low: 'bg-brand-600 dark:bg-brand-500 text-white'
                            }

                            return (
                                <div
                                    key={alert.id}
                                    className={`p-3 border rounded-lg transition-all duration-200 hover:shadow-sm animate-fade-in ${severityStyles[severity]}`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-sm">
                                            {alert.symbol.replace(/USDT$/i, '')}
                                        </span>
                                        <Badge 
                                            variant="default"
                                            className={`text-xs font-semibold border-0 ${badgeStyles[severity]}`}
                                        >
                                            {alert.reason}
                                        </Badge>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Volume:</span>
                                            <span className="font-mono-tabular font-medium">
                                                ${alert.volume >= 1_000_000 
                                                    ? `${(alert.volume / 1_000_000).toFixed(2)}M` 
                                                    : alert.volume.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Threshold:</span>
                                            <span className="font-mono-tabular text-muted-foreground text-xs">
                                                ${alert.threshold >= 1_000_000 
                                                    ? `${(alert.threshold / 1_000_000).toFixed(2)}M` 
                                                    : alert.threshold.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-border/30">
                                            <span className="text-muted-foreground text-xs">Time:</span>
                                            <span className="text-xs font-mono-tabular text-muted-foreground">
                                                {format(new Date(alert.timestamp), 'HH:mm:ss')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Alert Builder Drawer */}
        <AlertBuilder 
            open={showBuilder} 
            onOpenChange={setShowBuilder}
            userTier={userTier}
        />
        </>
    )
}
