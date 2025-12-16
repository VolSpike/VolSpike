'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'
import { Loader2, Tag, Percent, Users, Calendar, CreditCard, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ViewPromoCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promoCodeId: string
}

export function ViewPromoCodeDialog({ open, onOpenChange, promoCodeId }: ViewPromoCodeDialogProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        if (open && promoCodeId) {
            loadData()
        }
    }, [open, promoCodeId])

    const loadData = async () => {
        try {
            setIsLoading(true)
            const result = await adminAPI.getPromoCodeById(promoCodeId)
            setData(result)
        } catch (error: any) {
            console.error('Error loading promo code details:', error)
            toast.error('Failed to load promo code details')
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading || !data) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    const { promoCode, usageHistory, stats } = data

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Promo Code Details</DialogTitle>
                    <DialogDescription>
                        View promo code information and usage history
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Code Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Code</p>
                                <code className="px-3 py-2 bg-muted rounded font-mono text-lg block">
                                    {promoCode.code}
                                </code>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Discount</p>
                                <p className="text-2xl font-bold text-sec-600 dark:text-sec-400">
                                    {promoCode.discountPercent}%
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                                <Badge variant="outline">{promoCode.paymentMethod}</Badge>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Usage</p>
                                <p className="text-lg font-semibold">
                                    {promoCode.currentUses} / {promoCode.maxUses}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {stats.remainingUses} uses remaining
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Valid Until</p>
                                <p className="text-sm">
                                    {format(new Date(promoCode.validUntil), 'MMM dd, yyyy hh:mm a')}
                                </p>
                                {stats.isExpired && (
                                    <Badge variant="outline" className="mt-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                        Expired
                                    </Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Status</p>
                                <Badge variant="outline" className={promoCode.active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}>
                                    {promoCode.active ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Discount Given</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-500">
                                ${stats.totalDiscountGiven.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Created</p>
                            <p className="text-sm">
                                {format(new Date(promoCode.createdAt), 'MMM dd, yyyy')}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                            <p className="text-sm">
                                {format(new Date(promoCode.updatedAt), 'MMM dd, yyyy')}
                            </p>
                        </div>
                    </div>

                    {/* Usage History */}
                    <div>
                        <h3 className="font-semibold mb-3">Usage History ({usageHistory.length})</h3>
                        {usageHistory.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground rounded-lg border border-dashed">
                                <p>No usage history yet</p>
                            </div>
                        ) : (
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Original</TableHead>
                                            <TableHead>Discount</TableHead>
                                            <TableHead>Final</TableHead>
                                            <TableHead>Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {usageHistory.map((usage: any) => (
                                            <TableRow key={usage.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{usage.user.email}</span>
                                                        <span className="text-xs text-muted-foreground">{usage.userId}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>${usage.originalAmount.toFixed(2)}</TableCell>
                                                <TableCell className="text-green-600 dark:text-green-500">
                                                    -${usage.discountAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="font-semibold">
                                                    ${usage.finalAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                    {format(new Date(usage.usedAt), 'MMM dd, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => onOpenChange(false)} variant="outline">
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
