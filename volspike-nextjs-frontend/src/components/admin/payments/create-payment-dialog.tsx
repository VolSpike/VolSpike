'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'
import { Loader2, Search, User } from 'lucide-react'
import { formatPrice } from '@/lib/pricing'

interface CreatePaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onPaymentCreated?: () => void
}

export function CreatePaymentDialog({ open, onOpenChange, onPaymentCreated }: CreatePaymentDialogProps) {
    const router = useRouter()
    const [isProcessing, setIsProcessing] = useState(false)
    const [searchingUser, setSearchingUser] = useState(false)
    const [userFound, setUserFound] = useState<any>(null)
    
    const [formData, setFormData] = useState({
        email: '',
        paymentId: '',
        orderId: '',
        invoiceId: '',
        amount: '',
        currency: 'usd',
        tier: 'pro' as 'pro' | 'elite',
        actuallyPaid: '',
        // Default to USDT on Solana, our recommended flow
        // Value should match NOWPayments pay_currency code
        actuallyPaidCurrency: 'usdtsol',
    })

    useEffect(() => {
        if (!open) {
            // Reset form when dialog closes
            setFormData({
                email: '',
                paymentId: '',
                orderId: '',
                invoiceId: '',
                amount: '',
                currency: 'usd',
                tier: 'pro',
                actuallyPaid: '',
                actuallyPaidCurrency: 'usdtsol',
            })
            setUserFound(null)
        }
    }, [open])

    const handleSearchUser = async () => {
        if (!formData.email) {
            toast.error('Please enter an email address')
            return
        }

        setSearchingUser(true)
        try {
            const users = await adminAPI.getUsers({ search: formData.email, limit: 1 })
            if (users.users && users.users.length > 0) {
                setUserFound(users.users[0])
                toast.success('User found!')
            } else {
                setUserFound(null)
                toast.error('User not found')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to search user')
            setUserFound(null)
        } finally {
            setSearchingUser(false)
        }
    }

    const handleSubmit = async () => {
        if (!userFound) {
            toast.error('Please search and verify the user first')
            return
        }

        if (!formData.orderId || !formData.amount) {
            toast.error('Order ID and Amount are required')
            return
        }

        setIsProcessing(true)
        try {
            await adminAPI.createPaymentFromNowPayments({
                userId: userFound.id,
                paymentId: formData.paymentId || undefined,
                orderId: formData.orderId,
                invoiceId: formData.invoiceId || undefined,
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                tier: formData.tier,
                actuallyPaid: formData.actuallyPaid ? parseFloat(formData.actuallyPaid) : undefined,
                actuallyPaidCurrency: formData.actuallyPaidCurrency || undefined,
            })

            toast.success(`Payment created and user upgraded to ${formData.tier.toUpperCase()}!`)
            onOpenChange(false)
            router.refresh()
            onPaymentCreated?.()
        } catch (error: any) {
            toast.error(error.message || 'Failed to create payment')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Create Payment from NOWPayments
                    </DialogTitle>
                    <DialogDescription>
                        Create a payment record and upgrade a user based on data from the NOWPayments dashboard.
                        This is useful when a payment was received but not recorded in the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* User Search */}
                    <div className="space-y-2">
                        <Label htmlFor="email">User Email *</Label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="pl-8"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleSearchUser()
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                onClick={handleSearchUser}
                                disabled={searchingUser || !formData.email}
                                variant="outline"
                            >
                                {searchingUser ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Search className="h-4 w-4 mr-2" />
                                        Search
                                    </>
                                )}
                            </Button>
                        </div>
                        {userFound && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium">{userFound.email}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Current tier: {userFound.tier} • ID: {userFound.id}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="paymentId">Payment ID (NOWPayments)</Label>
                            <Input
                                id="paymentId"
                                placeholder="5804360523"
                                value={formData.paymentId}
                                onChange={(e) => setFormData({ ...formData, paymentId: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="orderId">Order ID *</Label>
                            <Input
                                id="orderId"
                                placeholder="volspike-..."
                                value={formData.orderId}
                                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invoiceId">Invoice ID</Label>
                            <Input
                                id="invoiceId"
                                placeholder="Optional"
                                value={formData.invoiceId}
                                onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (USD) *</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                placeholder="9.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tier">Tier *</Label>
                            <Select
                                value={formData.tier}
                                onValueChange={(value: 'pro' | 'elite') => setFormData({ ...formData, tier: value })}
                            >
                                <SelectTrigger id="tier">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pro">Pro ({formatPrice('pro')}/month)</SelectItem>
                                    <SelectItem value="elite">Elite ({formatPrice('elite')}/month)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select
                                value={formData.currency}
                                onValueChange={(value) => setFormData({ ...formData, currency: value })}
                            >
                                <SelectTrigger id="currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="usd">USD</SelectItem>
                                    <SelectItem value="eur">EUR</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Actually Paid (Crypto) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="actuallyPaid">Actually Paid (Crypto)</Label>
                            <Input
                                id="actuallyPaid"
                                type="number"
                                step="0.000001"
                                placeholder="8.948479"
                                value={formData.actuallyPaid}
                                onChange={(e) => setFormData({ ...formData, actuallyPaid: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="actuallyPaidCurrency">Crypto Currency</Label>
                            <Select
                                value={formData.actuallyPaidCurrency}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, actuallyPaidCurrency: value })
                                }
                            >
                                <SelectTrigger id="actuallyPaidCurrency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Values should match NOWPayments pay_currency codes */}
                                    <SelectItem value="usdtsol">USDT · Solana</SelectItem>
                                    <SelectItem value="usdterc20">USDT · Ethereum</SelectItem>
                                    <SelectItem value="usdce">USDC · Ethereum</SelectItem>
                                    <SelectItem value="sol">SOL</SelectItem>
                                    <SelectItem value="btc">BTC</SelectItem>
                                    <SelectItem value="eth">ETH</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing || !userFound || !formData.orderId || !formData.amount}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Payment & Upgrade User'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
