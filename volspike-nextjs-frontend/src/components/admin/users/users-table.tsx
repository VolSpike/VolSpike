'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    MoreHorizontal,
    Mail,
    Ban,
    Edit,
    Trash,
    RefreshCw,
    DollarSign,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Users,
    Calendar,
    Clock,
    CreditCard,
    Zap
} from 'lucide-react'
import { format, differenceInDays, isPast, formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { AdminUser } from '@/types/admin'
import { adminAPI } from '@/lib/admin/api-client'
import { Pagination, PaginationInfo } from '@/components/ui/pagination'

interface UsersTableProps {
    users: AdminUser[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
    currentQuery: any
}

export function UsersTable({ users, pagination, currentQuery }: UsersTableProps) {
    const router = useRouter()
    const { data: session } = useSession()
    const [isPending, startTransition] = useTransition()
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [loading, setLoading] = useState<string | null>(null)
    const [showLoading, setShowLoading] = useState(false)
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Prefetch next and previous pages for instant navigation
    useEffect(() => {
        const prefetchPages = () => {
            if (pagination.page < pagination.pages) {
                const nextParams = new URLSearchParams()
                Object.entries(currentQuery).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        nextParams.set(key, String(value))
                    }
                })
                nextParams.set('page', String(pagination.page + 1))
                router.prefetch(`/admin/users?${nextParams.toString()}`)
            }
            
            if (pagination.page > 1) {
                const prevParams = new URLSearchParams()
                Object.entries(currentQuery).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        prevParams.set(key, String(value))
                    }
                })
                prevParams.set('page', String(pagination.page - 1))
                router.prefetch(`/admin/users?${prevParams.toString()}`)
            }
        }
        
        prefetchPages()
    }, [pagination.page, pagination.pages, currentQuery, router])

    // Reset loading state when navigation completes
    useEffect(() => {
        if (!isPending) {
            // Clear timeout if navigation completed quickly
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current)
                loadingTimeoutRef.current = null
            }
            setShowLoading(false)
        }
    }, [isPending])
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
    const [editTier, setEditTier] = useState<'free' | 'pro' | 'elite'>('free')
    const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER')
    const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ACTIVE')
    const [savingEdit, setSavingEdit] = useState(false)

    // Ensure admin API has the current access token on the client
    useEffect(() => {
        const token = (session as any)?.accessToken as string | undefined
        if (token) {
            adminAPI.setAccessToken(token)
        }
    }, [session])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedUsers(users.map(u => u.id))
        } else {
            setSelectedUsers([])
        }
    }

    const handleSelectUser = (userId: string, checked: boolean) => {
        if (checked) {
            setSelectedUsers([...selectedUsers, userId])
        } else {
            setSelectedUsers(selectedUsers.filter(id => id !== userId))
        }
    }

    const openEditDialog = (user: AdminUser) => {
        setEditingUser(user)
        setEditTier(user.tier as 'free' | 'pro' | 'elite')
        setEditRole(user.role as 'USER' | 'ADMIN')
        setEditStatus(user.status as 'ACTIVE' | 'SUSPENDED' | 'BANNED')
    }

    const handleAction = async (action: string, user: AdminUser) => {
        if (action === 'edit') {
            openEditDialog(user)
            return
        }

        setLoading(user.id)
        try {
            switch (action) {
                case 'edit':
                    // handled above
                    return
                case 'suspend':
                    await adminAPI.suspendUser(user.id)
                    toast.success('User suspended')
                    router.refresh()
                    break
                case 'activate':
                    await adminAPI.updateUser(user.id, { status: 'ACTIVE' })
                    toast.success('User activated')
                    router.refresh()
                    break
                case 'delete':
                    if (confirm('Are you sure you want to delete this user?')) {
                        await adminAPI.deleteUser(user.id)
                        toast.success('User deleted')
                        router.refresh()
                    }
                    break
                case 'reset-password':
                    try {
                        const result = await adminAPI.resetUserPassword(user.id)
                        if (result.oauthOnly) {
                            toast.error('This user uses OAuth (Google) login only. They don\'t have a password to reset.')
                        } else {
                            toast.success(`Password reset email sent to ${result.email || user.email}`)
                        }
                    } catch (error: any) {
                        if (error?.response?.oauthOnly) {
                            toast.error('This user uses OAuth (Google) login only. They don\'t have a password to reset.')
                        } else {
                            toast.error(error?.message || 'Failed to send password reset email')
                        }
                    }
                    break
                case 'view-subscription':
                    router.push(`/admin/subscriptions?userId=${user.id}`)
                    break
            }
        } catch (error) {
            toast.error('Action failed')
        } finally {
            setLoading(null)
        }
    }

    const handleSort = (field: string) => {
        try {
            console.log('[UsersTable] handleSort called:', { field, currentQuery })
            
            const newSortOrder = currentQuery.sortBy === field && currentQuery.sortOrder === 'asc' ? 'desc' : 'asc'
            const params = new URLSearchParams()
            
            // Preserve existing query params
            if (currentQuery.search) params.set('search', String(currentQuery.search))
            if (currentQuery.role) params.set('role', String(currentQuery.role))
            if (currentQuery.tier) params.set('tier', String(currentQuery.tier))
            if (currentQuery.status) params.set('status', String(currentQuery.status))
            if (currentQuery.page) params.set('page', String(currentQuery.page))
            if (currentQuery.limit) params.set('limit', String(currentQuery.limit))
            
            // Set sort params
            params.set('sortBy', field)
            params.set('sortOrder', newSortOrder)
            
            const newUrl = `/admin/users?${params.toString()}`
            console.log('[UsersTable] Navigating to:', newUrl)
            
            router.push(newUrl)
        } catch (error) {
            console.error('[UsersTable] Error in handleSort:', error)
            toast.error('Failed to sort table. Please try again.')
        }
    }

    const getSortIcon = (field: string) => {
        if (currentQuery.sortBy !== field) {
            return <ChevronsUpDown className="h-4 w-4" />
        }
        return currentQuery.sortOrder === 'asc' ?
            <ChevronUp className="h-4 w-4" /> :
            <ChevronDown className="h-4 w-4" />
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'bg-purple-500'
            case 'pro':
                return 'bg-blue-500'
            default:
                return 'bg-gray-500'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-emerald-600/90 text-white dark:bg-emerald-600/80'
            case 'SUSPENDED':
                return 'bg-amber-500/90 text-white dark:bg-amber-500/70'
            case 'BANNED':
                return 'bg-red-600/90 text-white dark:bg-red-600/80'
            default:
                return 'bg-gray-500/80 text-white'
        }
    }

    const getStatusTooltip = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'User can sign in and access all features based on their tier. This is the normal state for active accounts.'
            case 'SUSPENDED':
                return 'Account is temporarily disabled. User cannot sign in. Can be reactivated by an admin. Use for temporary restrictions or investigations.'
            case 'BANNED':
                return 'Account is permanently disabled. User cannot sign in. Typically used for soft deletion or permanent bans. Usually not reversible.'
            default:
                return 'Unknown status'
        }
    }

    const getTierTooltip = (tier: string) => {
        switch (tier) {
            case 'free':
                return 'Free tier: 15-minute data refresh, basic features, limited symbols'
            case 'pro':
                return 'Pro tier: 5-minute data refresh, email alerts, all symbols, Open Interest visible'
            case 'elite':
                return 'Elite tier: Real-time updates, SMS alerts, unlimited access, all features'
            default:
                return 'Unknown tier'
        }
    }

    return (
        <div className="space-y-4">
            {selectedUsers.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <span className="text-sm font-medium">
                        {selectedUsers.length} users selected
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            // Implement bulk export
                            toast.success('Bulk export functionality coming soon')
                        }}
                    >
                        Export
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                            try {
                                await adminAPI.executeBulkAction({
                                    action: 'suspend',
                                    userIds: selectedUsers,
                                })
                                toast.success('Users suspended')
                                setSelectedUsers([])
                                router.refresh()
                            } catch (error) {
                                toast.error('Bulk action failed')
                            }
                        }}
                    >
                        Suspend All
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                            if (confirm('Are you sure you want to delete all selected users?')) {
                                try {
                                    await adminAPI.executeBulkAction({
                                        action: 'delete',
                                        userIds: selectedUsers,
                                    })
                                    toast.success('Users deleted')
                                    setSelectedUsers([])
                                    router.refresh()
                                } catch (error) {
                                    toast.error('Bulk action failed')
                                }
                            }
                        }}
                    >
                        Delete All
                    </Button>
                </div>
            )}

            <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden relative">
                <div className="overflow-x-auto overflow-y-visible max-h-[calc(100vh-20rem)] overflow-y-auto">
                    <Table>
                    <TableHeader className="sticky top-0 z-30 bg-background shadow-sm border-b border-border/60">
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedUsers.length === users.length && users.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 w-[200px] min-w-[180px] max-w-[250px]"
                                onClick={() => handleSort('email')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>User</span>
                                    {getSortIcon('email')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('tier')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Tier</span>
                                    {getSortIcon('tier')}
                                </div>
                            </TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Subscription</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('createdAt')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Created</span>
                                    {getSortIcon('createdAt')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('lastLoginAt')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Last Login</span>
                                    {getSortIcon('lastLoginAt')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right sticky right-0 bg-background border-l border-border/60 z-10 min-w-[80px]">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-64">
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                            <Users className="h-8 w-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground mb-1">No users found</h3>
                                        <p className="text-xs text-muted-foreground max-w-sm mb-4">
                                            {currentQuery.search || currentQuery.role || currentQuery.tier || currentQuery.status
                                                ? 'Try adjusting your filters to see more results'
                                                : 'Get started by creating your first user'}
                                        </p>
                                        {(!currentQuery.search && !currentQuery.role && !currentQuery.tier && !currentQuery.status) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => router.push('/admin/users/new')}
                                                className="mt-2"
                                            >
                                                <Users className="h-4 w-4 mr-2" />
                                                Create User
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                            <TableRow
                                key={user.id}
                                className="group cursor-pointer transition-colors hover:bg-muted/50 border-border/60 bg-card/50"
                                onClick={() => router.push(`/admin/users/${user.id}`)}
                            >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selectedUsers.includes(user.id)}
                                        onCheckedChange={(checked) =>
                                            handleSelectUser(user.id, checked as boolean)
                                        }
                                    />
                                </TableCell>
                                <TableCell className="w-[200px] min-w-[180px] max-w-[250px]">
                                    <TooltipProvider>
                                        <div className="flex flex-col gap-1.5">
                                            {/* Email/Wallet - Truncated with tooltip */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {user.walletAddress ? (
                                                            <span className="font-medium text-sm truncate">
                                                                {user.walletAddress.includes('@') 
                                                                    ? user.walletAddress.split('@')[0].slice(0, 8) + '...@' + user.walletAddress.split('@')[1]
                                                                    : `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="font-medium text-sm truncate">
                                                                {user.email.length > 25 
                                                                    ? `${user.email.slice(0, 22)}...`
                                                                    : user.email
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs">
                                                    <p className="break-all">{user.email || user.walletAddress}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                            
                                            {/* Badges - Compact horizontal layout */}
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {user.emailVerified && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                                        <Mail className="h-2.5 w-2.5 mr-0.5" />
                                                        Verified
                                                    </Badge>
                                                )}
                                                {user.paymentMethod === 'stripe' && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                                        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                                                        Stripe
                                                    </Badge>
                                                )}
                                                {user.paymentMethod === 'crypto' && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400">
                                                        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                                                        Crypto
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TooltipProvider>
                                </TableCell>
                                       <TableCell>
                                           <TooltipProvider>
                                               <Tooltip>
                                                   <TooltipTrigger asChild>
                                                       <div>
                                                           <Badge className={getTierColor(user.tier)}>
                                                               {user.tier.toUpperCase()}
                                                           </Badge>
                                                       </div>
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top" className="max-w-xs">
                                                       <p className="font-semibold mb-1">{user.tier.toUpperCase()} Tier</p>
                                                       <p className="text-xs">{getTierTooltip(user.tier)}</p>
                                                   </TooltipContent>
                                               </Tooltip>
                                           </TooltipProvider>
                                       </TableCell>
                                       <TableCell>
                                           <Badge variant="outline">
                                               {user.role}
                                           </Badge>
                                       </TableCell>
                                       <TableCell>
                                           <TooltipProvider>
                                               <Tooltip>
                                                   <TooltipTrigger asChild>
                                                       <div>
                                                           <Badge className={getStatusColor(user.status)}>
                                                               {user.status}
                                                           </Badge>
                                                       </div>
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top" className="max-w-xs">
                                                       <p className="font-semibold mb-1">{user.status}</p>
                                                       <p className="text-xs">{getStatusTooltip(user.status)}</p>
                                                   </TooltipContent>
                                               </Tooltip>
                                           </TooltipProvider>
                                       </TableCell>
                                <TableCell>
                                    {user.subscriptionExpiresAt ? (() => {
                                        const expiresAt = new Date(user.subscriptionExpiresAt)
                                        const isExpired = isPast(expiresAt)
                                        const daysRemaining = differenceInDays(expiresAt, new Date())
                                        
                                        // Determine status and colors
                                        let statusColor = 'text-emerald-600 dark:text-emerald-400'
                                        let statusBg = 'bg-emerald-50 dark:bg-emerald-950/20'
                                        let borderColor = 'border-emerald-200 dark:border-emerald-800'
                                        let statusText = `${daysRemaining} days remaining`
                                        let statusIcon = <Zap className="h-3.5 w-3.5" />
                                        
                                        if (isExpired) {
                                            statusColor = 'text-red-600 dark:text-red-400'
                                            statusBg = 'bg-red-50 dark:bg-red-950/20'
                                            borderColor = 'border-red-200 dark:border-red-800'
                                            statusText = 'Expired'
                                            statusIcon = <Clock className="h-3.5 w-3.5" />
                                        } else if (daysRemaining <= 7) {
                                            statusColor = 'text-red-600 dark:text-red-400'
                                            statusBg = 'bg-red-50 dark:bg-red-950/20'
                                            borderColor = 'border-red-200 dark:border-red-800'
                                            statusIcon = <Clock className="h-3.5 w-3.5" />
                                        } else if (daysRemaining <= 30) {
                                            statusColor = 'text-amber-600 dark:text-amber-400'
                                            statusBg = 'bg-amber-50 dark:bg-amber-950/20'
                                            borderColor = 'border-amber-200 dark:border-amber-800'
                                            statusIcon = <Clock className="h-3.5 w-3.5" />
                                        }
                                        
                                        return (
                                            <div className={`flex flex-col gap-2 p-2.5 rounded-lg border ${borderColor} ${statusBg} transition-colors`}>
                                                {/* Status Row */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className={`flex items-center gap-1.5 ${statusColor}`}>
                                                        {statusIcon}
                                                        <span className="text-xs font-semibold">
                                                            {statusText}
                                                        </span>
                                                    </div>
                                                    {user.subscriptionMethod && (
                                                        <div className="flex items-center gap-1">
                                                            {user.subscriptionMethod === 'stripe' ? (
                                                                <CreditCard className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                                            ) : (
                                                                <Zap className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                                                            )}
                                                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                                                {user.subscriptionMethod === 'stripe' ? 'Stripe' : 'Crypto'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Date Row */}
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium text-foreground">
                                                            {format(expiresAt, 'MMM d, yyyy')}
                                                        </span>
                                                        <span className="text-[10px]">
                                                            {format(expiresAt, 'h:mm a')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })() : (
                                        (() => {
                                            // For free tier users, show account age instead of "Free tier"
                                            if (user.tier === 'free') {
                                                const accountAge = formatDistanceToNow(new Date(user.createdAt), { addSuffix: false })
                                                return (
                                                    <div className="p-2.5 rounded-lg border border-border/40 bg-muted/30">
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Calendar className="h-3 w-3" />
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-medium text-foreground">
                                                                    Account age
                                                                </span>
                                                                <span className="text-[10px]">
                                                                    {accountAge}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            
                                            // For paid users without subscription, show upgrade prompt
                                            return (
                                                <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                        <Clock className="h-3 w-3" />
                                                        <span className="text-xs font-medium">
                                                            No active subscription
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })()
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            {format(new Date(user.createdAt), 'MMM d, yyyy')}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(user.createdAt), 'h:mm a')}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.lastLoginAt ? (
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {format(new Date(user.lastLoginAt), 'MMM d, yyyy')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(user.lastLoginAt), 'h:mm a')}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground italic">No login yet</span>
                                    )}
                                </TableCell>
                                <TableCell 
                                    className="text-right sticky right-0 bg-background border-l border-border/60 z-10 group-hover:bg-muted/50 transition-colors min-w-[80px]" 
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={loading === user.id}
                                                className="h-8 w-8 rounded-md hover:bg-muted/80 transition-colors"
                                            >
                                                {loading === user.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent 
                                            align="end" 
                                            usePortal={true}
                                            className="w-64 rounded-xl border-2 border-border/80 bg-background shadow-2xl backdrop-blur-xl p-2 z-[9999] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
                                            style={{
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                                            }}
                                        >
                                            <DropdownMenuLabel className="px-3 py-2.5 mb-1 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 bg-muted/30 rounded-t-lg -mx-2 -mt-2 mb-2">
                                                Actions
                                            </DropdownMenuLabel>
                                            <div className="space-y-0.5">
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('edit', user)}
                                                    className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-150 focus:bg-blue-50 dark:focus:bg-blue-950/30 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                                                >
                                                    <Edit className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="font-medium text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">Edit User</span>
                                                        <span className="text-xs text-muted-foreground group-hover:text-blue-600/80 dark:group-hover:text-blue-400/80">Change tier, role, or status</span>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('view-subscription', user)}
                                                    className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-150 focus:bg-purple-50 dark:focus:bg-purple-950/30 group border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                                                >
                                                    <DollarSign className="h-4 w-4 mr-3 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="font-medium text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-300">View Subscription</span>
                                                        <span className="text-xs text-muted-foreground group-hover:text-purple-600/80 dark:group-hover:text-purple-400/80">See payment and billing details</span>
                                                    </div>
                                                </DropdownMenuItem>
                                                <div className="my-1.5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                                                {user.status === 'ACTIVE' ? (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            if (confirm(`Suspend ${user.email || user.walletAddress}?\n\nThis will temporarily disable their account. They will not be able to sign in until reactivated.`)) {
                                                                handleAction('suspend', user)
                                                            }
                                                        }}
                                                        className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all duration-150 focus:bg-amber-50 dark:focus:bg-amber-950/40 group border border-transparent hover:border-amber-300 dark:hover:border-amber-700"
                                                    >
                                                        <Ban className="h-4 w-4 mr-3 text-amber-600 dark:text-amber-500 group-hover:scale-110 transition-transform" />
                                                        <div className="flex flex-col flex-1">
                                                            <span className="font-medium text-amber-700 dark:text-amber-400 group-hover:text-amber-800 dark:group-hover:text-amber-300">Suspend User</span>
                                                            <span className="text-xs text-amber-600/90 dark:text-amber-400/90">Temporarily disable account</span>
                                                        </div>
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onClick={() => handleAction('activate', user)}
                                                        className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all duration-150 focus:bg-emerald-50 dark:focus:bg-emerald-950/40 group border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                                                    >
                                                        <RefreshCw className="h-4 w-4 mr-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                                                        <div className="flex flex-col flex-1">
                                                            <span className="font-medium text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300">Activate User</span>
                                                            <span className="text-xs text-emerald-600/90 dark:text-emerald-400/90">Restore account access</span>
                                                        </div>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('reset-password', user)}
                                                    className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-150 focus:bg-indigo-50 dark:focus:bg-indigo-950/30 group border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                                                >
                                                    <Mail className="h-4 w-4 mr-3 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="font-medium text-foreground group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Reset Password</span>
                                                        <span className="text-xs text-muted-foreground group-hover:text-indigo-600/80 dark:group-hover:text-indigo-400/80">Send password reset email</span>
                                                    </div>
                                                </DropdownMenuItem>
                                                <div className="my-1.5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        if (confirm(`Delete ${user.email || user.walletAddress}?\n\nThis will permanently disable their account (soft delete). This action cannot be undone.`)) {
                                                            handleAction('delete', user)
                                                        }
                                                    }}
                                                    className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-150 focus:bg-red-50 dark:focus:bg-red-950/40 group border border-transparent hover:border-red-300 dark:hover:border-red-700"
                                                >
                                                    <Trash className="h-4 w-4 mr-3 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform" />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="font-medium text-red-700 dark:text-red-400 group-hover:text-red-800 dark:group-hover:text-red-300">Delete User</span>
                                                        <span className="text-xs text-red-600/90 dark:text-red-400/90">Permanently disable account</span>
                                                    </div>
                                                </DropdownMenuItem>
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                </Table>
                </div>
            </div>

            {/* Edit user dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-2xl border-2 border-border/80 bg-gradient-to-br from-background via-background to-background/95 backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="space-y-3 pb-4 border-b border-border/60">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-purple-600/20 ring-2 ring-blue-500/30 dark:ring-purple-500/30">
                                <Edit className="h-5 w-5 text-blue-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-purple-700 bg-clip-text text-transparent">
                                    Edit User
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground mt-1">
                                    Updating settings for{' '}
                                    <span className="font-semibold text-foreground">
                                        {editingUser?.email || editingUser?.walletAddress || 'selected user'}
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="edit-tier" className="text-sm font-semibold text-foreground">Tier</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 cursor-help hover:bg-blue-500/20 transition-colors">
                                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">ℹ️</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs bg-popover border border-border shadow-lg">
                                                    <p className="text-xs">{getTierTooltip(editTier)}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Select
                                        value={editTier}
                                        onValueChange={(value) =>
                                            setEditTier(value as 'free' | 'pro' | 'elite')
                                        }
                                    >
                                        <SelectTrigger id="edit-tier" className="h-11 border-2 border-border/60 bg-background hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-all">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                                            <SelectItem value="free" className="hover:bg-blue-50 dark:hover:bg-blue-950/20">Free - Basic features, 15min refresh</SelectItem>
                                            <SelectItem value="pro" className="hover:bg-purple-50 dark:hover:bg-purple-950/20">Pro - Email alerts, 5min refresh</SelectItem>
                                            <SelectItem value="elite" className="hover:bg-purple-50 dark:hover:bg-purple-950/20">Elite - Real-time, SMS alerts</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2.5">
                                    <Label htmlFor="edit-role" className="text-sm font-semibold text-foreground">Role</Label>
                                    <Select
                                        value={editRole}
                                        onValueChange={(value) =>
                                            setEditRole(value as 'USER' | 'ADMIN')
                                        }
                                    >
                                        <SelectTrigger id="edit-role" className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 transition-all">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                                            <SelectItem value="USER" className="hover:bg-blue-50 dark:hover:bg-blue-950/20">User - Standard access</SelectItem>
                                            <SelectItem value="ADMIN" className="hover:bg-purple-50 dark:hover:bg-purple-950/20">Admin - Full system access</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="edit-status" className="text-sm font-semibold text-foreground">Status</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20 cursor-help hover:bg-purple-500/20 transition-colors">
                                                        <span className="text-[10px] text-purple-600 dark:text-purple-400">ℹ️</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs bg-popover border border-border shadow-lg">
                                                    <p className="text-xs">{getStatusTooltip(editStatus)}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Select
                                        value={editStatus}
                                        onValueChange={(value) =>
                                            setEditStatus(
                                                value as 'ACTIVE' | 'SUSPENDED' | 'BANNED'
                                            )
                                        }
                                    >
                                        <SelectTrigger id="edit-status" className="h-11 border-2 border-border/60 bg-background hover:border-purple-500/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 transition-all">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="border-2 border-border/80 bg-background shadow-xl">
                                            <SelectItem value="ACTIVE" className="hover:bg-emerald-50 dark:hover:bg-emerald-950/20">Active - Can sign in</SelectItem>
                                            <SelectItem value="SUSPENDED" className="hover:bg-amber-50 dark:hover:bg-amber-950/20">Suspended - Temporarily disabled</SelectItem>
                                            <SelectItem value="BANNED" className="hover:bg-red-50 dark:hover:bg-red-950/20">Banned - Permanently disabled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="relative rounded-xl border-2 border-blue-500/30 dark:border-purple-500/30 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-purple-50/50 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-purple-950/30 p-4 backdrop-blur-sm overflow-hidden ring-1 ring-blue-500/20 dark:ring-purple-500/20">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-purple-600/5" />
                                <div className="relative flex items-start gap-3">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-2 ring-blue-500/20 dark:ring-purple-500/20">
                                        <Zap className="h-4 w-4 text-blue-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Quick Info</span>
                                        </p>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            Changes take effect immediately. Users with <span className="font-semibold text-amber-600 dark:text-amber-400">SUSPENDED</span> or <span className="font-semibold text-red-600 dark:text-red-400">BANNED</span> status cannot sign in. For crypto payments, access length is controlled by the payment&apos;s expiration date.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-3 pt-4 border-t border-border/60">
                        <Button
                            variant="outline"
                            onClick={() => setEditingUser(null)}
                            disabled={savingEdit}
                            className="border-2 border-border/60 hover:bg-muted/80 transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!editingUser) return
                                try {
                                    setSavingEdit(true)
                                    await adminAPI.updateUser(editingUser.id, {
                                        tier: editTier,
                                        role: editRole,
                                        status: editStatus,
                                    } as any)
                                    toast.success('User updated')
                                    setEditingUser(null)
                                    router.refresh()
                                } catch (error: any) {
                                    toast.error(
                                        error?.message || 'Failed to update user. Please try again.'
                                    )
                                } finally {
                                    setSavingEdit(false)
                                }
                            }}
                            disabled={savingEdit || !editingUser}
                            className="bg-gradient-to-r from-blue-600 via-purple-600 to-purple-700 hover:from-blue-700 hover:via-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                        >
                            {savingEdit ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Save changes
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/60">
                    <PaginationInfo
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        totalItems={pagination.total}
                        itemsPerPage={pagination.limit}
                    />
                    <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        onPageChange={(page) => {
                            // Clear any existing timeout
                            if (loadingTimeoutRef.current) {
                                clearTimeout(loadingTimeoutRef.current)
                            }
                            
                            // Only show loading if transition takes more than 150ms
                            loadingTimeoutRef.current = setTimeout(() => {
                                setShowLoading(true)
                            }, 150)
                            
                            startTransition(() => {
                                const params = new URLSearchParams()
                                
                                // Preserve existing query params
                                if (currentQuery.search) params.set('search', String(currentQuery.search))
                                if (currentQuery.role) params.set('role', String(currentQuery.role))
                                if (currentQuery.tier) params.set('tier', String(currentQuery.tier))
                                if (currentQuery.status) params.set('status', String(currentQuery.status))
                                if (currentQuery.limit) params.set('limit', String(currentQuery.limit))
                                if (currentQuery.sortBy) params.set('sortBy', String(currentQuery.sortBy))
                                if (currentQuery.sortOrder) params.set('sortOrder', String(currentQuery.sortOrder))
                                
                                // Set new page
                                params.set('page', String(page))
                                
                                router.push(`/admin/users?${params.toString()}`)
                            })
                        }}
                        isLoading={isPending}
                        maxVisiblePages={7}
                    />
                </div>
            )}
        </div>
    )
}
