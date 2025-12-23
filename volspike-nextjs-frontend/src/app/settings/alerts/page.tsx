'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
    Bell,
    Trash2,
    RefreshCw,
    TrendingUp,
    Zap,
    BarChart3,
    Mail,
    Monitor,
    AlertCircle,
    Pencil,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { useUserAlerts, type UserAlert } from '@/hooks/use-user-alerts'

const ALERT_TYPE_ICONS: Record<string, any> = {
    PRICE_CROSS: TrendingUp,
    FUNDING_CROSS: Zap,
    OI_CROSS: BarChart3,
}

const ALERT_TYPE_NAMES: Record<string, string> = {
    PRICE_CROSS: 'Price Cross',
    FUNDING_CROSS: 'Funding Rate Cross',
    OI_CROSS: 'Open Interest Cross',
}

export default function AlertsPage() {
    const { data: session } = useSession()
    const [activeTab, setActiveTab] = useState('active')

    // Dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedAlert, setSelectedAlert] = useState<UserAlert | null>(null)
    const [editThreshold, setEditThreshold] = useState('')
    const [editDisplayThreshold, setEditDisplayThreshold] = useState('')
    const [editDeliveryMethod, setEditDeliveryMethod] = useState<'DASHBOARD' | 'EMAIL' | 'BOTH'>('DASHBOARD')

    // Use the centralized hook
    const {
        alerts,
        activeAlerts,
        inactiveAlerts,
        isLoading,
        deleteAlertAsync,
        isDeleting,
        reactivateAlert,
        isReactivating,
        updateAlertAsync,
        isUpdating,
    } = useUserAlerts()

    // Get user tier info
    const userTier = (session?.user as any)?.tier || 'free'
    const tierLimits: Record<string, number> = {
        free: 3,
        pro: 10,
        elite: 999999,
    }
    const maxAlerts = tierLimits[userTier] || 3
    const canUseEmail = userTier === 'pro' || userTier === 'elite'

    // Format number with thousand separators
    const formatNumberWithCommas = (value: string): string => {
        const cleaned = value.replace(/[^\d.]/g, '')
        const parts = cleaned.split('.')
        const integerPart = parts[0]
        const decimalPart = parts[1]
        const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return decimalPart !== undefined ? `${formatted}.${decimalPart}` : formatted
    }

    const unformatNumber = (value: string): string => {
        return value.replace(/,/g, '')
    }

    const handleEditThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value
        const unformatted = unformatNumber(input)

        if (selectedAlert?.alertType === 'FUNDING_CROSS') {
            setEditThreshold(input)
            setEditDisplayThreshold(input)
        } else {
            setEditThreshold(unformatted)
            setEditDisplayThreshold(formatNumberWithCommas(input))
        }
    }

    const openEditDialog = (alert: UserAlert) => {
        setSelectedAlert(alert)
        // Format threshold for display
        if (alert.alertType === 'FUNDING_CROSS') {
            const displayValue = (alert.threshold * 100).toFixed(4)
            setEditThreshold(displayValue)
            setEditDisplayThreshold(displayValue)
        } else {
            const displayValue = alert.threshold.toString()
            setEditThreshold(displayValue)
            setEditDisplayThreshold(formatNumberWithCommas(displayValue))
        }
        setEditDeliveryMethod(alert.deliveryMethod)
        setEditDialogOpen(true)
    }

    const handleEdit = async () => {
        if (!selectedAlert) return

        try {
            let threshold = parseFloat(editThreshold)
            if (selectedAlert.alertType === 'FUNDING_CROSS') {
                threshold = threshold / 100
            }

            await updateAlertAsync({
                alertId: selectedAlert.id,
                data: {
                    threshold,
                    deliveryMethod: editDeliveryMethod,
                },
            })
            toast.success('Alert updated successfully')
            setEditDialogOpen(false)
            setSelectedAlert(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update alert')
        }
    }

    const openDeleteDialog = (alert: UserAlert) => {
        setSelectedAlert(alert)
        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!selectedAlert) return

        try {
            await deleteAlertAsync(selectedAlert.id)
            toast.success('Alert deleted successfully')
            setDeleteDialogOpen(false)
            setSelectedAlert(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete alert')
        }
    }

    const handleReactivate = (alertId: string) => {
        reactivateAlert(alertId, {
            onSuccess: () => toast.success('Alert reactivated successfully'),
            onError: (error) => toast.error(error.message),
        })
    }

    const formatValue = (value: number, type: string): string => {
        if (type === 'PRICE_CROSS' || type === 'OI_CROSS') {
            return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        } else if (type === 'FUNDING_CROSS') {
            return `${(value * 100).toFixed(4)}%`
        }
        return value.toString()
    }

    const formatSymbol = (symbol: string) => symbol.replace(/USDT$/i, '')

    const renderAlert = (alert: UserAlert) => {
        const Icon = ALERT_TYPE_ICONS[alert.alertType]
        const typeName = ALERT_TYPE_NAMES[alert.alertType]

        return (
            <Card key={alert.id} className="overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 rounded-lg bg-brand-500/10">
                                <Icon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-semibold">
                                        {formatSymbol(alert.symbol)} - {typeName}
                                    </h3>
                                    {!alert.isActive && (
                                        <Badge variant="secondary" className="text-xs">
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <p>
                                        <span className="font-medium">Threshold:</span>{' '}
                                        {formatValue(alert.threshold, alert.alertType)}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-medium">Delivery:</span>
                                        {alert.deliveryMethod === 'DASHBOARD' && (
                                            <span className="flex items-center gap-1">
                                                <Monitor className="h-3 w-3" />
                                                Dashboard
                                            </span>
                                        )}
                                        {alert.deliveryMethod === 'EMAIL' && (
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                Email
                                            </span>
                                        )}
                                        {alert.deliveryMethod === 'BOTH' && (
                                            <span className="flex items-center gap-1">
                                                <Monitor className="h-3 w-3" />
                                                Dashboard +
                                                <Mail className="h-3 w-3" />
                                                Email
                                            </span>
                                        )}
                                    </p>
                                    <p>
                                        <span className="font-medium">Created:</span>{' '}
                                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                    </p>
                                    {alert.triggeredAt && (
                                        <p>
                                            <span className="font-medium">Triggered:</span>{' '}
                                            {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                                            {alert.triggeredValue && (
                                                <span className="ml-1">
                                                    at {formatValue(alert.triggeredValue, alert.alertType)}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!alert.isActive && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReactivate(alert.id)}
                                    disabled={isReactivating}
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${isReactivating ? 'animate-spin' : ''}`} />
                                    Reactivate
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(alert)}
                                title="Edit alert"
                            >
                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDeleteDialog(alert)}
                                title="Delete alert"
                            >
                                <Trash2 className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!session) {
        return (
            <div className="flex-1 bg-background">
                <HeaderWithBanner />
                <main className="container mx-auto px-4 py-8 max-w-4xl">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
                            <p className="text-muted-foreground">
                                Please sign in to manage your alerts.
                            </p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="flex-1 bg-background">
            <HeaderWithBanner />
            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Alerts</h1>
                    <p className="text-muted-foreground">
                        Manage your price, funding rate, and open interest alerts
                    </p>
                </div>

                {/* Tier Info Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Active Alerts</p>
                                <p className="text-2xl font-bold">
                                    {activeAlerts.length} / {userTier === 'elite' ? '∞' : maxAlerts}
                                </p>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline" className="text-sm capitalize">
                                    {userTier} Tier
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {userTier === 'free' && 'Upgrade to Pro for 10 alerts'}
                                    {userTier === 'pro' && 'Upgrade to Elite for unlimited alerts'}
                                    {userTier === 'elite' && 'Unlimited alerts'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Alerts Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="active">
                            <Bell className="h-4 w-4 mr-2" />
                            Active ({activeAlerts.length})
                        </TabsTrigger>
                        <TabsTrigger value="inactive">
                            Inactive ({inactiveAlerts.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="space-y-4 mt-6">
                        {isLoading ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto" />
                                    <p className="mt-4 text-sm text-muted-foreground">Loading alerts...</p>
                                </CardContent>
                            </Card>
                        ) : activeAlerts.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Create your first alert from the market table by clicking the bell icon
                                    </p>
                                    <Button asChild>
                                        <a href="/dashboard">
                                            Go to Dashboard
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            activeAlerts.map(renderAlert)
                        )}
                    </TabsContent>

                    <TabsContent value="inactive" className="space-y-4 mt-6">
                        {isLoading ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto" />
                                    <p className="mt-4 text-sm text-muted-foreground">Loading alerts...</p>
                                </CardContent>
                            </Card>
                        ) : inactiveAlerts.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No Inactive Alerts</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Alerts that have been triggered will appear here
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            inactiveAlerts.map(renderAlert)
                        )}
                    </TabsContent>
                </Tabs>
                </div>
            </main>

            {/* Edit Alert Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Alert</DialogTitle>
                        <DialogDescription>
                            Update the threshold value or delivery method for your {selectedAlert && formatSymbol(selectedAlert.symbol)} {selectedAlert && ALERT_TYPE_NAMES[selectedAlert.alertType]} alert.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-threshold">
                                Value ({selectedAlert?.alertType === 'FUNDING_CROSS' ? '%' : '$'})
                            </Label>
                            <Input
                                id="edit-threshold"
                                type="text"
                                inputMode="decimal"
                                value={editDisplayThreshold}
                                onChange={handleEditThresholdChange}
                                onFocus={(e) => e.target.select()}
                                className="font-mono-tabular"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Delivery Method</Label>
                            <Select
                                value={editDeliveryMethod}
                                onValueChange={(value: any) => setEditDeliveryMethod(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DASHBOARD">
                                        Dashboard Notifications
                                    </SelectItem>
                                    <SelectItem value="EMAIL" disabled={!canUseEmail}>
                                        <span className="flex items-center gap-2">
                                            Email
                                            {!canUseEmail && (
                                                <Badge variant="outline" className="text-[10px] ml-auto">
                                                    Pro+
                                                </Badge>
                                            )}
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="BOTH" disabled={!canUseEmail}>
                                        <span className="flex items-center gap-2">
                                            Dashboard + Email
                                            {!canUseEmail && (
                                                <Badge variant="outline" className="text-[10px] ml-auto">
                                                    Pro+
                                                </Badge>
                                            )}
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={isUpdating}>
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Alert</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this alert? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAlert && (
                        <div className="py-4">
                            <Card className="bg-muted/50">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            const Icon = ALERT_TYPE_ICONS[selectedAlert.alertType]
                                            return (
                                                <div className="p-2 rounded-md bg-brand-500/10">
                                                    <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                                                </div>
                                            )
                                        })()}
                                        <div>
                                            <p className="font-semibold">
                                                {formatSymbol(selectedAlert.symbol)} - {ALERT_TYPE_NAMES[selectedAlert.alertType]}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Threshold: {formatValue(selectedAlert.threshold, selectedAlert.alertType)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Alert'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
