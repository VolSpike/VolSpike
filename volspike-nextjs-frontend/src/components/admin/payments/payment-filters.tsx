'use client'

import { useRouter, useSearchParams } from 'next/navigation'
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
import { Search, X } from 'lucide-react'

interface PaymentFiltersProps {
    currentFilters: {
        email?: string
        paymentStatus?: string
        tier?: string
        paymentId?: string
        invoiceId?: string
        orderId?: string
    }
}

export function PaymentFilters({ currentFilters }: PaymentFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const updateFilter = (key: string, value: string | undefined) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        params.set('page', '1') // Reset to first page
        router.push(`/admin/payments?${params.toString()}`)
    }

    const clearFilters = () => {
        router.push('/admin/payments')
    }

    const hasActiveFilters = Object.values(currentFilters).some(v => v)

    return (
        <div className="bg-card border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Filters</h3>
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Email Search */}
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="email"
                            placeholder="user@example.com"
                            value={currentFilters.email || ''}
                            onChange={(e) => updateFilter('email', e.target.value || undefined)}
                            className="pl-8"
                        />
                    </div>
                </div>

                {/* Payment Status */}
                <div className="space-y-2">
                    <Label htmlFor="paymentStatus">Payment Status</Label>
                    <Select
                        value={currentFilters.paymentStatus || ''}
                        onValueChange={(value) => updateFilter('paymentStatus', value || undefined)}
                    >
                        <SelectTrigger id="paymentStatus">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All statuses</SelectItem>
                            <SelectItem value="waiting">Waiting</SelectItem>
                            <SelectItem value="confirming">Confirming</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="sending">Sending</SelectItem>
                            <SelectItem value="partially_paid">Partially Paid</SelectItem>
                            <SelectItem value="finished">Finished</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Tier */}
                <div className="space-y-2">
                    <Label htmlFor="tier">Tier</Label>
                    <Select
                        value={currentFilters.tier || ''}
                        onValueChange={(value) => updateFilter('tier', value || undefined)}
                    >
                        <SelectTrigger id="tier">
                            <SelectValue placeholder="All tiers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All tiers</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Payment ID */}
                <div className="space-y-2">
                    <Label htmlFor="paymentId">Payment ID</Label>
                    <Input
                        id="paymentId"
                        placeholder="5804360523"
                        value={currentFilters.paymentId || ''}
                        onChange={(e) => updateFilter('paymentId', e.target.value || undefined)}
                    />
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="invoiceId">Invoice ID</Label>
                    <Input
                        id="invoiceId"
                        placeholder="Invoice ID"
                        value={currentFilters.invoiceId || ''}
                        onChange={(e) => updateFilter('invoiceId', e.target.value || undefined)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="orderId">Order ID</Label>
                    <Input
                        id="orderId"
                        placeholder="Order ID"
                        value={currentFilters.orderId || ''}
                        onChange={(e) => updateFilter('orderId', e.target.value || undefined)}
                    />
                </div>
            </div>
        </div>
    )
}

