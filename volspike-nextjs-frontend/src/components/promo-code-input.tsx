'use client'

import { Input } from '@/components/ui/input'
import { Tag, Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromoCodeInputProps {
    promoCode: string
    onPromoCodeChange: (code: string) => void
    onValidate: () => void
    error?: string
    loading?: boolean
    isValid?: boolean
    discountPercent?: number
}

export function PromoCodeInput({
    promoCode,
    onPromoCodeChange,
    onValidate,
    error,
    loading,
    isValid,
    discountPercent,
}: PromoCodeInputProps) {
    return (
        <div className="p-4 rounded-lg border-2 border-dashed border-sec-600/30 dark:border-sec-400/30 bg-gradient-to-br from-sec-50/50 to-transparent dark:from-sec-950/30 dark:to-transparent space-y-3">
            {/* Header with icon and value prop */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sec-600 dark:text-sec-400">
                    <Tag className="h-4 w-4" />
                    <span className="text-sm font-semibold">Have a promo code?</span>
                </div>
                {!isValid && !loading && !error && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>Save on your subscription</span>
                    </div>
                )}
            </div>

            {/* Input field */}
            <div className="relative">
                <Input
                    type="text"
                    placeholder="ENTER CODE"
                    value={promoCode}
                    onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
                    onBlur={onValidate}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            onValidate()
                        }
                    }}
                    className={cn(
                        'pr-10 font-mono tracking-wider uppercase text-center transition-all',
                        isValid && 'border-green-500 bg-green-50 dark:bg-green-950/20',
                        error && 'border-destructive bg-destructive/5'
                    )}
                    disabled={loading}
                />
                {/* Status icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {loading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {isValid && !loading && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                    )}
                    {error && !loading && (
                        <XCircle className="h-4 w-4 text-destructive" />
                    )}
                </div>
            </div>

            {/* Status messages */}
            {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Validating your code...</span>
                </div>
            )}

            {error && !loading && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {isValid && !loading && discountPercent && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                            Code applied successfully!
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500">
                            You&apos;re saving {discountPercent}% on your subscription
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
