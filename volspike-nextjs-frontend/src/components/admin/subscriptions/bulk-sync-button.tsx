'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Wrench, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { SubscriptionSummary } from '@/types/admin'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface BulkSyncButtonProps {
    subscriptions: SubscriptionSummary[]
}

export function BulkSyncButton({ subscriptions }: BulkSyncButtonProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<any[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)

    const handleBulkSync = async () => {
        // Filter subscriptions that have Stripe customer IDs
        const syncableSubscriptions = subscriptions.filter(
            sub => sub.stripeCustomerId && sub.stripeCustomerId.trim() !== ''
        )

        if (syncableSubscriptions.length === 0) {
            toast.error('No subscriptions with Stripe customer IDs found')
            return
        }

        setLoading(true)
        setResults([])

        const syncResults: any[] = []
        let successCount = 0
        let errorCount = 0
        let changeCount = 0

        try {
            // Sync subscriptions sequentially to avoid rate limits
            for (const subscription of syncableSubscriptions) {
                try {
                    const result = await adminAPI.syncStripeSubscription(subscription.userId)
                    syncResults.push({
                        ...result,
                        subscriptionId: subscription.id,
                        userEmail: subscription.userEmail,
                    })

                    if (result.success) {
                        successCount++
                        if (result.changes.some((c: any) => c.oldValue !== c.newValue)) {
                            changeCount++
                        }
                    } else {
                        errorCount++
                    }
                } catch (error: any) {
                    errorCount++
                    syncResults.push({
                        success: false,
                        subscriptionId: subscription.id,
                        userEmail: subscription.userEmail,
                        errors: [error.message || 'Sync failed'],
                        changes: [],
                        warnings: [],
                    })
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200))
            }

            setResults(syncResults)
            setDialogOpen(true)

            toast.success(
                `Bulk sync completed: ${successCount} succeeded, ${changeCount} updated, ${errorCount} failed`
            )

            router.refresh()
        } catch (error: any) {
            toast.error('Bulk sync failed: ' + (error.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const successResults = results.filter(r => r.success)
    const errorResults = results.filter(r => !r.success)
    const changedResults = results.filter(r => 
        r.success && r.changes.some((c: any) => c.oldValue !== c.newValue)
    )

    const syncableCount = subscriptions.filter(
        sub => sub.stripeCustomerId && sub.stripeCustomerId.trim() !== ''
    ).length

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={loading || syncableCount === 0}
                                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                                    >
                                        {loading ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                Syncing...
                                            </>
                                        ) : (
                                            <>
                                                <Wrench className="h-4 w-4" />
                                                <span className="hidden sm:inline">Tools</span>
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Subscription Tools</DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onClick={handleBulkSync}
                                        disabled={loading || syncableCount === 0}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Sync All with Stripe
                                        {syncableCount > 0 && (
                                            <Badge variant="secondary" className="ml-auto text-xs">
                                                {syncableCount}
                                            </Badge>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-1.5">
                                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                            <span>
                                                Sync manually updates subscription data from Stripe. 
                                                Usually handled automatically via webhooks.
                                            </span>
                                        </div>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Subscription management tools</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Bulk Sync Results Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                errorResults.length > 0
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                    : 'bg-green-100 dark:bg-green-900/30'
                            }`}>
                                {errorResults.length > 0 ? (
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Bulk Sync Results
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    {results.length} subscription(s) processed
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        <span className="text-sm font-semibold">Successful</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {successResults.length}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-semibold">Updated</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {changedResults.length}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        <span className="text-sm font-semibold">Failed</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        {errorResults.length}
                                    </p>
                                </div>
                            </div>

                            {/* Results List */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Sync Results</h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {results.map((result, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-lg border ${
                                                result.success
                                                    ? result.changes.some((c: any) => c.oldValue !== c.newValue)
                                                        ? 'border-green-500/30 bg-green-500/5'
                                                        : 'border-border/60 bg-card/50'
                                                    : 'border-red-500/30 bg-red-500/5'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{result.userEmail}</p>
                                                    {result.subscription?.tier && (
                                                        <Badge variant="outline" className="mt-1">
                                                            {result.subscription.tier}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={result.success ? 'default' : 'destructive'}
                                                    className={
                                                        result.success && result.changes.some((c: any) => c.oldValue !== c.newValue)
                                                            ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                                                            : ''
                                                    }
                                                >
                                                    {result.success
                                                        ? result.changes.some((c: any) => c.oldValue !== c.newValue)
                                                            ? 'Updated'
                                                            : 'In Sync'
                                                        : 'Failed'}
                                                </Badge>
                                            </div>
                                            {result.changes.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {result.changes.map((change: any, idx: number) => (
                                                        <p key={idx} className="text-xs text-muted-foreground">
                                                            {change.field}: {String(change.oldValue)} → {String(change.newValue)}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                            {result.errors && result.errors.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-red-600 dark:text-red-400">
                                                        {result.errors[0]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

