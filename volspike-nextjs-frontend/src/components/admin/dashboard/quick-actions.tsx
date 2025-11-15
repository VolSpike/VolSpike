'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRightCircle, FileText, RefreshCcw, Users as UsersIcon } from 'lucide-react'

export function QuickActions() {
    const router = useRouter()

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="group flex h-auto flex-col items-start gap-2 rounded-xl border-border/60 bg-card/30 px-4 py-4 text-left backdrop-blur-sm transition-all duration-200 hover:border-brand-500/30 hover:bg-brand-500/5 hover:shadow-md"
                        onClick={() => router.push('/admin/users/new')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 group-hover:bg-brand-500/20 transition-colors">
                                <UsersIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                            </div>
                            Create User
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Add a new user and send an invite
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="group flex h-auto flex-col items-start gap-2 rounded-xl border-border/60 bg-card/30 px-4 py-4 text-left backdrop-blur-sm transition-all duration-200 hover:border-sec-500/30 hover:bg-sec-500/5 hover:shadow-md"
                        onClick={() => router.push('/admin/audit')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sec-500/10 group-hover:bg-sec-500/20 transition-colors">
                                <FileText className="h-4 w-4 text-sec-600 dark:text-sec-400" />
                            </div>
                            View Logs
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Open the full audit log history
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="group flex h-auto flex-col items-start gap-2 rounded-xl border-border/60 bg-card/30 px-4 py-4 text-left backdrop-blur-sm transition-all duration-200 hover:border-elite-500/30 hover:bg-elite-500/5 hover:shadow-md"
                        onClick={() => router.push('/admin/metrics')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-elite-500/10 group-hover:bg-elite-500/20 transition-colors">
                                <ArrowRightCircle className="h-4 w-4 text-elite-600 dark:text-elite-400" />
                            </div>
                            Export Data
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Jump to analytics and reporting
                        </span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
