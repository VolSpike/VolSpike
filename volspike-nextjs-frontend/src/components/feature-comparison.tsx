'use client'

import { Check, X, Zap, Star, Sparkles, Clock, Bell, Mail, MessageSquare, Download, BarChart3, Smartphone } from 'lucide-react'

const features = [
  {
    category: 'Market Data Updates',
    icon: Clock,
    items: [
      {
        feature: 'Update Frequency',
        free: 'Every 15 minutes',
        pro: 'Every 5 minutes',
        elite: 'Real-time streaming',
      },
      {
        feature: 'Update Timing',
        free: 'Wall-clock (:00, :15, :30, :45)',
        pro: 'Wall-clock (:00, :05, :10, etc.)',
        elite: 'Continuous',
      },
      {
        feature: 'Symbols Shown',
        free: 'Top 50 by volume',
        pro: 'Top 100 by volume',
        elite: 'All active symbols',
      },
      {
        feature: 'Open Interest Column',
        free: false,
        pro: true,
        elite: true,
      },
      {
        feature: 'Countdown Timer',
        free: true,
        pro: true,
        elite: false,
      },
    ],
  },
  {
    category: 'Volume Spike Alerts',
    icon: Bell,
    items: [
      {
        feature: 'Alert Delivery',
        free: 'Every 15 minutes',
        pro: 'Every 5 minutes',
        elite: 'Instant (0 delay)',
      },
      {
        feature: 'Alert History',
        free: 'Last 10 alerts',
        pro: 'Last 50 alerts',
        elite: 'Last 100 alerts',
      },
      {
        feature: 'Candle Direction Coding',
        free: true,
        pro: true,
        elite: true,
      },
      {
        feature: 'Unread Badge (Mobile)',
        free: true,
        pro: true,
        elite: true,
      },
      {
        feature: 'Manual Refresh',
        free: false,
        pro: true,
        elite: true,
      },
    ],
  },
  {
    category: 'Notifications',
    icon: Mail,
    items: [
      {
        feature: 'In-App Alerts',
        free: true,
        pro: true,
        elite: true,
      },
      {
        feature: 'Email Notifications',
        free: false,
        pro: true,
        elite: true,
      },
      {
        feature: 'SMS Notifications',
        free: false,
        pro: false,
        elite: true,
      },
      {
        feature: 'Symbol Subscriptions',
        free: false,
        pro: true,
        elite: true,
      },
    ],
  },
  {
    category: 'Data Export',
    icon: Download,
    items: [
      {
        feature: 'TradingView Watchlist',
        free: 'Top 50 symbols',
        pro: 'All symbols',
        elite: 'All symbols',
      },
      {
        feature: 'CSV Export',
        free: false,
        pro: true,
        elite: true,
      },
      {
        feature: 'JSON Export',
        free: false,
        pro: true,
        elite: true,
      },
      {
        feature: 'API Access',
        free: false,
        pro: false,
        elite: true,
      },
    ],
  },
  {
    category: 'User Experience',
    icon: Smartphone,
    items: [
      {
        feature: 'Advertisement Banners',
        free: true,
        pro: false,
        elite: false,
      },
      {
        feature: 'Mobile Optimized',
        free: true,
        pro: true,
        elite: true,
      },
      {
        feature: 'Dark/Light Theme',
        free: true,
        pro: true,
        elite: true,
      },
      {
        feature: 'Priority Support',
        free: false,
        pro: false,
        elite: true,
      },
    ],
  },
]

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="flex justify-center">
        <div className="h-5 w-5 rounded-full bg-brand-500/10 flex items-center justify-center">
          <Check className="h-3 w-3 text-brand-600 dark:text-brand-400" />
        </div>
      </div>
    ) : (
      <div className="flex justify-center">
        <X className="h-4 w-4 text-muted-foreground/30" />
      </div>
    )
  }
  
  return (
    <span className="text-sm text-foreground font-medium">
      {value}
    </span>
  )
}

export function FeatureComparison() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header Row */}
        <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-border">
          <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Feature
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10">
              <Zap className="h-4 w-4 text-gray-500" />
              <span className="font-semibold">Free</span>
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sec-500/10">
              <Star className="h-4 w-4 text-sec-600 dark:text-sec-400" />
              <span className="font-semibold">Pro</span>
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elite-500/10">
              <Sparkles className="h-4 w-4 text-elite-600 dark:text-elite-400" />
              <span className="font-semibold">Elite</span>
            </div>
          </div>
        </div>

        {/* Feature Categories */}
        {features.map((category) => {
          const CategoryIcon = category.icon
          return (
            <div key={category.category} className="mb-8">
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-muted/50">
                <CategoryIcon className="h-4 w-4 text-brand-500" />
                <h3 className="font-semibold text-sm">{category.category}</h3>
              </div>

              {/* Feature Rows */}
              <div className="space-y-2">
                {category.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-4 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="text-sm text-muted-foreground">
                      {item.feature}
                    </div>
                    <div className="text-center">
                      <FeatureCell value={item.free} />
                    </div>
                    <div className="text-center">
                      <FeatureCell value={item.pro} />
                    </div>
                    <div className="text-center">
                      <FeatureCell value={item.elite} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

