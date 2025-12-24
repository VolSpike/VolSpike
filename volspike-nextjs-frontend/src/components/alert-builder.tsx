'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Bell,
    TrendingUp,
    Zap,
    Sparkles,
    Info,
    BarChart3,
    Pencil,
    Trash2,
    Check,
    X,
    RotateCcw,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useUserAlerts } from '@/hooks/use-user-alerts'

interface AlertBuilderProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    symbol?: string
    seedPrice?: number
    userTier?: 'free' | 'pro' | 'elite'
}

type AlertType = 'PRICE_CROSS' | 'FUNDING_CROSS' | 'OI_CROSS'

const alertTypes = [
    {
        id: 'PRICE_CROSS' as AlertType,
        name: 'Price Cross',
        description: 'Alert when price crosses a specific value',
        icon: TrendingUp,
        defaultValue: 50000,
        unit: '$',
        placeholder: '50000',
        requiresPro: false,
    },
    {
        id: 'FUNDING_CROSS' as AlertType,
        name: 'Funding Rate Cross',
        description: 'Alert when funding rate crosses a level',
        icon: Zap,
        defaultValue: 0.05,
        unit: '%',
        placeholder: '0.05',
        requiresPro: false,
    },
    {
        id: 'OI_CROSS' as AlertType,
        name: 'Open Interest Cross',
        description: 'Alert when open interest crosses a value',
        icon: BarChart3,
        defaultValue: 1000000000,
        unit: '$',
        placeholder: '1000000000',
        requiresPro: true,
    },
]

export function AlertBuilder({ open, onOpenChange, symbol = '', seedPrice, userTier = 'free' }: AlertBuilderProps) {
    const { data: session } = useSession()
    const {
        createAlertAsync,
        isCreating,
        getAlertsForSymbol,
        isLoading: isAlertsLoading,
        updateAlertAsync,
        deleteAlertAsync,
        reactivateAlertAsync,
        isUpdating,
        isDeleting,
        isReactivating,
    } = useUserAlerts()
    const [selectedType, setSelectedType] = useState<AlertType>('PRICE_CROSS')
    const [alertValue, setAlertValue] = useState('')
    const [displayValue, setDisplayValue] = useState('') // Formatted display value
    const [deliveryMethod, setDeliveryMethod] = useState<'DASHBOARD' | 'EMAIL' | 'BOTH'>('DASHBOARD')
    const [editingAlertId, setEditingAlertId] = useState<string | null>(null)
    const [editingAlertType, setEditingAlertType] = useState<AlertType | null>(null)
    const [editValue, setEditValue] = useState('')
    const [editDisplayValue, setEditDisplayValue] = useState('')
    const [editDeliveryMethod, setEditDeliveryMethod] = useState<'DASHBOARD' | 'EMAIL' | 'BOTH'>('DASHBOARD')
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const currentType = alertTypes.find(t => t.id === selectedType)
    const alertTypeMap = useMemo(() => {
        const map = new Map<AlertType, typeof alertTypes[number]>()
        alertTypes.forEach((type) => map.set(type.id, type))
        return map
    }, [])

    // Format number with thousand separators
    const formatNumberWithCommas = (value: string): string => {
        // Remove all non-digit and non-decimal characters
        const cleaned = value.replace(/[^\d.]/g, '')

        // Split into integer and decimal parts
        const parts = cleaned.split('.')
        const integerPart = parts[0]
        const decimalPart = parts[1]

        // Add thousand separators to integer part
        const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

        // Return with decimal part if it exists
        return decimalPart !== undefined ? `${formatted}.${decimalPart}` : formatted
    }

    // Remove formatting to get raw number
    const unformatNumber = (value: string): string => {
        return value.replace(/,/g, '')
    }

    // Reset form when opened with new symbol
    useEffect(() => {
        if (open) {
            setSelectedType('PRICE_CROSS')
            setAlertValue('')
            setDisplayValue('')
            setDeliveryMethod('DASHBOARD')
            setEditingAlertId(null)
            setEditingAlertType(null)
            setEditValue('')
            setEditDisplayValue('')
            setEditDeliveryMethod('DASHBOARD')
            setConfirmDeleteId(null)
        }
    }, [open, symbol])

    const handleTypeChange = (typeId: AlertType) => {
        setSelectedType(typeId)
        setAlertValue('')
        setDisplayValue('')
    }

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value
        const unformatted = unformatNumber(input)

        // For funding rate, don't format (it's a small percentage)
        if (selectedType === 'FUNDING_CROSS') {
            setAlertValue(input)
            setDisplayValue(input)
        } else {
            // For price and OI, format with commas
            setAlertValue(unformatted)
            setDisplayValue(formatNumberWithCommas(input))
        }
    }

    const handleEditValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value
        const unformatted = unformatNumber(input)

        if (editingAlertType === 'FUNDING_CROSS') {
            setEditValue(input)
            setEditDisplayValue(input)
            return
        }

        setEditValue(unformatted)
        setEditDisplayValue(formatNumberWithCommas(input))
    }

    const formatThreshold = (alert: { alertType: AlertType; threshold: number }) => {
        if (alert.alertType === 'FUNDING_CROSS') {
            return `${(alert.threshold * 100).toFixed(4)}%`
        }

        return `$${alert.threshold.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    }

    const formatDelivery = (method: 'DASHBOARD' | 'EMAIL' | 'BOTH') => {
        if (method === 'EMAIL') return 'Email'
        if (method === 'BOTH') return 'Dashboard + Email'
        return 'Dashboard'
    }

    const seedEditValues = (alert: { alertType: AlertType; threshold: number }) => {
        if (alert.alertType === 'FUNDING_CROSS') {
            const percentValue = (alert.threshold * 100).toString()
            return { raw: percentValue, display: percentValue }
        }

        const rawValue = alert.threshold.toString()
        return { raw: rawValue, display: formatNumberWithCommas(rawValue) }
    }

    const startEditing = (alert: { id: string; alertType: AlertType; threshold: number; deliveryMethod: 'DASHBOARD' | 'EMAIL' | 'BOTH' }) => {
        const nextDelivery = canUseEmail || alert.deliveryMethod === 'DASHBOARD'
            ? alert.deliveryMethod
            : 'DASHBOARD'
        const seeded = seedEditValues(alert)

        setEditingAlertId(alert.id)
        setEditingAlertType(alert.alertType)
        setEditValue(seeded.raw)
        setEditDisplayValue(seeded.display)
        setEditDeliveryMethod(nextDelivery)
        setConfirmDeleteId(null)
    }

    const stopEditing = () => {
        setEditingAlertId(null)
        setEditingAlertType(null)
        setEditValue('')
        setEditDisplayValue('')
    }

    const handleUpdateAlert = async (alertId: string) => {
        if (!editValue || !editingAlertType) {
            toast.error('Please enter a valid threshold')
            return
        }

        let threshold = parseFloat(editValue)
        if (Number.isNaN(threshold)) {
            toast.error('Please enter a valid threshold')
            return
        }

        if (editingAlertType === 'FUNDING_CROSS') {
            threshold = threshold / 100
        }

        try {
            await updateAlertAsync({
                alertId,
                data: {
                    threshold,
                    deliveryMethod: editDeliveryMethod,
                },
            })
            toast.success('Alert updated')
            stopEditing()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update alert')
        }
    }

    const handleDeleteAlert = async (alertId: string) => {
        try {
            await deleteAlertAsync(alertId)
            toast.success('Alert deleted')
            if (editingAlertId === alertId) {
                stopEditing()
            }
            setConfirmDeleteId(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete alert')
        }
    }

    const handleReactivateAlert = async (alertId: string) => {
        try {
            await reactivateAlertAsync(alertId)
            toast.success('Alert reactivated')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to reactivate alert')
        }
    }

    const handleCreate = async () => {
        if (!alertValue || !symbol) {
            toast.error('Please fill in all required fields')
            return
        }

        if (!session?.user?.id) {
            toast.error('Please sign in to create alerts')
            return
        }

        try {
            const upperSymbol = symbol.toUpperCase()
            const alertSymbol = upperSymbol.endsWith('USDT') ? upperSymbol : `${upperSymbol}USDT`

            // Convert value based on alert type
            let threshold = parseFloat(alertValue)
            if (selectedType === 'FUNDING_CROSS') {
                // Convert percentage to decimal (0.05% -> 0.0005)
                threshold = threshold / 100
            }

            await createAlertAsync({
                symbol: alertSymbol,
                alertType: selectedType,
                threshold,
                deliveryMethod,
                lastCheckedValue: selectedType === 'PRICE_CROSS' && Number.isFinite(seedPrice ?? NaN)
                    ? seedPrice
                    : undefined,
            })

            // Format the value with proper unit placement
            const formattedValue = currentType?.unit === '$'
                ? `$${alertValue}`
                : `${alertValue}${currentType?.unit}`

            toast.success(
                `Alert created! You'll be notified when ${displaySymbol} ${currentType?.name.toLowerCase()} crosses ${formattedValue}`,
                { duration: 5000 }
            )

            onOpenChange(false)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create alert'
            toast.error(errorMessage)
        }
    }

    // Email alerts are Pro/Elite only
    const canUseEmail = userTier === 'pro' || userTier === 'elite'

    // Format symbol for display (remove USDT suffix)
    const displaySymbol = symbol.replace(/USDT$/i, '')
    const symbolAlerts = useMemo(() => {
        if (!symbol) return []
        return getAlertsForSymbol(symbol)
    }, [getAlertsForSymbol, symbol])
    const activeSymbolAlerts = useMemo(() => symbolAlerts.filter((alert) => alert.isActive), [symbolAlerts])
    const inactiveSymbolAlerts = useMemo(() => symbolAlerts.filter((alert) => !alert.isActive), [symbolAlerts])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/50 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-xl">
                        <Bell className="h-5 w-5 text-brand-500" />
                        Create Alert for {displaySymbol}
                    </SheetTitle>
                    <SheetDescription>
                        Set up a price, funding rate, or open interest alert
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 py-6">
                    {symbol && symbolAlerts.length > 0 && (
                        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-brand-500/8 via-background/80 to-sec-500/10 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold">Alerts for {displaySymbol}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Edit, pause, or delete alert rules without leaving the table.
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {activeSymbolAlerts.length} active
                                </Badge>
                            </div>

                            <div className="mt-4 space-y-3">
                                {isAlertsLoading ? (
                                    <div className="text-xs text-muted-foreground">Loading alerts...</div>
                                ) : symbolAlerts.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border/60 bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                                        No alerts yet. Create one below to get started.
                                    </div>
                                ) : (
                                    <>
                                        {activeSymbolAlerts.map((alert) => {
                                            const meta = alertTypeMap.get(alert.alertType as AlertType)
                                            const Icon = meta?.icon ?? Bell
                                            const isEditing = editingAlertId === alert.id
                                            const isConfirmingDelete = confirmDeleteId === alert.id
                                            const showEmailDowngrade = !canUseEmail && alert.deliveryMethod !== 'DASHBOARD'

                                            return (
                                                <div
                                                    key={alert.id}
                                                    className="rounded-lg border border-border/40 bg-background/70 p-3 transition-shadow duration-150 hover:shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="rounded-md bg-brand-500/10 p-2">
                                                                <Icon className="h-4 w-4 text-brand-500" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold">{meta?.name ?? alert.alertType}</span>
                                                                    <Badge variant="outline" className="text-[10px] border-brand-500/40 text-brand-600 dark:text-brand-400">
                                                                        Active
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Threshold: <span className="font-mono-tabular text-foreground">{formatThreshold(alert)}</span>
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Delivery: <span className="text-foreground">{formatDelivery(alert.deliveryMethod)}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => startEditing(alert)}
                                                                title="Edit alert"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-danger-500 hover:text-danger-500"
                                                                onClick={() => {
                                                                    setConfirmDeleteId(isConfirmingDelete ? null : alert.id)
                                                                    setEditingAlertId(null)
                                                                }}
                                                                title="Delete alert"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {isEditing && (
                                                        <div className="mt-3 rounded-md border border-border/40 bg-muted/30 p-3">
                                                            <div className="grid gap-3">
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-semibold">Threshold</Label>
                                                                    <Input
                                                                        value={editDisplayValue}
                                                                        onChange={handleEditValueChange}
                                                                        className="h-9 font-mono-tabular text-sm"
                                                                        inputMode="decimal"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-semibold">Delivery</Label>
                                                                    <Select
                                                                        value={editDeliveryMethod}
                                                                        onValueChange={(value: any) => setEditDeliveryMethod(value)}
                                                                    >
                                                                        <SelectTrigger className="h-9">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="DASHBOARD">Dashboard Notifications</SelectItem>
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
                                                                    {showEmailDowngrade && (
                                                                        <p className="text-[11px] text-muted-foreground">
                                                                            Email delivery requires Pro. Switching this alert to dashboard notifications.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={stopEditing}
                                                                >
                                                                    <X className="mr-1 h-3.5 w-3.5" />
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-brand-600 text-white hover:bg-brand-700"
                                                                    onClick={() => handleUpdateAlert(alert.id)}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <Check className="mr-1 h-3.5 w-3.5" />
                                                                    {isUpdating ? 'Saving...' : 'Save'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isConfirmingDelete && (
                                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-600 dark:text-danger-400">
                                                            <span>Delete this alert? This cannot be undone.</span>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setConfirmDeleteId(null)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteAlert(alert.id)}
                                                                    disabled={isDeleting}
                                                                >
                                                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {inactiveSymbolAlerts.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                    Inactive Alerts
                                                </p>
                                                <div className="mt-2 space-y-2">
                                                    {inactiveSymbolAlerts.map((alert) => {
                                                        const meta = alertTypeMap.get(alert.alertType as AlertType)
                                                        const Icon = meta?.icon ?? Bell

                                                        return (
                                                            <div
                                                                key={alert.id}
                                                                className="rounded-lg border border-border/40 bg-background/60 p-3"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="rounded-md bg-muted/60 p-2">
                                                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-semibold">{meta?.name ?? alert.alertType}</span>
                                                                                <Badge variant="secondary" className="text-[10px]">
                                                                                    Inactive
                                                                                </Badge>
                                                                            </div>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Threshold: <span className="font-mono-tabular text-foreground">{formatThreshold(alert)}</span>
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleReactivateAlert(alert.id)}
                                                                            disabled={isReactivating}
                                                                        >
                                                                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                                                            {isReactivating ? 'Reactivating...' : 'Reactivate'}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-danger-500 hover:text-danger-500"
                                                                            onClick={() => {
                                                                                setConfirmDeleteId(alert.id)
                                                                                setEditingAlertId(null)
                                                                            }}
                                                                            title="Delete alert"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                {confirmDeleteId === alert.id && (
                                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-600 dark:text-danger-400">
                                                                        <span>Delete this alert? This cannot be undone.</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setConfirmDeleteId(null)}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                onClick={() => handleDeleteAlert(alert.id)}
                                                                                disabled={isDeleting}
                                                                            >
                                                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="mt-3 text-[11px] text-muted-foreground">
                                Need the full list?{' '}
                                <a href="/settings/alerts" className="text-brand-600 dark:text-brand-400 hover:underline">
                                    Manage all alerts
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Alert Type Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Alert Type</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {alertTypes.map((type) => {
                                const Icon = type.icon
                                const isSelected = selectedType === type.id
                                const isLocked = type.requiresPro && userTier === 'free'
                                const canSelect = !isLocked

                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => canSelect && handleTypeChange(type.id)}
                                        disabled={isLocked}
                                        className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left group ${
                                            isLocked
                                                ? 'border-border/30 bg-muted/30 cursor-not-allowed opacity-75'
                                                : isSelected
                                                ? 'border-brand-500 bg-brand-500/5'
                                                : 'border-border/50 hover:border-brand-500/30 hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-md transition-colors ${
                                                isLocked
                                                    ? 'bg-muted/50'
                                                    : isSelected
                                                    ? 'bg-brand-500/20'
                                                    : 'bg-muted group-hover:bg-brand-500/10'
                                            }`}>
                                                <Icon className={`h-5 w-5 ${
                                                    isLocked
                                                        ? 'text-muted-foreground/50'
                                                        : isSelected
                                                        ? 'text-brand-600 dark:text-brand-400'
                                                        : 'text-muted-foreground'
                                                }`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                                                    <span className={isLocked ? 'text-muted-foreground/70' : ''}>
                                                        {type.name}
                                                    </span>
                                                    {isSelected && !isLocked && (
                                                        <Badge variant="outline" className="text-[10px] border-brand-500/50 text-brand-600 dark:text-brand-400">
                                                            Selected
                                                        </Badge>
                                                    )}
                                                    {isLocked && (
                                                        <Badge variant="outline" className="text-[10px] border-sec-500/50 text-sec-600 dark:text-sec-400 bg-sec-500/10">
                                                            Pro+
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className={`text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {type.description}
                                                </p>
                                                {isLocked && (
                                                    <a
                                                        href="/pricing"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-xs text-sec-600 dark:text-sec-400 hover:underline mt-1 inline-block font-medium"
                                                    >
                                                        Upgrade to unlock →
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Value Input */}
                    <div className="space-y-2">
                        <Label htmlFor="alert-value" className="text-sm font-semibold">
                            Value {currentType && `(${currentType.unit})`}
                        </Label>
                        <Input
                            id="alert-value"
                            type="text"
                            inputMode="decimal"
                            placeholder={currentType?.placeholder}
                            value={displayValue}
                            onChange={handleValueChange}
                            onFocus={(e) => e.target.select()}
                            className="font-mono-tabular"
                        />
                        {currentType && (
                            <p className="text-xs text-muted-foreground">
                                Example: {currentType.defaultValue.toLocaleString()}{currentType.unit}
                            </p>
                        )}
                    </div>

                    {/* Delivery Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Delivery Method</Label>
                        <Select
                            value={deliveryMethod}
                            onValueChange={(value: any) => setDeliveryMethod(value)}
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
                        {!canUseEmail && (deliveryMethod === 'EMAIL' || deliveryMethod === 'BOTH') && (
                            <div className="flex items-start gap-2 p-2 bg-sec-500/10 rounded-md border border-sec-500/30 text-xs text-muted-foreground">
                                <Info className="h-3 w-3 flex-shrink-0 mt-0.5 text-sec-600 dark:text-sec-400" />
                                <p>
                                    Email alerts require Pro or Elite tier.
                                    <a href="/checkout" className="underline ml-1 text-sec-600 dark:text-sec-400 font-medium">
                                        Upgrade now
                                    </a>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info Note */}
                    <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border border-border/30 text-xs text-muted-foreground">
                        <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand-500" />
                        <div>
                            <p className="font-medium text-foreground mb-1">How it works</p>
                            <p>
                                When {displaySymbol} {currentType?.name.toLowerCase()} crosses your specified value
                                (from above or below), you&apos;ll receive a notification via your selected delivery method.
                                The alert will be automatically marked as inactive after triggering and can be reactivated
                                from your alerts management page.
                            </p>
                            <p className="mt-2">
                                Alerts are monitored every{' '}
                                {userTier === 'free' ? '5 minutes' : '30 seconds'}.
                                Once triggered, alerts are automatically marked as inactive and can be reactivated from your alerts page.
                            </p>
                        </div>
                    </div>
                </div>

                <SheetFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!alertValue || isCreating}
                        className="bg-brand-600 hover:bg-brand-700 text-white"
                    >
                        {isCreating ? (
                            <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Bell className="mr-2 h-4 w-4" />
                                Create Alert
                            </>
                        )}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
