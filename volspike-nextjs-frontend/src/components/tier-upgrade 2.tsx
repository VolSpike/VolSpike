'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Star, Zap } from 'lucide-react'

const tiers = [
    {
        name: 'Free',
        price: '$0',
        description: 'Basic volume tracking',
        features: [
            '15-minute refresh rate',
            'Basic volume alerts',
            'Limited symbols',
        ],
        current: true,
    },
    {
        name: 'Pro',
        price: '$9',
        description: 'Enhanced trading insights',
        features: [
            '5-minute refresh rate',
            'Email alerts',
            'All symbols',
            'Advanced filters',
            'Export data',
        ],
        popular: true,
    },
    {
        name: 'Elite',
        price: '$49',
        description: 'Real-time professional trading',
        features: [
            '30-second refresh rate',
            'SMS + Email alerts',
            'WebSocket real-time',
            'Priority support',
            'Custom alerts',
            'API access',
        ],
    },
]

export function TierUpgrade() {
    const [selectedTier, setSelectedTier] = useState<string | null>(null)

    const handleUpgrade = (tierName: string) => {
        setSelectedTier(tierName)
        // TODO: Implement Stripe checkout
        console.log(`Upgrading to ${tierName}`)
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
                <Card
                    key={tier.name}
                    className={`relative ${tier.popular ? 'ring-2 ring-primary' : ''
                        } ${tier.current ? 'opacity-75' : ''}`}
                >
                    {tier.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground">
                                <Star className="h-3 w-3 mr-1" />
                                Popular
                            </Badge>
                        </div>
                    )}

                    {tier.current && (
                        <div className="absolute -top-3 right-4">
                            <Badge variant="secondary">
                                Current
                            </Badge>
                        </div>
                    )}

                    <CardHeader className="text-center">
                        <CardTitle className="flex items-center justify-center">
                            {tier.name === 'Elite' && <Zap className="h-5 w-5 mr-2 text-yellow-500" />}
                            {tier.name}
                        </CardTitle>
                        <div className="text-3xl font-bold">{tier.price}</div>
                        <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <ul className="space-y-2">
                            {tier.features.map((feature, index) => (
                                <li key={index} className="flex items-center text-sm">
                                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            className="w-full"
                            variant={tier.popular ? 'default' : 'outline'}
                            disabled={tier.current}
                            onClick={() => handleUpgrade(tier.name)}
                        >
                            {tier.current ? 'Current Plan' : `Upgrade to ${tier.name}`}
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
