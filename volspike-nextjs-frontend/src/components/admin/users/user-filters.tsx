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
    const [filters, setFilters] = useState({
        search: currentFilters.search || '',
        role: currentFilters.role || '',
        tier: currentFilters.tier || '',
        status: currentFilters.status || '',
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

        router.push(`/admin/users?${params.toString()}`)
    }

    const clearFilters = () => {
        setFilters({
            search: '',
            role: '',
            tier: '',
            status: '',
        })
        router.push('/admin/users')
    }

    const hasActiveFilters = Object.values(filters).some(value => value)

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <Input
                                placeholder="Search users by email or wallet..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                className="pl-10 h-11 border-border/60 bg-background/50"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <Select
                        value={filters.role || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, role: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Tier Filter */}
                    <Select
                        value={filters.tier || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, tier: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Tier" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tiers</SelectItem>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) =>
                            setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))
                        }
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            <SelectItem value="BANNED">Banned</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                        <Button 
                            onClick={applyFilters} 
                            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                            <Filter className="h-4 w-4" />
                            <span>Apply</span>
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                onClick={clearFilters}
                                className="flex items-center space-x-2"
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
                        {filters.search && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Search: {filters.search}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {filters.role && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Role: {filters.role}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, role: '' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {filters.tier && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Tier: {filters.tier}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, tier: '' }))}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {filters.status && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
                                Status: {filters.status}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
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
