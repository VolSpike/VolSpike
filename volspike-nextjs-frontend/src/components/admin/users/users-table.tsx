'use client'

import { useEffect, useState } from 'react'
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
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [loading, setLoading] = useState<string | null>(null)
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
                    await adminAPI.resetUserPassword(user.id)
                    toast.success('Password reset email sent')
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
        const newSortOrder = currentQuery.sortBy === field && currentQuery.sortOrder === 'asc' ? 'desc' : 'asc'
        const params = new URLSearchParams(currentQuery)
        params.set('sortBy', field)
        params.set('sortOrder', newSortOrder)
        router.push(`/admin/users?${params.toString()}`)
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
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
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
                            <TableHead className="text-right sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l border-border/60">
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
                                className="group cursor-pointer transition-colors hover:bg-muted/50 border-border/60"
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
                                    <Badge className={getTierColor(user.tier)}>
                                        {user.tier.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge className={getStatusColor(user.status)}>
                                        {user.status}
                                    </Badge>
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
                                <TableCell className="text-right sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l border-border/60" onClick={(e) => e.stopPropagation()}>
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
                                        <DropdownMenuContent align="end" className="w-56 rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg p-1">
                                            <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                Actions
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onClick={() => handleAction('edit', user)}
                                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted/80 transition-colors focus:bg-muted/80"
                                            >
                                                <Edit className="h-4 w-4 mr-2.5 text-muted-foreground" />
                                                <span>Edit User</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleAction('view-subscription', user)}
                                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted/80 transition-colors focus:bg-muted/80"
                                            >
                                                <DollarSign className="h-4 w-4 mr-2.5 text-muted-foreground" />
                                                <span>View Subscription</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-1 bg-border/60" />
                                            {user.status === 'ACTIVE' ? (
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('suspend', user)}
                                                    className="px-3 py-2 cursor-pointer rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors focus:bg-amber-50 dark:focus:bg-amber-950/20"
                                                >
                                                    <Ban className="h-4 w-4 mr-2.5 text-amber-600 dark:text-amber-500" />
                                                    <span className="text-amber-700 dark:text-amber-400">Suspend User</span>
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('activate', user)}
                                                    className="px-3 py-2 cursor-pointer rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors focus:bg-emerald-50 dark:focus:bg-emerald-950/20"
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-2.5 text-emerald-600 dark:text-emerald-400" />
                                                    <span className="text-emerald-700 dark:text-emerald-400">Activate User</span>
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => handleAction('reset-password', user)}
                                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted/80 transition-colors focus:bg-muted/80"
                                            >
                                                <Mail className="h-4 w-4 mr-2.5 text-muted-foreground" />
                                                <span>Reset Password</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-1 bg-border/60" />
                                            <DropdownMenuItem
                                                onClick={() => handleAction('delete', user)}
                                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:bg-red-50 dark:focus:bg-red-950/20"
                                            >
                                                <Trash className="h-4 w-4 mr-2.5 text-red-600 dark:text-red-400" />
                                                <span className="text-red-700 dark:text-red-400">Delete User</span>
                                            </DropdownMenuItem>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update tier, role, and status for{' '}
                            <span className="font-medium">
                                {editingUser?.email || 'selected user'}
                            </span>
                            .
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-tier">Tier</Label>
                                    <Select
                                        value={editTier}
                                        onValueChange={(value) =>
                                            setEditTier(value as 'free' | 'pro' | 'elite')
                                        }
                                    >
                                        <SelectTrigger id="edit-tier">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="free">Free</SelectItem>
                                            <SelectItem value="pro">Pro</SelectItem>
                                            <SelectItem value="elite">Elite</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-role">Role</Label>
                                    <Select
                                        value={editRole}
                                        onValueChange={(value) =>
                                            setEditRole(value as 'USER' | 'ADMIN')
                                        }
                                    >
                                        <SelectTrigger id="edit-role">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USER">User</SelectItem>
                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select
                                        value={editStatus}
                                        onValueChange={(value) =>
                                            setEditStatus(
                                                value as 'ACTIVE' | 'SUSPENDED' | 'BANNED'
                                            )
                                        }
                                    >
                                        <SelectTrigger id="edit-status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            <SelectItem value="SUSPENDED">Suspended</SelectItem>
                                            <SelectItem value="BANNED">Banned</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Changes take effect immediately. For crypto payments, access length
                                is controlled by the payment&apos;s expiration date.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditingUser(null)}
                            disabled={savingEdit}
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
                        >
                            {savingEdit ? 'Saving…' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() => {
                                const params = new URLSearchParams(currentQuery)
                                params.set('page', String(pagination.page - 1))
                                router.push(`/admin/users?${params.toString()}`)
                            }}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= pagination.pages}
                            onClick={() => {
                                const params = new URLSearchParams(currentQuery)
                                params.set('page', String(pagination.page + 1))
                                router.push(`/admin/users?${params.toString()}`)
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
