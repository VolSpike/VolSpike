'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRightCircle, FileText, RefreshCcw, Users as UsersIcon } from 'lucide-react'

export function QuickActions() {
    const router = useRouter()

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-2 md:grid-cols-4">
                    <Button
                        type="button"
                        variant="outline"
                        className="flex h-auto flex-col items-start gap-1 rounded-xl border-border/70 bg-background/80 px-4 py-3 text-left hover:bg-muted/60"
                        onClick={() => router.push('/admin/users/new')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium">
                            <UsersIcon className="h-4 w-4 text-brand-500" />
                            Create User
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Add a new user and send an invite
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="flex h-auto flex-col items-start gap-1 rounded-xl border-border/70 bg-background/80 px-4 py-3 text-left hover:bg-muted/60"
                        onClick={() => router.push('/admin/audit')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium">
                            <FileText className="h-4 w-4 text-sec-500" />
                            View Logs
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Open the full audit log history
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="flex h-auto flex-col items-start gap-1 rounded-xl border-border/70 bg-background/80 px-4 py-3 text-left hover:bg-muted/60"
                        onClick={() => router.push('/admin/subscriptions')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium">
                            <RefreshCcw className="h-4 w-4 text-brand-500" />
                            Sync Stripe
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Review and sync subscription status
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="flex h-auto flex-col items-start gap-1 rounded-xl border-border/70 bg-background/80 px-4 py-3 text-left hover:bg-muted/60"
                        onClick={() => router.push('/admin/metrics')}
                    >
                        <span className="inline-flex items-center gap-2 font-medium">
                            <ArrowRightCircle className="h-4 w-4 text-elite-500" />
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
