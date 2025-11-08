'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserIdentity } from '@/hooks/use-user-identity'
import { Copy, ExternalLink, CreditCard, User } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { startProCheckout } from '@/lib/payments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function SettingsContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const identity = useUserIdentity()
    const [activeTab, setActiveTab] = useState('account')
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth')
        }
    }, [status, router])

    // Handle tab query parameter
    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab === 'subscription') {
            setActiveTab('subscription')
        }
    }, [searchParams])

    if (status === 'loading' || identity.isLoading) {
        return (
            <div className="flex-1 bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center">Loading...</div>
                </main>
            </div>
        )
    }

    if (!session?.user) {
        return null
    }

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success(`${label} copied`)
        } catch (err) {
            toast.error('Failed to copy')
        }
    }

    const getTierBadgeColor = () => {
        switch (identity.tier) {
            case 'pro': return 'bg-blue-500 text-white'
            case 'elite': return 'bg-amber-500 text-white'
            default: return 'bg-gray-500 text-white'
        }
    }

    const handleUpgrade = async () => {
        if (!session) {
            router.push('/auth')
            return
        }

        setIsLoadingCheckout(true)
        try {
            await startProCheckout(session)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start checkout'
            toast.error(message)
        } finally {
            setIsLoadingCheckout(false)
        }
    }

    return (
        <div className="flex-1 bg-background">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Settings</CardTitle>
                        <CardDescription>Manage your account settings and preferences</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="account">
                                    <User className="h-4 w-4 mr-2" />
                                    Account
                                </TabsTrigger>
                                <TabsTrigger value="subscription">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Subscription
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="account" className="space-y-6 mt-6">
                                <div>
                                    <h3 className="text-sm font-medium mb-4">Account Information</h3>
                                    <div className="space-y-4">
                                        {/* Email */}
                                        {identity.email && (
                                            <div className="flex items-center justify-between py-2 border-b">
                                                <div className="flex-1">
                                                    <p className="text-sm text-muted-foreground">Email</p>
                                                    <p className="text-sm font-medium">{identity.email}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleCopy(identity.email!, 'Email')}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}

                                        {/* Wallet Address */}
                                        {identity.address && (
                                            <div className="flex items-center justify-between py-2 border-b">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-muted-foreground">Wallet Address</p>
                                                    <p className="text-sm font-medium font-mono truncate">
                                                        {identity.ens || identity.address}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleCopy(identity.address!, 'Address')}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}

                                        {/* Role */}
                                        <div className="flex items-center justify-between py-2 border-b">
                                            <div className="flex-1">
                                                <p className="text-sm text-muted-foreground">Role</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant={identity.role === 'ADMIN' ? 'destructive' : 'secondary'}>
                                                        {identity.role || 'USER'}
                                                    </Badge>
                                                    {identity.role === 'ADMIN' && (
                                                        <Link href="/admin">
                                                            <Button variant="link" size="sm" className="h-auto p-0">
                                                                Go to Admin Dashboard
                                                                <ExternalLink className="h-3 w-3 ml-1" />
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tier */}
                                        <div className="flex items-center justify-between py-2">
                                            <div className="flex-1">
                                                <p className="text-sm text-muted-foreground">Subscription Tier</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge className={`text-xs ${getTierBadgeColor()}`}>
                                                        {identity.tier ? identity.tier.charAt(0).toUpperCase() + identity.tier.slice(1) : 'Free'} Tier
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="subscription" className="space-y-6 mt-6">
                                <div>
                                    <h3 className="text-sm font-medium mb-4">Subscription & Billing</h3>
                                    <div className="space-y-4">
                                        {/* Current Tier */}
                                        <div className="flex items-center justify-between py-4 border-b">
                                            <div className="flex-1">
                                                <p className="text-sm text-muted-foreground">Current Plan</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge className={`text-xs ${getTierBadgeColor()}`}>
                                                        {identity.tier ? identity.tier.charAt(0).toUpperCase() + identity.tier.slice(1) : 'Free'} Tier
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Upgrade Button */}
                                        {identity.tier !== 'pro' && identity.tier !== 'elite' && (
                                            <div className="pt-4">
                                                <Button
                                                    onClick={handleUpgrade}
                                                    disabled={isLoadingCheckout}
                                                    className="w-full bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white"
                                                >
                                                    {isLoadingCheckout ? 'Loading...' : 'Upgrade to Pro'}
                                                </Button>
                                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                                    Upgrade to unlock faster updates, more alerts, and premium features
                                                </p>
                                            </div>
                                        )}

                                        {/* View Pricing Link */}
                                        <div className="pt-2">
                                            <Link href="/pricing">
                                                <Button variant="outline" className="w-full">
                                                    View All Plans
                                                    <ExternalLink className="h-4 w-4 ml-2" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex-1 bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center">Loading...</div>
                </main>
            </div>
        }>
            <SettingsContent />
        </Suspense>
    )
}

