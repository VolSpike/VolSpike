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
    MoreHorizontal,
    Mail,
    Ban,
    Edit,
    Trash,
    RefreshCw,
    DollarSign,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown
} from 'lucide-react'
import { format } from 'date-fns'
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
                return 'bg-green-500'
            case 'SUSPENDED':
                return 'bg-yellow-500'
            case 'BANNED':
                return 'bg-red-500'
            default:
                return 'bg-gray-500'
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

            <div className="rounded-md border">
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
                                className="cursor-pointer hover:bg-muted/50"
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
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow
                                key={user.id}
                                className="cursor-pointer hover:bg-muted/50"
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
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.email}</span>
                                        {user.walletAddress && (
                                            <span className="text-xs text-muted-foreground">
                                                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                                            </span>
                                        )}
                                        <div className="flex gap-1 mt-1">
                                            {user.emailVerified && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Mail className="h-3 w-3 mr-1" />
                                                    Verified
                                                </Badge>
                                            )}
                                            {user.stripeCustomerId && (
                                                <Badge variant="outline" className="text-xs">
                                                    <DollarSign className="h-3 w-3 mr-1" />
                                                    Stripe
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
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
                                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    {user.lastLoginAt
                                        ? format(new Date(user.lastLoginAt), 'MMM d, yyyy')
                                        : 'Never'
                                    }
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={loading === user.id}
                                            >
                                                {loading === user.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <MoreHorizontal className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onClick={() => handleAction('edit', user)}
                                            >
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit User
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleAction('view-subscription', user)}
                                            >
                                                <DollarSign className="h-4 w-4 mr-2" />
                                                View Subscription
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {user.status === 'ACTIVE' ? (
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('suspend', user)}
                                                    className="text-yellow-600"
                                                >
                                                    <Ban className="h-4 w-4 mr-2" />
                                                    Suspend User
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('activate', user)}
                                                    className="text-green-600"
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Activate User
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => handleAction('reset-password', user)}
                                            >
                                                <Mail className="h-4 w-4 mr-2" />
                                                Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleAction('delete', user)}
                                                className="text-red-600"
                                            >
                                                <Trash className="h-4 w-4 mr-2" />
                                                Delete User
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
