'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

interface EditPromoCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promoCode: any
    onPromoCodeUpdated: () => void
}

export function EditPromoCodeDialog({ open, onOpenChange, promoCode, onPromoCodeUpdated }: EditPromoCodeDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        discountPercent: '',
        maxUses: '',
        validUntil: '',
        active: true,
    })

    useEffect(() => {
        if (promoCode) {
            setFormData({
                discountPercent: promoCode.discountPercent.toString(),
                maxUses: promoCode.maxUses.toString(),
                validUntil: new Date(promoCode.validUntil).toISOString().slice(0, 16),
                active: promoCode.active,
            })
        }
    }, [promoCode])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            setIsLoading(true)
            await adminAPI.updatePromoCode(promoCode.id, {
                discountPercent: parseInt(formData.discountPercent),
                maxUses: parseInt(formData.maxUses),
                validUntil: new Date(formData.validUntil).toISOString(),
                active: formData.active,
            })

            toast.success('Promo code updated successfully!')
            onPromoCodeUpdated()
        } catch (error: any) {
            console.error('Error updating promo code:', error)
            toast.error(error.message || 'Failed to update promo code')
        } finally {
            setIsLoading(false)
        }
    }

    const minDate = new Date().toISOString().split('T')[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Promo Code</DialogTitle>
                    <DialogDescription>
                        Update promotional code settings
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Code (Cannot be changed)</Label>
                        <Input
                            value={promoCode?.code || ''}
                            disabled
                            className="font-mono bg-muted"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="discountPercent">Discount Percent *</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="discountPercent"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.discountPercent}
                                onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                                disabled={isLoading}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maxUses">Maximum Uses *</Label>
                        <Input
                            id="maxUses"
                            type="number"
                            min={promoCode?.currentUses || 0}
                            value={formData.maxUses}
                            onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                            disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Current uses: {promoCode?.currentUses || 0}. Cannot set below current uses.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validUntil">Valid Until *</Label>
                        <Input
                            id="validUntil"
                            type="datetime-local"
                            value={formData.validUntil}
                            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="active">Active</Label>
                        <Switch
                            id="active"
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
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
                            type="submit"
                            className="flex-1"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Promo Code'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
