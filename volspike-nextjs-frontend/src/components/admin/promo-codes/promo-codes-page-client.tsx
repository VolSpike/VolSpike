'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tag, Plus, Search } from 'lucide-react'
import { PromoCodesTable } from './promo-codes-table'
import { CreatePromoCodeDialog } from './create-promo-code-dialog'
import { adminAPI } from '@/lib/admin/api-client'

interface PromoCodesPageClientProps {
    initialData: {
        promoCodes: any[]
        pagination: any
    }
    query: {
        status?: string
        sortBy?: string
        sortOrder?: string
        page?: number
        limit?: number
    }
    accessToken: string
}

export function PromoCodesPageClient({ initialData, query, accessToken }: PromoCodesPageClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [data, setData] = useState(initialData)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Set access token for API calls
    adminAPI.setAccessToken(accessToken)

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        params.set('page', '1') // Reset to first page when filtering
        router.push(`/admin/promo-codes?${params.toString()}`)
    }

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', page.toString())
        router.push(`/admin/promo-codes?${params.toString()}`)
    }

    const handleRefresh = async () => {
        try {
            setIsLoading(true)
            const freshData = await adminAPI.getPromoCodes(query)
            setData(freshData)
        } catch (error) {
            console.error('Error refreshing promo codes:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePromoCodeCreated = () => {
        setIsCreateDialogOpen(false)
        handleRefresh()
    }

    const handlePromoCodeUpdated = () => {
        handleRefresh()
    }

    const handlePromoCodeDeleted = () => {
        handleRefresh()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sec-500/20 via-sec-500/10 to-transparent text-sec-600 dark:text-sec-400 shadow-inner ring-1 ring-sec-500/30">
                        <Tag className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage promotional codes and discounts
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Create Promo Code
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Select
                    value={query.status || 'all'}
                    onValueChange={(value) => handleFilterChange('status', value)}
                >
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Codes</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={query.sortBy || 'createdAt'}
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                >
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="createdAt">Created Date</SelectItem>
                        <SelectItem value="code">Code</SelectItem>
                        <SelectItem value="currentUses">Usage</SelectItem>
                        <SelectItem value="validUntil">Expiry Date</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={query.sortOrder || 'desc'}
                    onValueChange={(value) => handleFilterChange('sortOrder', value)}
                >
                    <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total Codes</p>
                    <p className="text-2xl font-bold mt-1">{data.pagination.total || 0}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Active Codes</p>
                    <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-500">
                        {data.promoCodes.filter((code: any) => code.active && new Date(code.validUntil) > new Date()).length}
                    </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Expired Codes</p>
                    <p className="text-2xl font-bold mt-1 text-muted-foreground">
                        {data.promoCodes.filter((code: any) => new Date(code.validUntil) <= new Date()).length}
                    </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total Uses</p>
                    <p className="text-2xl font-bold mt-1">
                        {data.promoCodes.reduce((sum: number, code: any) => sum + (code.currentUses || 0), 0)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <PromoCodesTable
                promoCodes={data.promoCodes}
                pagination={data.pagination}
                onPageChange={handlePageChange}
                onRefresh={handleRefresh}
                onPromoCodeUpdated={handlePromoCodeUpdated}
                onPromoCodeDeleted={handlePromoCodeDeleted}
                isLoading={isLoading}
            />

            {/* Create Dialog */}
            <CreatePromoCodeDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onPromoCodeCreated={handlePromoCodeCreated}
            />
        </div>
    )
}
