'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface UserFiltersProps {
    currentFilters: {
        search?: string
        role?: string
        tier?: string
        status?: string
        page?: number
        limit?: number
        sortBy?: string
        sortOrder?: string
    }
}

export function UserFilters({ currentFilters }: UserFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    
    // Ref to track programmatic updates and prevent state sync loops
    const isProgrammaticUpdate = useRef(false)
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    
    const [filters, setFilters] = useState({
        search: currentFilters.search || '',
        role: currentFilters.role || '',
        tier: currentFilters.tier || '',
        status: currentFilters.status || '',
    })

    // Debug: Log render state
    useEffect(() => {
        console.log('[UserFilters] Render:', {
            localState: filters,
            urlParams: {
                search: currentFilters.search,
                role: currentFilters.role,
                tier: currentFilters.tier,
                status: currentFilters.status,
            },
            searchParamsString: searchParams.toString(),
            isProgrammatic: isProgrammaticUpdate.current,
        })
    })

    // FIX: Sync filters with currentFilters when they change (but not during programmatic updates)
    useEffect(() => {
        // Skip sync if this is a programmatic update we initiated
        if (isProgrammaticUpdate.current) {
            console.log('[UserFilters] Skipping state sync - programmatic update in progress')
            isProgrammaticUpdate.current = false
            return
        }

        // Only sync if URL params actually changed from external source
        const hasChanges = 
            filters.search !== (currentFilters.search || '') ||
            filters.role !== (currentFilters.role || '') ||
            filters.tier !== (currentFilters.tier || '') ||
            filters.status !== (currentFilters.status || '')

        if (hasChanges) {
            console.log('[UserFilters] Syncing state from URL (external change)', {
                currentFilters,
                currentState: filters,
            })
            setFilters({
                search: currentFilters.search || '',
                role: currentFilters.role || '',
                tier: currentFilters.tier || '',
                status: currentFilters.status || '',
            })
        }
    }, [currentFilters.search, currentFilters.role, currentFilters.tier, currentFilters.status])

    // Debounce search input to avoid too many requests
    const debouncedSearch = useDebounce(filters.search, 500)

    // Helper to apply filters
    const applyFilters = useCallback(() => {
        // Skip if this is a programmatic update
        if (isProgrammaticUpdate.current) {
            console.log('[UserFilters] Skipping applyFilters - programmatic update')
            return
        }

        const params = new URLSearchParams()

        console.log('[UserFilters] applyFilters called', {
            filters,
            currentUrl: window.location.search,
            isProgrammatic: isProgrammaticUpdate.current,
        })

        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'all') {
                params.set(key, value)
                console.log(`[UserFilters] Added filter: ${key}=${value}`)
            } else {
                console.log(`[UserFilters] Skipped filter: ${key}=${value}`)
            }
        })

        // Reset to first page when applying filters
        params.set('page', '1')

        const finalUrl = params.toString() 
            ? `/admin/users?${params.toString()}` 
            : '/admin/users'
            
        console.log('[UserFilters] Navigating to', {
            finalUrl,
            params: Object.fromEntries(params),
            hasStatusParam: params.has('status'),
        })

        // Use replace to avoid adding history entries
        router.replace(finalUrl, { scroll: false })
    }, [filters, router])

    // FIX: Auto-apply when dropdowns change (with debounce to prevent race conditions)
    useEffect(() => {
        // Skip if this is a programmatic update
        if (isProgrammaticUpdate.current) {
            console.log('[UserFilters] Skipping auto-apply - programmatic update')
            return
        }

        const roleChanged = filters.role !== (currentFilters.role || '')
        const tierChanged = filters.tier !== (currentFilters.tier || '')
        const statusChanged = filters.status !== (currentFilters.status || '')
        
        console.log('[UserFilters] Auto-apply effect triggered', {
            roleChanged,
            tierChanged,
            statusChanged,
            filters,
            currentFilters,
            isProgrammatic: isProgrammaticUpdate.current,
        })
        
        // Only apply if something actually changed
        if (roleChanged || tierChanged || statusChanged) {
            // Clear any pending timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }

            // Debounce to prevent rapid-fire updates
            updateTimeoutRef.current = setTimeout(() => {
                const params = new URLSearchParams()
                
                if (filters.search) params.set('search', filters.search)
                if (filters.role && filters.role !== 'all') params.set('role', filters.role)
                if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)
                
                // Handle status filter: only add if it has a value, don't add 'all' or empty
                if (filters.status && filters.status !== 'all' && filters.status !== '') {
                    params.set('status', filters.status)
                    console.log('[UserFilters] Adding status filter to URL', filters.status)
                } else {
                    // Don't add status param at all - let backend default to excluding BANNED
                    console.log('[UserFilters] Not adding status filter (will default to exclude BANNED)')
                }
                
                params.set('page', '1')
                
                const finalUrl = params.toString() 
                    ? `/admin/users?${params.toString()}` 
                    : '/admin/users'
                    
                console.log('[UserFilters] Auto-apply navigating to', {
                    finalUrl,
                    params: Object.fromEntries(params),
                    hasStatusParam: params.has('status'),
                })
                
                // Use replace to avoid adding history entries
                router.replace(finalUrl, { scroll: false })
            }, 150) // 150ms debounce
        }

        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.role, filters.tier, filters.status, router])

    // Auto-apply when debounced search changes
    useEffect(() => {
        // Skip if this is a programmatic update
        if (isProgrammaticUpdate.current) {
            console.log('[UserFilters] Skipping search debounce - programmatic update')
            return
        }

        if (debouncedSearch !== (currentFilters.search || '')) {
            const params = new URLSearchParams()
            
            if (debouncedSearch) params.set('search', debouncedSearch)
            if (filters.role && filters.role !== 'all') params.set('role', filters.role)
            if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)
            
            // Handle status filter: only add if it has a value, don't add 'all' or empty
            if (filters.status && filters.status !== 'all' && filters.status !== '') {
                params.set('status', filters.status)
            }
            // Don't add status param if empty - let backend default to excluding BANNED
            
            params.set('page', '1')
            
            const finalUrl = params.toString() 
                ? `/admin/users?${params.toString()}` 
                : '/admin/users'
                
            router.replace(finalUrl, { scroll: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, router])

    const clearFilters = () => {
        console.log('[UserFilters] Clearing all filters')
        
        // Set flag to prevent state sync loop
        isProgrammaticUpdate.current = true
        
        // Clear any pending timeouts
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
            updateTimeoutRef.current = null
        }
        
        setFilters({
            search: '',
            role: '',
            tier: '',
            status: '',
        })
        
        // Use replace to avoid adding history entry
        router.replace('/admin/users', { scroll: false })
        
        // Reset flag after navigation
        setTimeout(() => {
            isProgrammaticUpdate.current = false
        }, 100)
    }

    const hasActiveFilters = Object.values(filters).some(value => value && value !== 'all')

    return (
        <div className="space-y-3">
            {/* Filters Row - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search - Full width on mobile, spans 2 cols on larger screens */}
                <div className="sm:col-span-2 lg:col-span-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                            placeholder="Search users by email or wallet..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="pl-10 h-11 border-2 border-border/60 bg-background/50 hover:border-blue-500/40 focus:border-blue-500/60 transition-colors"
                        />
                    </div>
                </div>

                {/* Role Filter */}
                <div>
                    <Select
                        value={filters.role || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, role: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 transition-colors">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Tier Filter */}
                <div>
                    <Select
                        value={filters.tier || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, tier: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 transition-colors">
                            <SelectValue placeholder="All Tiers" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                            <SelectItem value="all">All Tiers</SelectItem>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status Filter */}
                <div>
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 transition-colors">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            <SelectItem value="BANNED">Banned</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filters Display - Beautiful Badges */}
            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-purple-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-purple-950/20 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active:</span>
                    {filters.search && (
                        <button
                            onClick={() => {
                                setFilters(prev => ({ ...prev, search: '' }))
                                // Apply immediately
                                setTimeout(() => {
                                    const params = new URLSearchParams()
                                    if (filters.role && filters.role !== 'all') params.set('role', filters.role)
                                    if (filters.tier && filters.tier !== 'all') params.set('tier', filters.tier)
                                    if (filters.status && filters.status !== 'all') {
                                        params.set('status', filters.status)
                                    } else if (filters.status === '') {
                                        // Explicit "All Status" - send 'all' to backend
                                        params.set('status', 'all')
                                    }
                                    params.set('page', '1')
                                    router.push(`/admin/users?${params.toString()}`)
                                }, 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-300/50 dark:border-blue-700/50"
                        >
                            <Search className="h-3 w-3" />
                            {filters.search.length > 20 ? `${filters.search.slice(0, 20)}...` : filters.search}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    {filters.role && filters.role !== 'all' && (
                        <button
                            onClick={() => {
                                setFilters(prev => ({ ...prev, role: '' }))
                                setTimeout(() => applyFilters(), 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors border border-purple-300/50 dark:border-purple-700/50"
                        >
                            Role: {filters.role}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    {filters.tier && filters.tier !== 'all' && (
                        <button
                            onClick={() => {
                                setFilters(prev => ({ ...prev, tier: '' }))
                                setTimeout(() => applyFilters(), 0)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-300/50 dark:border-indigo-700/50"
                        >
                            Tier: {filters.tier}
                            <X className="h-3 w-3 ml-0.5" />
                        </button>
                    )}
                    {filters.status && filters.status !== 'all' && (
                        <button
                            onClick={() => {
                                console.log('[UserFilters] Clearing status filter - START', {
                                    currentStatus: filters.status,
                                    currentUrl: window.location.search,
                                    searchParamsString: searchParams.toString(),
                                    before: filters,
                                    isProgrammatic: isProgrammaticUpdate.current,
                                })
                                
                                // Set flag to prevent state sync loop
                                isProgrammaticUpdate.current = true
                                
                                // Clear any pending auto-apply timeout
                                if (updateTimeoutRef.current) {
                                    clearTimeout(updateTimeoutRef.current)
                                    updateTimeoutRef.current = null
                                }
                                
                                // Update local state first
                                setFilters(prev => {
                                    const updated = { ...prev, status: '' }
                                    console.log('[UserFilters] Status filter cleared in state', {
                                        after: updated,
                                    })
                                    return updated
                                })
                                
                                // Build new URL without status param
                                const params = new URLSearchParams(searchParams.toString())
                                params.delete('status') // Remove status param completely
                                params.set('page', '1')
                                
                                const finalUrl = params.toString() 
                                    ? `/admin/users?${params.toString()}` 
                                    : '/admin/users'
                                
                                console.log('[UserFilters] Navigating to URL without status param', {
                                    finalUrl,
                                    params: Object.fromEntries(params),
                                    hasStatusParam: params.has('status'),
                                    isProgrammatic: isProgrammaticUpdate.current,
                                })
                                
                                // Use replace instead of push to avoid history entries
                                // scroll: false prevents scroll to top
                                router.replace(finalUrl, { scroll: false })
                                
                                // Reset flag after a short delay to allow navigation to complete
                                setTimeout(() => {
                                    isProgrammaticUpdate.current = false
                                    console.log('[UserFilters] Programmatic update flag reset')
                                }, 100)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors border border-amber-300/50 dark:border-amber-700/50"
                        >
                            Status: {filters.status}
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
