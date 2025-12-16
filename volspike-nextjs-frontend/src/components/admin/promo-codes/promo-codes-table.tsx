'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Eye, Copy, Check, RefreshCw } from 'lucide-react'
import { EditPromoCodeDialog } from './edit-promo-code-dialog'
import { DeletePromoCodeDialog } from './delete-promo-code-dialog'
import { ViewPromoCodeDialog } from './view-promo-code-dialog'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { toast } from 'react-hot-toast'

interface PromoCodesTableProps {
    promoCodes: any[]
    pagination: any
    onPageChange: (page: number) => void
    onRefresh: () => void
    onPromoCodeUpdated: () => void
    onPromoCodeDeleted: () => void
    isLoading?: boolean
}

export function PromoCodesTable({
    promoCodes,
    pagination,
    onPageChange,
    onRefresh,
    onPromoCodeUpdated,
    onPromoCodeDeleted,
    isLoading,
}: PromoCodesTableProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [selectedPromoCode, setSelectedPromoCode] = useState<any>(null)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    const handleEdit = (promoCode: any) => {
        setSelectedPromoCode(promoCode)
        setEditDialogOpen(true)
    }

    const handleDelete = (promoCode: any) => {
        setSelectedPromoCode(promoCode)
        setDeleteDialogOpen(true)
    }

    const handleView = (promoCode: any) => {
        setSelectedPromoCode(promoCode)
        setViewDialogOpen(true)
    }

    const handleCopyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code)
            setCopiedCode(code)
            toast.success('Code copied to clipboard!')
            setTimeout(() => setCopiedCode(null), 2000)
        } catch (error) {
            toast.error('Failed to copy code')
        }
    }

    const getStatusBadge = (promoCode: any) => {
        const isExpired = new Date(promoCode.validUntil) <= new Date()
        const isMaxedOut = promoCode.currentUses >= promoCode.maxUses

        if (!promoCode.active) {
            return <Badge variant="outline" className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">Inactive</Badge>
        }
        if (isExpired) {
            return <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Expired</Badge>
        }
        if (isMaxedOut) {
            return <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">Maxed Out</Badge>
        }
        return <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Active</Badge>
    }

    const getPaymentMethodBadge = (method: string) => {
        const colors: Record<string, string> = {
            CRYPTO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            STRIPE: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
            ALL: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
        }
        return (
            <Badge variant="outline" className={colors[method] || ''}>
                {method}
            </Badge>
        )
    }

    if (promoCodes.length === 0) {
        return (
            <div className="rounded-xl border bg-card p-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No promo codes found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Create your first promo code to start offering discounts
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border bg-card">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold">Promo Codes ({pagination.total})</h3>
                    <Button
                        onClick={onRefresh}
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Payment Method</TableHead>
                                <TableHead>Valid Until</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {promoCodes.map((promoCode) => (
                                <TableRow key={promoCode.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <code className="px-2 py-1 bg-muted rounded font-mono text-sm">
                                                {promoCode.code}
                                            </code>
                                            <Button
                                                onClick={() => handleCopyCode(promoCode.code)}
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                            >
                                                {copiedCode === promoCode.code ? (
                                                    <Check className="h-3 w-3 text-green-600" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-sec-600 dark:text-sec-400">
                                            {promoCode.discountPercent}%
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={promoCode.currentUses >= promoCode.maxUses ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                            {promoCode.currentUses} / {promoCode.maxUses}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {getPaymentMethodBadge(promoCode.paymentMethod)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">
                                                {format(new Date(promoCode.validUntil), 'MMM dd, yyyy')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(promoCode.validUntil), 'hh:mm a')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(promoCode)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                onClick={() => handleView(promoCode)}
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                onClick={() => handleEdit(promoCode)}
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                onClick={() => handleDelete(promoCode)}
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <AdminPagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={onPageChange}
                />
            )}

            {/* Dialogs */}
            {selectedPromoCode && (
                <>
                    <EditPromoCodeDialog
                        open={editDialogOpen}
                        onOpenChange={setEditDialogOpen}
                        promoCode={selectedPromoCode}
                        onPromoCodeUpdated={() => {
                            setEditDialogOpen(false)
                            onPromoCodeUpdated()
                        }}
                    />
                    <DeletePromoCodeDialog
                        open={deleteDialogOpen}
                        onOpenChange={setDeleteDialogOpen}
                        promoCode={selectedPromoCode}
                        onPromoCodeDeleted={() => {
                            setDeleteDialogOpen(false)
                            onPromoCodeDeleted()
                        }}
                    />
                    <ViewPromoCodeDialog
                        open={viewDialogOpen}
                        onOpenChange={setViewDialogOpen}
                        promoCodeId={selectedPromoCode.id}
                    />
                </>
            )}
        </div>
    )
}
