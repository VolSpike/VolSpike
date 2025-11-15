'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Database } from 'lucide-react'

export function SystemHealth() {
    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    System Health
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-center backdrop-blur-sm">
                        <div className="mb-2 flex items-center justify-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">
                            99.9%
                        </div>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                        <Badge variant="outline" className="mt-2 border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5">
                            Healthy
                        </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-center backdrop-blur-sm">
                        <div className="mb-2 flex items-center justify-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-1">
                            45ms
                        </div>
                        <p className="text-xs text-muted-foreground">Response Time</p>
                        <Badge variant="outline" className="mt-2 border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/5">
                            Excellent
                        </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-center backdrop-blur-sm">
                        <div className="mb-2 flex items-center justify-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                                <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">
                            Healthy
                        </div>
                        <p className="text-xs text-muted-foreground">Database</p>
                        <Badge variant="outline" className="mt-2 border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5">
                            Connected
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}