'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Database } from 'lucide-react'

export function SystemHealth() {
    return (
        <div className="rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between gap-4">
                {/* Uptime */}
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                99.9%
                            </span>
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5">
                                Healthy
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-border/60" />

                {/* Response Time */}
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 flex-shrink-0">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                                45ms
                            </span>
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/5">
                                Excellent
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Response Time</p>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-border/60" />

                {/* Database */}
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                        <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                Healthy
                            </span>
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5">
                                Connected
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Database</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
