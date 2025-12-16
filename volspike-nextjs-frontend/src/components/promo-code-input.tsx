'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
    const [showInput, setShowInput] = useState(false)

    return (
        <div className="space-y-2">
            {!showInput && (
                <button
                    onClick={() => setShowInput(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    + Add promo code
                </button>
            )}

            {showInput && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="Enter promo code"
                            value={promoCode}
                            onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
                            onBlur={onValidate}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    onValidate()
                                }
                            }}
                            className="flex-1"
                            disabled={loading}
                        />
                        <Button
                            onClick={() => {
                                setShowInput(false)
                                onPromoCodeChange('')
                            }}
                            variant="outline"
                            size="sm"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                    </div>

                    {loading && (
                        <p className="text-sm text-muted-foreground">
                            Validating...
                        </p>
                    )}

                    {error && !loading && (
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    {isValid && !loading && discountPercent && (
                        <p className="text-sm text-green-600 dark:text-green-500">
                            ✓ {discountPercent}% discount applied!
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
