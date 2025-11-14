'use client'

import { Coins, Check, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export interface SupportedCurrency {
  code: string
  name: string
  network: string
  logoId: string // CoinGecko asset ID for logo
  preferred?: boolean
}

const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  {
    code: 'usdtsol',
    name: 'USDT',
    network: 'Solana',
    logoId: 'tether', // USDT logo (same for all networks)
    preferred: true,
  },
  {
    code: 'usdterc20',
    name: 'USDT',
    network: 'Ethereum',
    logoId: 'tether', // USDT logo
  },
  {
    code: 'usdce',
    name: 'USDC',
    network: 'Ethereum',
    logoId: 'usd-coin', // USDC logo
  },
  {
    code: 'sol',
    name: 'SOL',
    network: 'Solana',
    logoId: 'solana', // Solana logo
  },
  {
    code: 'btc',
    name: 'BTC',
    network: 'Bitcoin',
    logoId: 'bitcoin', // Bitcoin logo
  },
  {
    code: 'eth',
    name: 'ETH',
    network: 'Ethereum',
    logoId: 'ethereum', // Ethereum logo
  },
]

/**
 * Get CoinGecko logo URL for a cryptocurrency
 * CoinGecko provides free, high-quality crypto logos via their CDN
 */
function getCryptoLogoUrl(logoId: string): string {
  // CoinGecko CDN - free, reliable, high-quality logos
  return `https://assets.coingecko.com/coins/images/${getCoinGeckoImageId(logoId)}/large/${logoId}.png`
}

/**
 * Map our logo IDs to CoinGecko image IDs
 * These are the image IDs from CoinGecko's API
 */
function getCoinGeckoImageId(logoId: string): number {
  const imageIdMap: Record<string, number> = {
    'tether': 825, // USDT
    'usd-coin': 6319, // USDC
    'solana': 4128, // SOL
    'bitcoin': 1, // BTC
    'ethereum': 279, // ETH
  }
  return imageIdMap[logoId] || 1
}

/**
 * Crypto logo component with fallback
 */
function CryptoLogo({ 
  logoId, 
  name, 
  isSelected 
}: { 
  logoId: string
  name: string
  isSelected: boolean
}) {
  const [imageError, setImageError] = useState(false)
  const logoUrl = getCryptoLogoUrl(logoId)

  if (imageError) {
    return (
      <div className={cn(
        'h-10 w-10 flex-shrink-0 transition-transform duration-300 rounded-full overflow-hidden ring-1 ring-border/30 shadow-sm bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center',
        isSelected ? 'scale-110 ring-sec-500/50 shadow-md' : 'group-hover:scale-105 group-hover:ring-sec-500/30'
      )}>
        <span className="text-xs font-bold text-muted-foreground">
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(
      'relative h-10 w-10 flex-shrink-0 transition-transform duration-300 rounded-full overflow-hidden ring-1 ring-border/30 shadow-sm bg-muted/20',
      isSelected ? 'scale-110 ring-sec-500/50 shadow-md' : 'group-hover:scale-105 group-hover:ring-sec-500/30'
    )}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="h-full w-full object-cover"
        onError={() => setImageError(true)}
        loading="lazy"
      />
    </div>
  )
}

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
                    <CryptoLogo 
                      logoId={currency.logoId}
                      name={currency.name}
                      isSelected={isSelected}
                    />
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
                      <div className="h-5 w-5 rounded-full bg-sec-500 flex items-center justify-center shadow-sm">
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

