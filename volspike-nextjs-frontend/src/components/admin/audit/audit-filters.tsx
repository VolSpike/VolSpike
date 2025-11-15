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
import { Search, Filter, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface AuditFiltersProps {
    currentFilters: {
        actorUserId?: string
        action?: string
        targetType?: string
        targetId?: string
        startDate?: Date
        endDate?: Date
        page?: number
        limit?: number
        sortBy?: string
        sortOrder?: string
    }
}

const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'USER_CREATED', label: 'User Created' },
    { value: 'USER_UPDATED', label: 'User Updated' },
    { value: 'USER_DELETED', label: 'User Deleted' },
    { value: 'SUBSCRIPTION_CREATED', label: 'Subscription Created' },
    { value: 'SUBSCRIPTION_UPDATED', label: 'Subscription Updated' },
    { value: 'SUBSCRIPTION_CANCELLED', label: 'Subscription Cancelled' },
    { value: 'SETTINGS_UPDATED', label: 'Settings Updated' },
    { value: 'SECURITY_EVENT', label: 'Security Event' },
]

const targetTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'USER', label: 'User' },
    { value: 'SUBSCRIPTION', label: 'Subscription' },
    { value: 'SETTINGS', label: 'Settings' },
    { value: 'SYSTEM', label: 'System' },
]

export function AuditFilters({ currentFilters }: AuditFiltersProps) {
    const router = useRouter()
    const [filters, setFilters] = useState({
        actorUserId: currentFilters.actorUserId || '',
        action: currentFilters.action || '',
        targetType: currentFilters.targetType || '',
        targetId: currentFilters.targetId || '',
        startDate: currentFilters.startDate ? format(currentFilters.startDate, 'yyyy-MM-dd') : '',
        endDate: currentFilters.endDate ? format(currentFilters.endDate, 'yyyy-MM-dd') : '',
    })

    const applyFilters = () => {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value)
            }
        })

        // Reset to first page when applying filters
        params.set('page', '1')

        router.push(`/admin/audit?${params.toString()}`)
    }

    const clearFilters = () => {
        setFilters({
            actorUserId: '',
            action: '',
            targetType: '',
            targetId: '',
            startDate: '',
            endDate: '',
        })
        router.push('/admin/audit')
    }

    const hasActiveFilters = Object.values(filters).some(value => value)

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="space-y-4">
                    {/* First Row */}
                    <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                        {/* Actor Search */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                                <Input
                                    placeholder="Search by actor email..."
                                    value={filters.actorUserId}
                                    onChange={(e) => setFilters(prev => ({ ...prev, actorUserId: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                    className="pl-10 h-11 border-border/60 bg-background/50"
                                />
                            </div>
                        </div>

                        {/* Action Filter */}
                        <Select
                            value={filters.action}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
                        >
                            <SelectTrigger className="w-48 h-11 border-border/60 bg-background/50">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                {actionOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Target Type Filter */}
                        <Select
                            value={filters.targetType}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, targetType: value }))}
                        >
                            <SelectTrigger className="w-32 h-11 border-border/60 bg-background/50">
                                <SelectValue placeholder="Target" />
                            </SelectTrigger>
                            <SelectContent>
                                {targetTypeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Second Row */}
                    <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                        {/* Target ID Search */}
                        <div className="flex-1">
                            <Input
                                placeholder="Search by target ID..."
                                value={filters.targetId}
                                onChange={(e) => setFilters(prev => ({ ...prev, targetId: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                className="h-11 border-border/60 bg-background/50"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-40 h-11 border-border/60 bg-background/50"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-40 h-11 border-border/60 bg-background/50"
                            />
                        </div>

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
                        <div className="flex flex-wrap gap-2">
                            <span className="text-sm text-muted-foreground">Active filters:</span>
                            {filters.actorUserId && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                    Actor: {filters.actorUserId}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, actorUserId: '' }))}
                                        className="ml-1 hover:text-blue-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {filters.action && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                    Action: {filters.action}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, action: '' }))}
                                        className="ml-1 hover:text-blue-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {filters.targetType && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                    Target: {filters.targetType}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, targetType: '' }))}
                                        className="ml-1 hover:text-blue-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {filters.targetId && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                    ID: {filters.targetId}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, targetId: '' }))}
                                        className="ml-1 hover:text-blue-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {(filters.startDate || filters.endDate) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                    Date: {filters.startDate || '...'} to {filters.endDate || '...'}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}
                                        className="ml-1 hover:text-blue-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
