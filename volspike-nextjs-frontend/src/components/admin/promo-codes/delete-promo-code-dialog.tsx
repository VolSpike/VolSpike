'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'
import { Loader2, AlertTriangle } from 'lucide-react'

interface DeletePromoCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promoCode: any
    onPromoCodeDeleted: () => void
}

export function DeletePromoCodeDialog({ open, onOpenChange, promoCode, onPromoCodeDeleted }: DeletePromoCodeDialogProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleDelete = async () => {
        try {
            setIsLoading(true)
            const result = await adminAPI.deletePromoCode(promoCode.id)

            if (result.type === 'soft') {
                toast.success('Promo code deactivated (has usage history)')
            } else {
                toast.success('Promo code deleted permanently')
            }

            onPromoCodeDeleted()
        } catch (error: any) {
            console.error('Error deleting promo code:', error)
            toast.error(error.message || 'Failed to delete promo code')
        } finally {
            setIsLoading(false)
        }
    }

    const hasUsage = promoCode?.currentUses > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Promo Code
                    </DialogTitle>
                    <DialogDescription>
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm font-medium mb-2">Promo Code:</p>
                        <code className="px-2 py-1 bg-background rounded font-mono text-lg">
                            {promoCode?.code}
                        </code>
                    </div>

                    {hasUsage && (
                        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                <strong>Note:</strong> This code has {promoCode.currentUses} usage{promoCode.currentUses > 1 ? 's' : ''}.
                                It will be deactivated instead of permanently deleted to preserve payment history.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            className="flex-1"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                hasUsage ? 'Deactivate Code' : 'Delete Code'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
