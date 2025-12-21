'use client'

import { useState, useEffect, useRef } from 'react'
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
import { useDebounce } from '@/hooks/use-debounce'

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

    // Track when user is actively typing to prevent sync-back from overwriting input
    const isTypingRef = useRef<Record<string, boolean>>({})
    const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout | null>>({})

    const [filters, setFilters] = useState({
        email: currentFilters.email || '',
        paymentStatus: currentFilters.paymentStatus || '',
        tier: currentFilters.tier || '',
        paymentId: currentFilters.paymentId || '',
        invoiceId: currentFilters.invoiceId || '',
        orderId: currentFilters.orderId || '',
    })

    // Debounce text inputs
    const debouncedEmail = useDebounce(filters.email, 500)
    const debouncedPaymentId = useDebounce(filters.paymentId, 500)
    const debouncedInvoiceId = useDebounce(filters.invoiceId, 500)
    const debouncedOrderId = useDebounce(filters.orderId, 500)

    // Sync filters with currentFilters when they change (but not during typing)
    useEffect(() => {
        const newFilters: typeof filters = {
            email: currentFilters.email || '',
            paymentStatus: currentFilters.paymentStatus || '',
            tier: currentFilters.tier || '',
            paymentId: currentFilters.paymentId || '',
            invoiceId: currentFilters.invoiceId || '',
            orderId: currentFilters.orderId || '',
        }

        // Only sync fields that aren't being typed in
        const syncedFilters = { ...filters }
        let hasChanges = false

        for (const key of Object.keys(newFilters) as (keyof typeof newFilters)[]) {
            if (!isTypingRef.current[key] && syncedFilters[key] !== newFilters[key]) {
                syncedFilters[key] = newFilters[key]
                hasChanges = true
            }
        }

        if (hasChanges) {
            setFilters(syncedFilters)
        }
    }, [currentFilters.email, currentFilters.paymentStatus, currentFilters.tier, currentFilters.paymentId, currentFilters.invoiceId, currentFilters.orderId])

    const updateUrl = (updates: Record<string, string | undefined>) => {
        const params = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                params.set(key, value)
            } else {
                params.delete(key)
            }
        }
        params.set('page', '1')
        router.replace(`/admin/payments?${params.toString()}`, { scroll: false })
    }

    // Handle text input changes with typing tracking
    const handleTextInputChange = (key: string, value: string) => {
        isTypingRef.current[key] = true
        if (typingTimeoutRef.current[key]) {
            clearTimeout(typingTimeoutRef.current[key]!)
        }
        typingTimeoutRef.current[key] = setTimeout(() => {
            isTypingRef.current[key] = false
        }, 600)
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    // Handle select changes (immediate)
    const handleSelectChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value === 'all' ? '' : value }))
        updateUrl({ [key]: value === 'all' ? undefined : value })
    }

    // Auto-apply debounced text filters
    useEffect(() => {
        if (debouncedEmail !== (currentFilters.email || '')) {
            updateUrl({ email: debouncedEmail || undefined })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedEmail])

    useEffect(() => {
        if (debouncedPaymentId !== (currentFilters.paymentId || '')) {
            updateUrl({ paymentId: debouncedPaymentId || undefined })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedPaymentId])

    useEffect(() => {
        if (debouncedInvoiceId !== (currentFilters.invoiceId || '')) {
            updateUrl({ invoiceId: debouncedInvoiceId || undefined })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedInvoiceId])

    useEffect(() => {
        if (debouncedOrderId !== (currentFilters.orderId || '')) {
            updateUrl({ orderId: debouncedOrderId || undefined })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedOrderId])

    const clearFilters = () => {
        // Reset typing refs
        isTypingRef.current = {}
        for (const key of Object.keys(typingTimeoutRef.current)) {
            if (typingTimeoutRef.current[key]) {
                clearTimeout(typingTimeoutRef.current[key]!)
            }
        }
        typingTimeoutRef.current = {}

        setFilters({
            email: '',
            paymentStatus: '',
            tier: '',
            paymentId: '',
            invoiceId: '',
            orderId: '',
        })
        router.replace('/admin/payments', { scroll: false })
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
                            value={filters.email}
                            onChange={(e) => handleTextInputChange('email', e.target.value)}
                            className="pl-8"
                            autoComplete="off"
                            data-1p-ignore
                            data-lpignore="true"
                        />
                    </div>
                </div>

                {/* Payment Status */}
                <div className="space-y-2">
                    <Label htmlFor="paymentStatus">Payment Status</Label>
                    <Select
                        value={filters.paymentStatus || 'all'}
                        onValueChange={(value) => handleSelectChange('paymentStatus', value)}
                    >
                        <SelectTrigger id="paymentStatus">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
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
                        value={filters.tier || 'all'}
                        onValueChange={(value) => handleSelectChange('tier', value)}
                    >
                        <SelectTrigger id="tier">
                            <SelectValue placeholder="All tiers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All tiers</SelectItem>
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
                        value={filters.paymentId}
                        onChange={(e) => handleTextInputChange('paymentId', e.target.value)}
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
                        value={filters.invoiceId}
                        onChange={(e) => handleTextInputChange('invoiceId', e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="orderId">Order ID</Label>
                    <Input
                        id="orderId"
                        placeholder="Order ID"
                        value={filters.orderId}
                        onChange={(e) => handleTextInputChange('orderId', e.target.value)}
                    />
                </div>
            </div>
        </div>
    )
}
