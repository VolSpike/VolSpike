'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, CreditCard, Coins, AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface SubscriptionStatus {
  stripe?: {
    id: string
    status: string
    currentPeriodEnd: number
    paymentMethod: 'stripe'
  } | null
  crypto?: {
    id: string
    status: string
    tier: string
    expiresAt: string
    daysUntilExpiration: number
    paymentMethod: 'crypto'
    payCurrency?: string | null
  } | null
  subscription?: any
}

export function SubscriptionStatus() {
  const { data: session } = useSession()
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription`, {
          credentials: 'include', // Include cookies for session-based auth
        })

        if (response.ok) {
          const data = await response.json()
          setSubscription(data)
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubscription()
  }, [session])

  if (loading) {
    return null
  }

  if (!subscription || (!subscription.stripe && !subscription.crypto)) {
    return null
  }

  const userTier = (session?.user as any)?.tier || 'free'
  const isProOrElite = userTier === 'pro' || userTier === 'elite'

  if (!isProOrElite) {
    return null
  }

  // Show crypto subscription status if exists
  if (subscription.crypto) {
    const { status, expiresAt, daysUntilExpiration, tier, payCurrency } = subscription.crypto
    const expiresDate = new Date(expiresAt)
    const isExpiringSoon = daysUntilExpiration <= 7
    const isExpiringVerySoon = daysUntilExpiration <= 3
    const isExpired = daysUntilExpiration <= 0

    return (
      <Card className={cn(
        'border-2 transition-all duration-300',
        isExpired 
          ? 'border-destructive/50 bg-destructive/5' 
          : isExpiringVerySoon
          ? 'border-orange-500/50 bg-orange-500/5'
          : isExpiringSoon
          ? 'border-yellow-500/50 bg-yellow-500/5'
          : 'border-sec-500/30 bg-sec-500/5'
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className={cn(
                'h-5 w-5',
                isExpired ? 'text-destructive' : isExpiringVerySoon ? 'text-orange-500' : 'text-sec-600 dark:text-sec-400'
              )} />
              <CardTitle className="text-base">Crypto Subscription</CardTitle>
            </div>
            <Badge 
              variant={isExpired ? 'destructive' : isExpiringVerySoon ? 'default' : 'secondary'}
              className={cn(
                isExpiringVerySoon && !isExpired && 'bg-orange-500 text-white'
              )}
            >
              {tier.toUpperCase()}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Paid with {payCurrency?.toUpperCase() || 'cryptocurrency'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isExpired ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive mb-1">
                    Subscription Expired
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your subscription expired on {expiresDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}. Your account has been downgraded to Free tier.
                  </p>
                </div>
              </div>
            </div>
          ) : isExpiringVerySoon ? (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">
                    Expires {daysUntilExpiration === 1 ? 'Tomorrow' : `in ${daysUntilExpiration} Days`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Renew now to continue enjoying {tier.toUpperCase()} tier features.
                  </p>
                </div>
              </div>
            </div>
          ) : isExpiringSoon ? (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
                    Expires in {daysUntilExpiration} Days
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your subscription expires on {expiresDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-sec-500/10 border border-sec-500/20">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-sec-600 dark:text-sec-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-sec-700 dark:text-sec-300 mb-1">
                    Active Subscription
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDistanceToNow(expiresDate, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Expires: {expiresDate.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </span>
          </div>

          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              💡 Crypto subscriptions require manual renewal. Renew anytime to extend your access.
            </p>
            <Button
              onClick={() => router.push(`/pricing?renew=${tier}`)}
              className="w-full"
              variant={isExpired || isExpiringVerySoon ? 'default' : 'outline'}
              size="sm"
            >
              {isExpired ? 'Renew Subscription' : 'Renew Now'}
              <ArrowRight className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show Stripe subscription status if exists
  if (subscription.stripe) {
    const { currentPeriodEnd } = subscription.stripe
    const periodEndDate = new Date(currentPeriodEnd * 1000)
    const daysUntilRenewal = Math.ceil(
      (periodEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    return (
      <Card className="border-sec-500/30 bg-sec-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sec-600 dark:text-sec-400" />
              <CardTitle className="text-base">Stripe Subscription</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-sec-500/20 text-sec-700 dark:text-sec-300">
              AUTO-RENEW
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Automatically renews monthly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-sec-500/10 border border-sec-500/20">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-sec-600 dark:text-sec-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-sec-700 dark:text-sec-300 mb-1">
                  Active & Auto-Renewing
                </p>
                <p className="text-xs text-muted-foreground">
                  Next renewal: {formatDistanceToNow(periodEndDate, { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Renews: {periodEndDate.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

