'use client'

import { useState } from 'react'
import { Coins, Check, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SupportedCurrency {
  code: string
  name: string
  network: string
  icon: string
  preferred?: boolean
}

const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  {
    code: 'usdtsol',
    name: 'USDT',
    network: 'Solana',
    icon: '💎',
    preferred: true,
  },
  {
    code: 'usdterc20',
    name: 'USDT',
    network: 'Ethereum',
    icon: '🔷',
  },
  {
    code: 'usdce',
    name: 'USDC',
    network: 'Ethereum',
    icon: '💵',
  },
  {
    code: 'sol',
    name: 'SOL',
    network: 'Solana',
    icon: '⚡',
  },
  {
    code: 'btc',
    name: 'BTC',
    network: 'Bitcoin',
    icon: '₿',
  },
  {
    code: 'eth',
    name: 'ETH',
    network: 'Ethereum',
    icon: 'Ξ',
  },
]

interface CryptoCurrencySelectorProps {
  selectedCurrency: string | null
  onCurrencyChange: (currency: string) => void
  className?: string
}

export function CryptoCurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  className,
}: CryptoCurrencySelectorProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1 flex items-center justify-center gap-2">
          <Coins className="h-5 w-5 text-sec-600 dark:text-sec-400" />
          Select Payment Currency
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred cryptocurrency
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const isSelected = selectedCurrency === currency.code
          return (
            <Card
              key={currency.code}
              className={cn(
                'cursor-pointer transition-all duration-300 relative overflow-hidden group',
                isSelected
                  ? 'ring-2 ring-sec-500 bg-sec-500/5 shadow-lg scale-[1.02]'
                  : 'hover:border-sec-500/50 hover:shadow-md hover:scale-[1.01]',
                currency.preferred && !isSelected && 'border-sec-500/30'
              )}
              onClick={() => onCurrencyChange(currency.code)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'text-2xl flex-shrink-0 transition-transform duration-300',
                      isSelected ? 'scale-110' : 'group-hover:scale-105'
                    )}>
                      {currency.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{currency.name}</span>
                        {currency.preferred && (
                          <Badge className="bg-sec-500/20 text-sec-700 dark:text-sec-300 border border-sec-500/30 text-[10px] px-1.5 py-0 h-4 leading-none">
                            ⭐ Preferred
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {currency.network}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-sec-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-r from-sec-500/10 via-sec-500/5 to-transparent border border-sec-500/20">
        <div className="flex items-start gap-2">
          <div className="p-1 rounded bg-sec-500/20 flex-shrink-0 mt-0.5">
            <Info className="h-3 w-3 text-sec-600 dark:text-sec-400" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-sec-700 dark:text-sec-300">USDT on Solana</span> is recommended for fastest confirmation and lowest fees. All listed currencies are accepted.
          </p>
        </div>
      </div>
    </div>
  )
}

