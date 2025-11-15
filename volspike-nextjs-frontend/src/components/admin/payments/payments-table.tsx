'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    MoreHorizontal,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    ArrowUp,
    ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'

interface Payment {
    id: string
    userId: string
    user: {
        id: string
        email: string
        tier: string
        createdAt: Date
    }
    paymentId: string | null
    paymentStatus: string | null
    payAmount: number | null
    payCurrency: string | null
    actuallyPaid: number | null
    actuallyPaidCurrency: string | null
    tier: string
    invoiceId: string
    orderId: string
    paymentUrl: string
    payAddress: string | null
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
    paidAt: Date | null
}

interface PaymentsTableProps {
    payments: Payment[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
    currentQuery: any
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    waiting: { label: 'Waiting', variant: 'secondary', icon: Clock },
    confirming: { label: 'Confirming', variant: 'secondary', icon: Clock },
    confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle },
    sending: { label: 'Sending', variant: 'secondary', icon: Clock },
    partially_paid: { label: 'Partially Paid', variant: 'outline', icon: AlertTriangle },
    finished: { label: 'Finished', variant: 'default', icon: CheckCircle },
    failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
    refunded: { label: 'Refunded', variant: 'destructive', icon: XCircle },
    expired: { label: 'Expired', variant: 'destructive', icon: XCircle },
}

export function PaymentsTable({ payments, pagination, currentQuery }: PaymentsTableProps) {
    const router = useRouter()
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
    const [manualUpgradeOpen, setManualUpgradeOpen] = useState(false)
    const [upgradeReason, setUpgradeReason] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)

    const handleSort = (column: string) => {
        const newSortBy = column
        const newSortOrder = currentQuery.sortBy === column && currentQuery.sortOrder === 'asc' ? 'desc' : 'asc'
        router.push(`/admin/payments?${new URLSearchParams({
            ...currentQuery,
            sortBy: newSortBy,
            sortOrder: newSortOrder,
        } as any).toString()}`)
    }

    const handleManualUpgrade = async () => {
        if (!selectedPayment) return

        setIsProcessing(true)
        try {
            await adminAPI.manualUpgrade({
                userId: selectedPayment.userId,
                tier: selectedPayment.tier as 'pro' | 'elite',
                reason: upgradeReason || `Manual upgrade - Payment ${selectedPayment.paymentId || selectedPayment.invoiceId} verified`,
            })

            toast.success(`User upgraded to ${selectedPayment.tier}`)
            setManualUpgradeOpen(false)
            setUpgradeReason('')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to upgrade user')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleRetryWebhook = async (paymentId: string) => {
        setIsProcessing(true)
        try {
            await adminAPI.retryWebhook(paymentId)
            toast.success('Webhook retried successfully')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to retry webhook')
        } finally {
            setIsProcessing(false)
        }
    }

    const getStatusBadge = (status: string | null) => {
        if (!status) return <Badge variant="outline">Unknown</Badge>
        const config = statusConfig[status] || { label: status, variant: 'outline' as const, icon: AlertTriangle }
        const Icon = config.icon
        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        )
    }

    const hasTierMismatch = (payment: Payment) => {
        return payment.paymentStatus === 'finished' && payment.user.tier !== payment.tier
    }

    return (
        <>
            <div className="bg-card border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">
                                <button
                                    onClick={() => handleSort('createdAt')}
                                    className="flex items-center gap-1 hover:text-primary"
                                >
                                    Date
                                    {currentQuery.sortBy === 'createdAt' && (
                                        currentQuery.sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                    )}
                                    {currentQuery.sortBy !== 'createdAt' && <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                                </button>
                            </TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tier</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Payment ID</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    No payments found
                                </TableCell>
                            </TableRow>
                        ) : (
                            payments.map((payment) => {
                                const hasMismatch = hasTierMismatch(payment)
                                return (
                                    <TableRow
                                        key={payment.id}
                                        className={hasMismatch ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
                                    >
                                        <TableCell>
                                            <div className="text-sm">
                                                {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(payment.createdAt), 'HH:mm:ss')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{payment.user.email}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Current: {payment.user.tier}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(payment.paymentStatus)}
                                            {hasMismatch && (
                                                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                                    ⚠️ Tier mismatch
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={payment.tier === 'pro' ? 'default' : 'secondary'}>
                                                {payment.tier.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {payment.payAmount ? (
                                                <div>
                                                    <div className="font-medium">${payment.payAmount.toFixed(2)}</div>
                                                    {payment.actuallyPaid && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {payment.actuallyPaid.toFixed(6)} {payment.actuallyPaidCurrency}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-mono text-xs">
                                                {payment.paymentId || 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-mono text-xs">
                                                {payment.orderId}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {hasMismatch && (
                                                        <>
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setSelectedPayment(payment)
                                                                    setManualUpgradeOpen(true)
                                                                }}
                                                            >
                                                                <ArrowUp className="h-4 w-4 mr-2" />
                                                                Fix Tier Mismatch
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleRetryWebhook(payment.id)}
                                                                disabled={isProcessing}
                                                            >
                                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                                Retry Webhook
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                        </>
                                                    )}
                                                    {payment.paymentStatus !== 'finished' && (
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setSelectedPayment(payment)
                                                                setManualUpgradeOpen(true)
                                                            }}
                                                        >
                                                            <ArrowUp className="h-4 w-4 mr-2" />
                                                            Manual Upgrade
                                                        </DropdownMenuItem>
                                                    )}
                                                    {payment.paymentUrl && (
                                                        <DropdownMenuItem
                                                            onClick={() => window.open(payment.paymentUrl, '_blank')}
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                            View Payment Page
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} payments
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/payments?${new URLSearchParams({ ...currentQuery, page: String(pagination.page - 1) } as any).toString()}`)}
                            disabled={pagination.page === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/payments?${new URLSearchParams({ ...currentQuery, page: String(pagination.page + 1) } as any).toString()}`)}
                            disabled={pagination.page >= pagination.pages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Manual Upgrade Dialog */}
            <Dialog open={manualUpgradeOpen} onOpenChange={setManualUpgradeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manual Tier Upgrade</DialogTitle>
                        <DialogDescription>
                            Manually upgrade user to {selectedPayment?.tier.toUpperCase()} tier.
                            {hasTierMismatch(selectedPayment!) && (
                                <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
                                    ⚠️ Payment is finished but user tier doesn't match. This will fix the mismatch.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPayment && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>User</Label>
                                    <div className="text-sm font-medium">{selectedPayment.user.email}</div>
                                </div>
                                <div>
                                    <Label>Current Tier</Label>
                                    <div className="text-sm">{selectedPayment.user.tier}</div>
                                </div>
                                <div>
                                    <Label>Target Tier</Label>
                                    <div className="text-sm font-medium">{selectedPayment.tier.toUpperCase()}</div>
                                </div>
                                <div>
                                    <Label>Payment Status</Label>
                                    <div className="text-sm">{selectedPayment.paymentStatus || 'Unknown'}</div>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="reason">Reason (optional)</Label>
                                <Input
                                    id="reason"
                                    placeholder="e.g., Payment verified manually"
                                    value={upgradeReason}
                                    onChange={(e) => setUpgradeReason(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManualUpgradeOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleManualUpgrade} disabled={isProcessing}>
                            {isProcessing ? 'Processing...' : 'Upgrade User'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

