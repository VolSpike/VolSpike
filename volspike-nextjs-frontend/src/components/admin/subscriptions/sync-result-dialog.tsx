'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Calendar, DollarSign, User } from 'lucide-react'
import { format } from 'date-fns'

interface SyncChange {
    field: string
    oldValue: any
    newValue: any
    reason: string
}

interface SyncResult {
    success: boolean
    userId: string
    userEmail: string
    changes: SyncChange[]
    errors: string[]
    warnings: string[]
    subscription?: {
        id: string
        status: string
        tier: string
        nextBillingDate?: string
        amount?: number
    }
}

interface SyncResultDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    result: SyncResult | null
}

export function SyncResultDialog({ open, onOpenChange, result }: SyncResultDialogProps) {
    if (!result) return null

    const hasChanges = result.changes.some(c => c.oldValue !== c.newValue)
    const hasErrors = result.errors.length > 0
    const hasWarnings = result.warnings.length > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            hasErrors 
                                ? 'bg-red-100 dark:bg-red-900/30' 
                                : hasChanges 
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                            {hasErrors ? (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            ) : hasChanges ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Stripe Sync Result
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {hasErrors 
                                    ? 'Sync completed with errors'
                                    : hasChanges 
                                        ? 'Subscription synced successfully'
                                        : 'No changes needed - already in sync'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
                    <div className="space-y-6">
                        {/* User Info */}
                        <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold">User Information</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                                    <p className="font-medium">{result.userEmail}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">User ID</p>
                                    <p className="font-mono text-xs">{result.userId}</p>
                                </div>
                            </div>
                        </div>

                        {/* Subscription Info */}
                        {result.subscription && (
                            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-semibold">Subscription Details</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                                        <Badge 
                                            variant={result.subscription.status === 'active' ? 'default' : 'secondary'}
                                            className={
                                                result.subscription.status === 'active' 
                                                    ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                                                    : ''
                                            }
                                        >
                                            {result.subscription.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Tier</p>
                                        <Badge variant="outline">{result.subscription.tier}</Badge>
                                    </div>
                                    {result.subscription.nextBillingDate && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                Next Billing
                                            </p>
                                            <p className="font-medium">
                                                {format(new Date(result.subscription.nextBillingDate), 'PPp')}
                                            </p>
                                        </div>
                                    )}
                                    {result.subscription.amount !== null && result.subscription.amount !== undefined && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <DollarSign className="h-3 w-3" />
                                                Amount
                                            </p>
                                            <p className="font-medium">
                                                ${result.subscription.amount.toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                    {result.subscription.id && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground mb-1">Subscription ID</p>
                                            <p className="font-mono text-xs break-all">{result.subscription.id}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Changes */}
                        {result.changes.length > 0 && (
                            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className={`h-4 w-4 ${
                                        hasChanges ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                                    }`} />
                                    <h3 className="text-sm font-semibold">Changes</h3>
                                </div>
                                <div className="space-y-3">
                                    {result.changes.map((change, index) => (
                                        <div 
                                            key={index}
                                            className={`p-3 rounded-md border ${
                                                change.oldValue !== change.newValue
                                                    ? 'border-green-500/30 bg-green-500/5'
                                                    : 'border-border/60 bg-card/30'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-sm font-medium capitalize">{change.field}</span>
                                                {change.oldValue !== change.newValue && (
                                                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                                                        Updated
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className="text-muted-foreground mb-1">Old Value</p>
                                                    <p className="font-mono bg-muted/50 px-2 py-1 rounded">
                                                        {String(change.oldValue)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground mb-1">New Value</p>
                                                    <p className="font-mono bg-muted/50 px-2 py-1 rounded">
                                                        {String(change.newValue)}
                                                    </p>
                                                </div>
                                            </div>
                                            {change.reason && (
                                                <p className="text-xs text-muted-foreground mt-2 italic">
                                                    {change.reason}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warnings */}
                        {hasWarnings && (
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                    <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">Warnings</h3>
                                </div>
                                <ul className="space-y-2">
                                    {result.warnings.map((warning, index) => (
                                        <li key={index} className="text-sm text-yellow-800 dark:text-yellow-300">
                                            • {warning}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Errors */}
                        {hasErrors && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Errors</h3>
                                </div>
                                <ul className="space-y-2">
                                    {result.errors.map((error, index) => (
                                        <li key={index} className="text-sm text-red-800 dark:text-red-300">
                                            • {error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

