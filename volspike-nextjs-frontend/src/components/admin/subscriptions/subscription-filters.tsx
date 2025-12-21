'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

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

    // Track when user is actively typing to prevent sync-back from overwriting input
    const isTypingRef = useRef(false)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [filters, setFilters] = useState({
        userId: currentFilters.userId || '',
        status: currentFilters.status || 'all',
        tier: currentFilters.tier || 'all',
    })

    // Sync filters with currentFilters when they change (but not during typing)
    useEffect(() => {
        if (isTypingRef.current) {
            return
        }

        const hasChanges =
            filters.userId !== (currentFilters.userId || '') ||
            filters.status !== (currentFilters.status || 'all') ||
            filters.tier !== (currentFilters.tier || 'all')

        if (hasChanges) {
            setFilters({
                userId: currentFilters.userId || '',
                status: currentFilters.status || 'all',
                tier: currentFilters.tier || 'all',
            })
        }
    }, [currentFilters.userId, currentFilters.status, currentFilters.tier])

    // Debounce search input to avoid too many requests
    const debouncedUserId = useDebounce(filters.userId, 500)

    // Auto-apply filters when they change
    const applyFilters = useCallback(() => {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'all') {
                params.set(key, value)
            }
        })

        params.set('page', '1')
        router.replace(`/admin/subscriptions?${params.toString()}`, { scroll: false })
    }, [filters, router])

    // Auto-apply when dropdowns change (immediate)
    useEffect(() => {
        const statusChanged = filters.status !== (currentFilters.status || 'all')
        const tierChanged = filters.tier !== (currentFilters.tier || 'all')

        if (statusChanged || tierChanged) {
            const params = new URLSearchParams()

            if (filters.userId) params.set('userId', filters.userId)
            if (filters.status && filters.status !== 'all') params.set('status', filters.status)
            if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)

            params.set('page', '1')
            router.replace(`/admin/subscriptions?${params.toString()}`, { scroll: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.tier, router])

    // Auto-apply when debounced search changes
    useEffect(() => {
        if (debouncedUserId !== (currentFilters.userId || '')) {
            const params = new URLSearchParams()

            if (debouncedUserId) params.set('userId', debouncedUserId)
            if (filters.status && filters.status !== 'all') params.set('status', filters.status)
            if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)

            params.set('page', '1')
            router.replace(`/admin/subscriptions?${params.toString()}`, { scroll: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedUserId, router])

    const clearFilters = () => {
        isTypingRef.current = false
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null
        }
        setFilters({
            userId: '',
            status: 'all',
            tier: 'all',
        })
        router.replace('/admin/subscriptions', { scroll: false })
    }

    const hasActiveFilters = Object.entries(filters).some(([, value]) => {
        return value && value !== 'all'
    })

    return (
        <div className="space-y-3">
            {/* Filters Row - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* User Search - Full width on mobile, spans 2 cols on larger screens */}
                <div className="sm:col-span-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                            placeholder="Search by user ID or email..."
                            value={filters.userId}
                            onChange={(e) => {
                                // Mark as typing to prevent sync-back from URL params
                                isTypingRef.current = true
                                if (typingTimeoutRef.current) {
                                    clearTimeout(typingTimeoutRef.current)
                                }
                                typingTimeoutRef.current = setTimeout(() => {
                                    isTypingRef.current = false
                                }, 600)
                                setFilters(prev => ({ ...prev, userId: e.target.value }))
                            }}
                            className="pl-10 h-11 border-2 border-border/60 bg-background/50 hover:border-blue-500/40 focus:border-blue-500/60 transition-colors"
                        />
                    </div>
                </div>

                {/* Status Filter */}
                <div>
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                        <SelectTrigger className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 transition-colors">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Tier Filter */}
                <div>
                    <Select
                        value={filters.tier || 'all'}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}
                    >
                        <SelectTrigger className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 transition-colors">
                            <SelectValue placeholder="All Tiers" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                            {tierOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filters Display - Beautiful Badges */}
            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-purple-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-purple-950/20 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active:</span>
                    {filters.userId && (
                        <button
                            onClick={() => {
                                isTypingRef.current = false
                                setFilters(prev => ({ ...prev, userId: '' }))
                                setTimeout(() => {
                                    const params = new URLSearchParams()
                                    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
                                    if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)
                                    params.set('page', '1')
                                    router.replace(`/admin/subscriptions?${params.toString()}`, { scroll: false })
                                }, 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-300/50 dark:border-blue-700/50"
                        >
                            <Search className="h-3 w-3" />
                            {filters.userId.length > 20 ? `${filters.userId.slice(0, 20)}...` : filters.userId}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    {filters.status && filters.status !== 'all' && (
                        <button
                            onClick={() => {
                                setFilters(prev => ({ ...prev, status: 'all' }))
                                setTimeout(() => applyFilters(), 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors border border-purple-300/50 dark:border-purple-700/50"
                        >
                            Status: {filters.status}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    {filters.tier && filters.tier !== 'all' && (
                        <button
                            onClick={() => {
                                setFilters(prev => ({ ...prev, tier: 'all' }))
                                setTimeout(() => applyFilters(), 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-300/50 dark:border-indigo-700/50"
                        >
                            Tier: {filters.tier}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 ml-auto"
                    >
                        Clear all
                    </Button>
                </div>
            )}
        </div>
    )
}
