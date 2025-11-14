'use client'

import { useState } from 'react'
import { Check, Zap, Star, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { startProCheckout } from '@/lib/payments'
import { toast } from 'react-hot-toast'
import { PaymentMethodSelector } from '@/components/payment-method-selector'

interface PricingTiersProps {
  currentTier?: string
}

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for casual traders and getting started',
    icon: Zap,
    iconColor: 'text-gray-500',
    popular: false,
    cta: 'Start Free',
    ctaVariant: 'outline' as const,
    isComingSoon: false,
    features: [
      { text: 'Real-time market data updates', highlight: true },
      { text: 'Top 50 symbols by volume', highlight: false },
      { text: '10 volume spike alerts (15-min batches)', highlight: false },
      { text: 'Live Binance WebSocket connection', highlight: false },
      { text: 'TradingView watchlist export', highlight: false },
      { text: 'Basic volume analytics', highlight: false },
    ],
    limitations: [
      'No Open Interest data',
      'No email/SMS notifications',
      'No CSV/JSON exports',
    ]
  },
  {
    name: 'Pro',
    price: '$9',
    period: 'per month',
    description: 'For active traders who need faster updates',
    icon: Star,
    iconColor: 'text-sec-600 dark:text-sec-400',
    popular: true,
    cta: 'Upgrade to Pro',
    ctaVariant: 'default' as const,
    isComingSoon: false,
    features: [
      { text: 'Real-time market data updates', highlight: true },
      { text: 'Top 100 symbols by volume', highlight: true },
      { text: '50 volume spike alerts (5-min batches)', highlight: true },
      { text: 'Open Interest column visible', highlight: true },
      { text: 'Email notifications', highlight: true },
      { text: 'Subscribe to specific symbols', highlight: true },
      { text: 'CSV & JSON data export', highlight: true },
      { text: 'Manual refresh control', highlight: false },
      { text: 'Ad-free experience', highlight: false },
    ],
    limitations: []
  },
  {
    name: 'Elite',
    price: '$49',
    period: 'per month',
    description: 'Professional-grade tools for serious traders',
    icon: Sparkles,
    iconColor: 'text-elite-600 dark:text-elite-400',
    popular: false,
    cta: 'Coming Soon',
    ctaVariant: 'outline' as const,
    isComingSoon: true,
    features: [
      { text: 'Real-time streaming updates', highlight: true },
      { text: 'ALL active symbols (unlimited)', highlight: true },
      { text: '100 volume spike alerts', highlight: true },
      { text: 'Instant alert delivery (0 delay)', highlight: true },
      { text: 'Email + SMS notifications', highlight: true },
      { text: 'Full API access', highlight: true },
      { text: 'Priority support', highlight: true },
      { text: 'Custom alert conditions', highlight: true },
      { text: 'Advanced analytics', highlight: false },
    ],
    limitations: []
  },
]

export function PricingTiers({ currentTier = 'free' }: PricingTiersProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crypto'>('stripe')
  
  const handleTierAction = async (tierName: string, isComingSoon: boolean, isCurrent: boolean) => {
    if (isComingSoon || isCurrent) return
    
    if (tierName === 'Free') {
      router.push('/auth')
    } else if (tierName === 'Pro' || tierName === 'Elite') {
      const tier = tierName.toLowerCase() as 'pro' | 'elite'
      
      if (paymentMethod === 'crypto') {
        router.push(`/checkout/crypto?tier=${tier}`)
      } else {
        // Existing Stripe flow
        try {
          await startProCheckout(session || null)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to start checkout'
          toast.error(message)
          // Fallback: route to settings subscription section
          router.push('/settings?tab=subscription')
        }
      }
    } else {
      router.push('/dashboard')
    }
  }

  const isCryptoEnabled = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_NOWPAYMENTS_ENABLED === 'true'
    : false

  return (
    <div className="max-w-7xl mx-auto">
      {/* Payment Method Selector - only show for authenticated users and when crypto is enabled */}
      {session && isCryptoEnabled && (
        <div className="mb-16 relative z-10">
          <PaymentMethodSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-0">
      {tiers.map((tier) => {
        const Icon = tier.icon
        const isPopular = tier.popular
        const isCurrent = tier.name.toLowerCase() === currentTier.toLowerCase()
        
        // Determine button text and behavior
        let buttonText = tier.cta
        let buttonDisabled = tier.isComingSoon || isCurrent
        
        if (isCurrent) {
          buttonText = 'Your Current Plan'
        } else if (!tier.isComingSoon) {
          if (tier.name === 'Free') {
            buttonText = 'Get Started Free'
          } else if (tier.name === 'Pro') {
            buttonText = currentTier === 'elite' ? 'Downgrade to Pro' : 'Upgrade to Pro'
          }
        }
        
        // Check if this is a downgrade option
        const isDowngrade = currentTier === 'pro' && tier.name === 'Free'
        
        return (
          <Card
            key={tier.name}
            className={`relative transition-all duration-300 ease-out bg-card ${
              isCurrent 
                ? 'ring-2 ring-brand-500 shadow-lg cursor-default bg-card/100'
                : isDowngrade
                  ? 'ring-1 ring-muted-foreground/30 shadow-md cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:ring-warning-500/50 hover:-translate-y-1 hover:z-20 bg-card/100 hover:bg-card'
                  : isPopular && !isCurrent
                    ? 'ring-2 ring-brand-500 shadow-xl scale-[1.02] md:scale-[1.05] hover:scale-[1.05] md:hover:scale-[1.08] hover:ring-brand-400 hover:shadow-2xl hover:shadow-brand-500/30 z-10 cursor-pointer hover:-translate-y-1 bg-card/100 hover:bg-card'
                    : 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:ring-2 hover:ring-brand-500/50 hover:z-20 hover:-translate-y-1 bg-card/100 hover:bg-card'
            }`}
          >
            <CardHeader className="text-center pb-8 pt-6">
              {/* Badge inside card header - always visible */}
              {isCurrent && (
                <div className="mb-4">
                  <Badge className="bg-gradient-to-r from-brand-600 to-brand-500 text-white border-0 shadow-lg px-4 py-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 fill-white" />
                    Your Current Plan
                  </Badge>
                </div>
              )}
              
              {isDowngrade && (
                <div className="mb-4">
                  <Badge className="bg-warning-500/20 text-warning-700 dark:text-warning-400 border border-warning-500/30 shadow-md px-4 py-1.5">
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5 rotate-180" />
                    Downgrade Option
                  </Badge>
                </div>
              )}
              
              {!isCurrent && !isDowngrade && isPopular && (
                <div className="mb-4">
                  <Badge className="bg-gradient-to-r from-brand-600 to-sec-600 text-white border-0 shadow-lg px-4 py-1.5">
                    <Star className="h-3.5 w-3.5 mr-1.5 fill-white" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {tier.isComingSoon && (
                <div className="mb-4">
                  <Badge className="bg-warning-500/20 text-warning-700 dark:text-warning-400 border border-warning-500/30 shadow-md px-4 py-1.5">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Coming Soon
                  </Badge>
                </div>
              )}
              
              <div className="mx-auto mb-4 p-3 rounded-full bg-muted w-fit">
                <Icon className={`h-8 w-8 ${tier.iconColor}`} />
              </div>
              
              <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
              
              <div className="mb-3">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground ml-2">/{tier.period}</span>
              </div>
              
              <CardDescription className="text-sm">
                {tier.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Features List */}
              <ul className="space-y-3">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className="h-5 w-5 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-brand-600 dark:text-brand-400" />
                      </div>
                    </div>
                    <span className={`text-sm flex-1 ${
                      feature.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    }`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Limitations */}
              {tier.limitations.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Not Included:
                  </p>
                  <ul className="space-y-1">
                    {tier.limitations.map((limitation, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA Button */}
              <Button
                onClick={() => handleTierAction(tier.name, tier.isComingSoon, isCurrent)}
                disabled={buttonDisabled}
                className={`w-full mt-6 font-semibold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-default hover:bg-muted border-2 border-brand-500'
                    : isDowngrade
                      ? 'bg-warning-500/10 text-warning-700 dark:text-warning-400 border-2 border-warning-500/30 hover:bg-warning-500/20 hover:border-warning-500/50'
                      : tier.name === 'Pro' && !isCurrent
                        ? 'bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-brand hover:shadow-brand-lg group relative overflow-hidden'
                        : tier.name === 'Elite' && !tier.isComingSoon
                          ? 'bg-elite-600 hover:bg-elite-700 text-white'
                          : tier.isComingSoon
                            ? 'opacity-50 cursor-not-allowed'
                            : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white shadow-brand hover:shadow-brand-lg group relative overflow-hidden'
                }`}
              >
                {/* Shimmer effect for upgrade buttons (not for downgrade or current) */}
                {tier.name === 'Pro' && !isCurrent && !isDowngrade && (
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
                {tier.name === 'Free' && !isCurrent && !isDowngrade && (
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
                
                <span className="relative z-10 flex items-center justify-center">
                  {isCurrent && <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {buttonText}
                  {!isCurrent && !tier.isComingSoon && !isDowngrade && tier.name !== 'Free' && (
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </span>
              </Button>
            </CardContent>
          </Card>
        )
      })}
      </div>
    </div>
  )
}

