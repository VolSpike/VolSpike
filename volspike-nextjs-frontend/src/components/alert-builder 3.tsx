'use client'

import { useState } from 'react'
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
    Volume2, 
    Zap,
    Send,
    Sparkles,
    Info,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AlertBuilderProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    symbol?: string
    userTier?: 'free' | 'pro' | 'elite'
}

type AlertPreset = 'volume_spike' | 'price_move' | 'funding_cross' | 'custom'

const presets = [
    {
        id: 'volume_spike' as AlertPreset,
        name: 'Volume Spike',
        description: 'Alert when trading volume exceeds a threshold',
        icon: Volume2,
        defaultThreshold: 200, // 200% of average
        defaultUnit: '%'
    },
    {
        id: 'price_move' as AlertPreset,
        name: 'Price Movement',
        description: 'Alert on significant price changes',
        icon: TrendingUp,
        defaultThreshold: 5, // 5%
        defaultUnit: '%'
    },
    {
        id: 'funding_cross' as AlertPreset,
        name: 'Funding Rate Cross',
        description: 'Alert when funding rate crosses a level',
        icon: Zap,
        defaultThreshold: 0.05, // 0.05%
        defaultUnit: '%'
    },
]

export function AlertBuilder({ open, onOpenChange, symbol = '', userTier = 'free' }: AlertBuilderProps) {
    const [selectedPreset, setSelectedPreset] = useState<AlertPreset>('volume_spike')
    const [alertSymbol, setAlertSymbol] = useState(symbol)
    const [threshold, setThreshold] = useState('')
    const [deliveryMethod, setDeliveryMethod] = useState<'in_app' | 'email' | 'both'>('in_app')
    const [isTesting, setIsTesting] = useState(false)

    const currentPreset = presets.find(p => p.id === selectedPreset)

    const handlePresetChange = (presetId: AlertPreset) => {
        setSelectedPreset(presetId)
        const preset = presets.find(p => p.id === presetId)
        if (preset) {
            setThreshold(preset.defaultThreshold.toString())
        }
    }

    const handleTest = async () => {
        setIsTesting(true)
        try {
            // TODO: Implement test alert
            await new Promise(resolve => setTimeout(resolve, 1000))
            toast.success('Test alert sent! Check your notifications.')
        } catch (error) {
            toast.error('Failed to send test alert')
        } finally {
            setIsTesting(false)
        }
    }

    const handleCreate = async () => {
        if (!alertSymbol || !threshold) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            // TODO: Implement alert creation API call
            console.log('Creating alert:', {
                symbol: alertSymbol,
                preset: selectedPreset,
                threshold,
                delivery: deliveryMethod
            })
            toast.success(`Alert created for ${alertSymbol}!`)
            onOpenChange(false)
        } catch (error) {
            toast.error('Failed to create alert')
        }
    }

    // Email alerts are Pro/Elite only
    const canUseEmail = userTier === 'pro' || userTier === 'elite'

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/50 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-h2">
                        <Bell className="h-5 w-5 text-brand-500" />
                        Create Alert
                    </SheetTitle>
                    <SheetDescription>
                        Set up a custom volume spike or price alert
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 py-6">
                    {/* Preset Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Alert Type</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {presets.map((preset) => {
                                const Icon = preset.icon
                                const isSelected = selectedPreset === preset.id
                                return (
                                    <button
                                        key={preset.id}
                                        onClick={() => handlePresetChange(preset.id)}
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
                                                    {preset.name}
                                                    {isSelected && (
                                                        <Badge variant="outline" className="text-[10px] border-brand-500/50 text-brand-600 dark:text-brand-400">
                                                            Selected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {preset.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Symbol Input */}
                    <div className="space-y-2">
                        <Label htmlFor="alert-symbol" className="text-sm font-semibold">
                            Trading Symbol
                        </Label>
                        <Input
                            id="alert-symbol"
                            type="text"
                            placeholder="BTC, ETH, SOL..."
                            value={alertSymbol}
                            onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                            className="font-mono"
                        />
                    </div>

                    {/* Threshold Input */}
                    <div className="space-y-2">
                        <Label htmlFor="alert-threshold" className="text-sm font-semibold">
                            Threshold {currentPreset && `(${currentPreset.defaultUnit})`}
                        </Label>
                        <Input
                            id="alert-threshold"
                            type="number"
                            placeholder={currentPreset?.defaultThreshold.toString()}
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            className="font-mono-tabular"
                        />
                        {currentPreset && (
                            <p className="text-xs text-muted-foreground">
                                Default: {currentPreset.defaultThreshold}{currentPreset.defaultUnit}
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
                                <SelectItem value="in_app">
                                    In-App Only
                                </SelectItem>
                                <SelectItem value="email" disabled={!canUseEmail}>
                                    <span className="flex items-center gap-2">
                                        Email Only
                                        {!canUseEmail && (
                                            <Badge variant="outline" className="text-[10px] ml-auto">
                                                Pro+
                                            </Badge>
                                        )}
                                    </span>
                                </SelectItem>
                                <SelectItem value="both" disabled={!canUseEmail}>
                                    <span className="flex items-center gap-2">
                                        In-App + Email
                                        {!canUseEmail && (
                                            <Badge variant="outline" className="text-[10px] ml-auto">
                                                Pro+
                                            </Badge>
                                        )}
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {!canUseEmail && (deliveryMethod === 'email' || deliveryMethod === 'both') && (
                            <div className="flex items-start gap-2 p-2 bg-sec-500/10 rounded-md border border-sec-500/30 text-xs text-muted-foreground">
                                <Info className="h-3 w-3 flex-shrink-0 mt-0.5 text-sec-600 dark:text-sec-400" />
                                <p>
                                    Email alerts require Pro or Elite tier. 
                                    <button className="underline ml-1 text-sec-600 dark:text-sec-400 font-medium">
                                        Upgrade now
                                    </button>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Test Button */}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleTest}
                        disabled={isTesting || !alertSymbol}
                    >
                        {isTesting ? (
                            <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Sending test...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Test Alert
                            </>
                        )}
                    </Button>

                    {/* Info Note */}
                    <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border border-border/30 text-xs text-muted-foreground">
                        <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand-500" />
                        <div>
                            <p className="font-medium text-foreground mb-1">How it works</p>
                            <p>
                                When the {currentPreset?.name.toLowerCase()} condition is met, you&apos;ll receive a notification
                                via your selected delivery method. Alerts are checked in real-time for Elite tier,
                                every 5 minutes for Pro, and every 15 minutes for Free tier.
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
                        disabled={!alertSymbol || !threshold}
                        className="bg-brand-600 hover:bg-brand-700 text-white"
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        Create Alert
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

