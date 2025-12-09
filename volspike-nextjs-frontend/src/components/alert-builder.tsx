'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AlertBuilderProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    symbol?: string
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
        placeholder: '50000'
    },
    {
        id: 'FUNDING_CROSS' as AlertType,
        name: 'Funding Rate Cross',
        description: 'Alert when funding rate crosses a level',
        icon: Zap,
        defaultValue: 0.05,
        unit: '%',
        placeholder: '0.05'
    },
    {
        id: 'OI_CROSS' as AlertType,
        name: 'Open Interest Cross',
        description: 'Alert when open interest crosses a value',
        icon: BarChart3,
        defaultValue: 1000000000,
        unit: '$',
        placeholder: '1000000000'
    },
]

export function AlertBuilder({ open, onOpenChange, symbol = '', userTier = 'free' }: AlertBuilderProps) {
    const { data: session } = useSession()
    const [selectedType, setSelectedType] = useState<AlertType>('PRICE_CROSS')
    const [alertValue, setAlertValue] = useState('')
    const [deliveryMethod, setDeliveryMethod] = useState<'DASHBOARD' | 'EMAIL' | 'BOTH'>('DASHBOARD')
    const [isCreating, setIsCreating] = useState(false)

    const currentType = alertTypes.find(t => t.id === selectedType)

    // Reset form when opened with new symbol
    useEffect(() => {
        if (open) {
            setSelectedType('PRICE_CROSS')
            setAlertValue('')
            setDeliveryMethod('DASHBOARD')
        }
    }, [open, symbol])

    const handleTypeChange = (typeId: AlertType) => {
        setSelectedType(typeId)
        setAlertValue('') // Clear value when type changes
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

        setIsCreating(true)
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session.user.id

            // Convert value based on alert type
            let threshold = parseFloat(alertValue)
            if (selectedType === 'FUNDING_CROSS') {
                // Convert percentage to decimal (0.05% -> 0.0005)
                threshold = threshold / 100
            }

            const response = await fetch(`${API_URL}/api/user-alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    symbol: symbol.toUpperCase(),
                    alertType: selectedType,
                    threshold,
                    deliveryMethod,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create alert')
            }

            const alert = await response.json()

            toast.success(
                `Alert created! You'll be notified when ${symbol} ${currentType?.name.toLowerCase()} crosses ${alertValue}${currentType?.unit}`,
                { duration: 5000 }
            )

            onOpenChange(false)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create alert'
            toast.error(errorMessage)
        } finally {
            setIsCreating(false)
        }
    }

    // Email alerts are Pro/Elite only
    const canUseEmail = userTier === 'pro' || userTier === 'elite'

    // Format symbol for display (remove USDT suffix)
    const displaySymbol = symbol.replace(/USDT$/i, '')

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
                    {/* Alert Type Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Alert Type</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {alertTypes.map((type) => {
                                const Icon = type.icon
                                const isSelected = selectedType === type.id
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => handleTypeChange(type.id)}
                                        className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left group ${
                                            isSelected
                                                ? 'border-brand-500 bg-brand-500/5'
                                                : 'border-border/50 hover:border-brand-500/30 hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-md transition-colors ${
                                                isSelected
                                                    ? 'bg-brand-500/20'
                                                    : 'bg-muted group-hover:bg-brand-500/10'
                                            }`}>
                                                <Icon className={`h-5 w-5 ${
                                                    isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'
                                                }`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                                                    {type.name}
                                                    {isSelected && (
                                                        <Badge variant="outline" className="text-[10px] border-brand-500/50 text-brand-600 dark:text-brand-400">
                                                            Selected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {type.description}
                                                </p>
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
                            type="number"
                            step={selectedType === 'FUNDING_CROSS' ? '0.001' : '1'}
                            placeholder={currentType?.placeholder}
                            value={alertValue}
                            onChange={(e) => setAlertValue(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="font-mono-tabular [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                Alerts are checked every 15 minutes for Free tier, every 5 minutes for Pro,
                                and in real-time for Elite tier.
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
