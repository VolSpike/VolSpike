'use client'

import { Check, Zap, Star, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      { text: '15-minute market data updates', highlight: false },
      { text: 'Top 50 symbols by volume', highlight: false },
      { text: '10 volume spike alerts', highlight: false },
      { text: 'Real-time Binance WebSocket', highlight: false },
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
      { text: '5-minute market data updates', highlight: true },
      { text: 'Top 100 symbols by volume', highlight: true },
      { text: '50 volume spike alerts', highlight: true },
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

export function PricingTiers() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
      {tiers.map((tier) => {
        const Icon = tier.icon
        const isPopular = tier.popular
        
        return (
          <Card
            key={tier.name}
            className={`relative transition-all duration-200 ${
              isPopular
                ? 'ring-2 ring-brand-500 shadow-xl scale-105 md:scale-110 z-10'
                : 'hover:shadow-lg'
            }`}
          >
            <CardHeader className="text-center pb-8 pt-6">
              {/* Badge inside card header - always visible */}
              {isPopular && (
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
                variant={tier.ctaVariant}
                disabled={tier.isComingSoon}
                className={`w-full mt-6 ${
                  tier.name === 'Pro'
                    ? 'bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-lg'
                    : tier.name === 'Elite' && !tier.isComingSoon
                      ? 'bg-elite-600 hover:bg-elite-700 text-white'
                      : tier.isComingSoon
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                }`}
                asChild={!tier.isComingSoon}
              >
                {tier.isComingSoon ? (
                  <span>{tier.cta}</span>
                ) : (
                  <a href={tier.name === 'Free' ? '/auth' : '/settings'}>
                    {tier.cta}
                  </a>
                )}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

