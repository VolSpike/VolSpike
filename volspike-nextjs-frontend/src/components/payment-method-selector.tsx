'use client'

import { CreditCard, Coins, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PaymentMethodSelectorProps {
  selectedMethod: 'stripe' | 'crypto'
  onMethodChange: (method: 'stripe' | 'crypto') => void
  className?: string
}

const isCryptoEnabled = process.env.NEXT_PUBLIC_NOWPAYMENTS_ENABLED === 'true'

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  className,
}: PaymentMethodSelectorProps) {
  // Don't render if crypto is disabled
  if (!isCryptoEnabled) {
    return null
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold mb-1">Choose Payment Method</h3>
        <p className="text-sm text-muted-foreground">
          Select your preferred payment option
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <Card
          className={cn(
            'cursor-pointer transition-all duration-300 relative overflow-hidden group',
            selectedMethod === 'stripe'
              ? 'ring-2 ring-brand-500 bg-brand-500/5 shadow-lg scale-[1.02]'
              : 'hover:border-brand-500/50 hover:shadow-md hover:scale-[1.01]'
          )}
          onClick={() => onMethodChange('stripe')}
        >
          {selectedMethod === 'stripe' && (
            <div className="absolute top-3 right-3">
              <div className="h-6 w-6 rounded-full bg-brand-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-3 rounded-xl transition-all duration-300',
                selectedMethod === 'stripe'
                  ? 'bg-brand-500/20 scale-110'
                  : 'bg-brand-500/10 group-hover:bg-brand-500/15'
              )}>
                <CreditCard className={cn(
                  'h-6 w-6 transition-colors',
                  selectedMethod === 'stripe'
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-brand-600/70 dark:text-brand-400/70'
                )} />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-base font-semibold">Credit Card</CardTitle>
                  {selectedMethod === 'stripe' && (
                    <Badge className="bg-brand-500/20 text-brand-700 dark:text-brand-300 border-0 text-xs px-2 py-0.5">
                      Selected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs leading-relaxed">
                  Visa, MasterCard, American Express
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Instant activation • Secure payment
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-all duration-300 relative overflow-hidden group',
            selectedMethod === 'crypto'
              ? 'ring-2 ring-sec-500 bg-sec-500/5 shadow-lg scale-[1.02]'
              : 'hover:border-sec-500/50 hover:shadow-md hover:scale-[1.01]'
          )}
          onClick={() => onMethodChange('crypto')}
        >
          {selectedMethod === 'crypto' && (
            <div className="absolute top-3 right-3">
              <div className="h-6 w-6 rounded-full bg-sec-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-3 rounded-xl transition-all duration-300',
                selectedMethod === 'crypto'
                  ? 'bg-sec-500/20 scale-110'
                  : 'bg-sec-500/10 group-hover:bg-sec-500/15'
              )}>
                <Coins className={cn(
                  'h-6 w-6 transition-colors',
                  selectedMethod === 'crypto'
                    ? 'text-sec-600 dark:text-sec-400'
                    : 'text-sec-600/70 dark:text-sec-400/70'
                )} />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-base font-semibold">Cryptocurrency</CardTitle>
                  {selectedMethod === 'crypto' && (
                    <Badge className="bg-sec-500/20 text-sec-700 dark:text-sec-300 border-0 text-xs px-2 py-0.5">
                      Selected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs leading-relaxed">
                  USDT (SOL/ETH), USDC, SOL, BTC, ETH
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Instant • Low fees • Manual renewal
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}

