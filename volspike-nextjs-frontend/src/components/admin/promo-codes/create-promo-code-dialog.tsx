'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

interface CreatePromoCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onPromoCodeCreated: () => void
}

export function CreatePromoCodeDialog({ open, onOpenChange, onPromoCodeCreated }: CreatePromoCodeDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        code: '',
        discountPercent: '50',
        maxUses: '100',
        validUntil: '',
        paymentMethod: 'CRYPTO' as 'CRYPTO' | 'STRIPE' | 'ALL',
        active: true,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!formData.code.trim()) {
            toast.error('Please enter a promo code')
            return
        }
        if (parseInt(formData.discountPercent) < 1 || parseInt(formData.discountPercent) > 100) {
            toast.error('Discount must be between 1% and 100%')
            return
        }
        if (parseInt(formData.maxUses) < 1) {
            toast.error('Max uses must be at least 1')
            return
        }
        if (!formData.validUntil) {
            toast.error('Please select an expiry date')
            return
        }

        try {
            setIsLoading(true)
            await adminAPI.createPromoCode({
                code: formData.code.toUpperCase().trim(),
                discountPercent: parseInt(formData.discountPercent),
                maxUses: parseInt(formData.maxUses),
                validUntil: new Date(formData.validUntil).toISOString(),
                paymentMethod: formData.paymentMethod,
                active: formData.active,
            })

            toast.success('Promo code created successfully!')
            onPromoCodeCreated()

            // Reset form
            setFormData({
                code: '',
                discountPercent: '50',
                maxUses: '100',
                validUntil: '',
                paymentMethod: 'CRYPTO',
                active: true,
            })
        } catch (error: any) {
            console.error('Error creating promo code:', error)
            toast.error(error.message || 'Failed to create promo code')
        } finally {
            setIsLoading(false)
        }
    }

    // Get minimum date (today)
    const minDate = new Date().toISOString().split('T')[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Promo Code</DialogTitle>
                    <DialogDescription>
                        Create a new promotional code for discounts
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="code">Promo Code *</Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="VOLSPIKE26"
                            className="font-mono uppercase"
                            maxLength={20}
                            disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Alphanumeric characters only, 3-20 characters
                        </p>
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
                            min="1"
                            value={formData.maxUses}
                            onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validUntil">Valid Until *</Label>
                        <Input
                            id="validUntil"
                            type="datetime-local"
                            min={minDate}
                            value={formData.validUntil}
                            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Payment Method *</Label>
                        <Select
                            value={formData.paymentMethod}
                            onValueChange={(value: any) => setFormData({ ...formData, paymentMethod: value })}
                            disabled={isLoading}
                        >
                            <SelectTrigger id="paymentMethod">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CRYPTO">Crypto Only</SelectItem>
                                <SelectItem value="STRIPE">Stripe Only</SelectItem>
                                <SelectItem value="ALL">All Methods</SelectItem>
                            </SelectContent>
                        </Select>
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
                                    Creating...
                                </>
                            ) : (
                                'Create Promo Code'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
