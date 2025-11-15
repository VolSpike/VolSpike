'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Filter, X } from 'lucide-react'

interface SubscriptionFiltersProps {
    currentFilters: {
        userId?: string
        status?: string
        tier?: string
        page?: number
        limit?: number
        sortBy?: string
        sortOrder?: string
    }
}

const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'trialing', label: 'Trialing' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'unpaid', label: 'Unpaid' },
]

const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'elite', label: 'Elite' },
]

export function SubscriptionFilters({ currentFilters }: SubscriptionFiltersProps) {
    const router = useRouter()
    const [filters, setFilters] = useState({
        userId: currentFilters.userId || '',
        status: currentFilters.status || 'all',
        tier: currentFilters.tier || 'all',
    })

    const applyFilters = () => {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            // Skip 'all' values and empty strings
            if (value && value !== 'all') {
                params.set(key, value)
            }
        })

        // Reset to first page when applying filters
        params.set('page', '1')

        router.push(`/admin/subscriptions?${params.toString()}`)
    }

    const clearFilters = () => {
        setFilters({
            userId: '',
            status: 'all',
            tier: 'all',
        })
        router.push('/admin/subscriptions')
    }

    const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
        // Don't count 'all' values or empty strings as active filters
        return value && value !== 'all'
    })

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                    {/* User Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by user ID or email..."
                                value={filters.userId}
                                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                className="pl-10 h-11 border-border/60 bg-background/50"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                        <SelectTrigger className="w-32 h-11 border-border/60 bg-background/50">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Tier Filter */}
                    <Select
                        value={filters.tier || 'all'}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}
                    >
                        <SelectTrigger className="w-32 h-11 border-border/60 bg-background/50">
                            <SelectValue placeholder="All Tiers" />
                        </SelectTrigger>
                        <SelectContent>
                            {tierOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                        <Button 
                            onClick={applyFilters} 
                            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                        >
                            <Filter className="h-4 w-4" />
                            <span>Apply</span>
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                onClick={clearFilters}
                                className="flex items-center space-x-2 border-border/60"
                            >
                                <X className="h-4 w-4" />
                                <span>Clear</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">Active filters:</span>
                        {filters.userId && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                User: {filters.userId}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, userId: '' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {filters.status && filters.status !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Status: {filters.status}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {filters.tier && filters.tier !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Tier: {filters.tier}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, tier: 'all' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
