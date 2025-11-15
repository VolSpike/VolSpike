'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format, differenceInDays, isPast } from 'date-fns'
import { toast } from 'react-hot-toast'
import {
    ArrowLeft,
    Mail,
    Shield,
    Calendar,
    Clock,
    CreditCard,
    User,
    Ban,
    RefreshCw,
    Edit,
    Trash,
    Key,
    CheckCircle,
    AlertCircle,
    Zap,
    FileText,
    ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AdminUser } from '@/types/admin'
import { adminAPI } from '@/lib/admin/api-client'

interface UserDetailClientProps {
    user: AdminUser
    subscription?: any
}

export function UserDetailClient({ user, subscription }: UserDetailClientProps) {
    const router = useRouter()
    const { data: session } = useSession()
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
    const [editTier, setEditTier] = useState<'free' | 'pro' | 'elite'>('free')
    const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER')
    const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ACTIVE')
    const [savingEdit, setSavingEdit] = useState(false)
    const [loading, setLoading] = useState(false)

    // Ensure admin API has the current access token
    useEffect(() => {
        const token = (session as any)?.accessToken as string | undefined
        if (token) {
            adminAPI.setAccessToken(token)
        }
    }, [session])

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'bg-purple-500 text-white'
            case 'pro':
                return 'bg-blue-500 text-white'
            default:
                return 'bg-gray-500 text-white'
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

    const handleAction = async (action: string) => {
        setLoading(true)
        try {
            switch (action) {
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
                case 'reset-password':
                    await adminAPI.resetUserPassword(user.id)
                    toast.success('Password reset email sent')
                    break
                case 'delete':
                    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                        await adminAPI.deleteUser(user.id)
                        toast.success('User deleted')
                        router.push('/admin/users')
                    }
                    break
            }
        } catch (error: any) {
            console.error('[UserDetailClient] Action error:', error)
            toast.error(error?.message || 'Action failed')
        } finally {
            setLoading(false)
        }
    }

    const openEditDialog = () => {
        setEditingUser(user)
        setEditTier(user.tier as 'free' | 'pro' | 'elite')
        setEditRole(user.role as 'USER' | 'ADMIN')
        setEditStatus(user.status as 'ACTIVE' | 'SUSPENDED' | 'BANNED')
    }

    const handleSaveEdit = async () => {
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
            console.error('[UserDetailClient] Update error:', error)
            toast.error(error?.message || 'Failed to update user')
        } finally {
            setSavingEdit(false)
        }
    }

    const accountAge = differenceInDays(new Date(), new Date(user.createdAt))
    const subscriptionExpiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null
    const isSubscriptionExpired = subscriptionExpiresAt ? isPast(subscriptionExpiresAt) : false
    const daysRemaining = subscriptionExpiresAt ? differenceInDays(subscriptionExpiresAt, new Date()) : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/admin/users')}
                        className="hover:bg-muted/80"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            User Details
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            View and manage user account information
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={openEditDialog}
                        className="flex items-center gap-2"
                    >
                        <Edit className="h-4 w-4" />
                        Edit User
                    </Button>
                    {user.status === 'ACTIVE' ? (
                        <Button
                            variant="outline"
                            onClick={() => handleAction('suspend')}
                            disabled={loading}
                            className="flex items-center gap-2 text-amber-600 hover:text-amber-700"
                        >
                            <Ban className="h-4 w-4" />
                            Suspend
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => handleAction('activate')}
                            disabled={loading}
                            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Activate
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* User Information */}
                <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            User Information
                        </CardTitle>
                        <CardDescription>Basic account details and status</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{user.email}</span>
                                {user.emailVerified && (
                                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                        Verified
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {user.walletAddress && (
                            <div>
                                <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                        {user.walletAddress.includes('@')
                                            ? user.walletAddress
                                            : `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`}
                                    </code>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Tier</Label>
                                <div className="mt-1">
                                    <Badge className={getTierColor(user.tier)}>
                                        {user.tier.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Role</Label>
                                <div className="mt-1">
                                    <Badge variant="outline">{user.role}</Badge>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <div className="mt-1">
                                <Badge className={getStatusColor(user.status)}>
                                    {user.status}
                                </Badge>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Account Created</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            {format(new Date(user.createdAt), 'MMM d, yyyy')}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(user.createdAt), 'h:mm a')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Last Login</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
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
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground">Account Age</Label>
                            <div className="mt-1">
                                <span className="text-sm font-medium">
                                    {accountAge} {accountAge === 1 ? 'day' : 'days'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Subscription Information */}
                <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscription
                        </CardTitle>
                        <CardDescription>Payment and subscription details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {subscriptionExpiresAt ? (
                            <>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Subscription Status</Label>
                                    <div className="mt-1 flex items-center gap-2">
                                        {isSubscriptionExpired ? (
                                            <>
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                <Badge className="bg-red-600/90 text-white">Expired</Badge>
                                            </>
                                        ) : daysRemaining !== null && daysRemaining <= 7 ? (
                                            <>
                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                <Badge className="bg-amber-500/90 text-white">
                                                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                                                </Badge>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                <Badge className="bg-emerald-600/90 text-white">
                                                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                                                </Badge>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs text-muted-foreground">Expires</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {format(subscriptionExpiresAt, 'MMM d, yyyy')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(subscriptionExpiresAt, 'h:mm a')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {user.subscriptionMethod && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Payment Method</Label>
                                        <div className="flex items-center gap-2 mt-1">
                                            {user.subscriptionMethod === 'stripe' ? (
                                                <>
                                                    <CreditCard className="h-4 w-4 text-blue-500" />
                                                    <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                                        Stripe
                                                    </Badge>
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="h-4 w-4 text-purple-500" />
                                                    <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400">
                                                        Crypto
                                                    </Badge>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground">No active subscription</p>
                                <p className="text-xs text-muted-foreground mt-1">This user is on the free tier</p>
                            </div>
                        )}

                        {user.paymentMethod && (
                            <div>
                                <Label className="text-xs text-muted-foreground">Payment History</Label>
                                <div className="mt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push(`/admin/payments?userId=${user.id}`)}
                                        className="flex items-center gap-2"
                                    >
                                        <FileText className="h-4 w-4" />
                                        View Payments
                                        <ExternalLink className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleAction('reset-password')}
                            disabled={loading}
                            className="flex items-center gap-2"
                        >
                            <Key className="h-4 w-4" />
                            Reset Password
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/admin/audit?targetId=${user.id}&targetType=USER`)}
                            className="flex items-center gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            View Audit Logs
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/admin/subscriptions?userId=${user.id}`)}
                            className="flex items-center gap-2"
                        >
                            <CreditCard className="h-4 w-4" />
                            View Subscriptions
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Separator orientation="vertical" className="h-8" />
                        <Button
                            variant="destructive"
                            onClick={() => handleAction('delete')}
                            disabled={loading}
                            className="flex items-center gap-2"
                        >
                            <Trash className="h-4 w-4" />
                            Delete User
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update tier, role, and status for {editingUser?.email}
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
                            onClick={handleSaveEdit}
                            disabled={savingEdit || !editingUser}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                            {savingEdit ? 'Saving…' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

