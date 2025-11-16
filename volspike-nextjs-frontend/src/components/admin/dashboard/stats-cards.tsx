'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Users,
    UserCheck,
    DollarSign,
    UserPlus,
    TrendingUp,
    TrendingDown
} from 'lucide-react'

interface StatsCardsProps {
    stats: {
        totalUsers: number
        activeUsers: number
        totalRevenue: number
        recentSignups: number
        usersByTier: Array<{ tier: string; count: number }>
    }
}

export function StatsCards({ stats }: StatsCardsProps) {
    const cards = [
        {
            title: 'Total Users',
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            change: null,
            changeType: null as any,
            description: 'All registered users',
            // Subtle brand green accent - professional, not overwhelming
            iconBg: 'bg-muted/50',
            iconColor: 'text-brand-600 dark:text-brand-400',
            valueColor: 'text-foreground',
        },
        {
            title: 'Active Users',
            value: stats.activeUsers.toLocaleString(),
            icon: UserCheck,
            change: null,
            changeType: null as any,
            description: 'Users active in last 30 days',
            // Subtle secondary blue accent
            iconBg: 'bg-muted/50',
            iconColor: 'text-sec-600 dark:text-sec-400',
            valueColor: 'text-foreground',
        },
        {
            title: 'Total Revenue',
            value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: DollarSign,
            change: null,
            changeType: null as any,
            description: 'Lifetime revenue',
            // Subtle elite purple accent
            iconBg: 'bg-muted/50',
            iconColor: 'text-elite-600 dark:text-elite-400',
            valueColor: 'text-foreground',
        },
        {
            title: 'Recent Signups',
            value: stats.recentSignups.toString(),
            icon: UserPlus,
            change: null,
            changeType: null as any,
            description: 'New users in last 30 days',
            // Subtle muted accent - less prominent than others
            iconBg: 'bg-muted/50',
            iconColor: 'text-muted-foreground',
            valueColor: 'text-foreground',
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card 
                        key={card.title} 
                        className="group border-border/60 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-border/80 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5"
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground/90">
                                {card.title}
                            </CardTitle>
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
                                <Icon className={`h-4 w-4 ${card.iconColor} transition-colors duration-300`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-bold ${card.valueColor} mb-1.5 tracking-tight`}>
                                {card.value}
                            </div>
                            {card.change && card.changeType && (
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1 mb-2">
                                    {card.changeType === 'positive' ? (
                                        <TrendingUp className="h-3 w-3 text-brand-500" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3 text-danger-500" />
                                    )}
                                    <span className={card.changeType === 'positive' ? 'text-brand-600 dark:text-brand-400' : 'text-danger-600 dark:text-danger-400'}>
                                        {card.change}
                                    </span>
                                    <span>from last month</span>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

// User tier breakdown component
export function UserTierBreakdown({ usersByTier }: { usersByTier: Array<{ tier: string; count: number }> }) {
    const totalUsers = usersByTier.reduce((sum, tier) => sum + tier.count, 0)

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'bg-purple-500'
            case 'pro':
                return 'bg-blue-500'
            default:
                return 'bg-gray-500'
        }
    }

    const getTierLabel = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'Elite'
            case 'pro':
                return 'Pro'
            default:
                return 'Free'
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Users by Tier</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {usersByTier.map((tier) => {
                        const percentage = totalUsers > 0 ? (tier.count / totalUsers) * 100 : 0
                        return (
                            <div key={tier.tier} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-3 h-3 rounded-full ${getTierColor(tier.tier)}`} />
                                        <span className="text-sm font-medium">{getTierLabel(tier.tier)}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {tier.count.toLocaleString()} ({percentage.toFixed(1)}%)
                                    </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${getTierColor(tier.tier)}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
