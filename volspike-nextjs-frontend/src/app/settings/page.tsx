'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserIdentity } from '@/hooks/use-user-identity'
import { Copy, ExternalLink, CreditCard, User, Wallet, Shield } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import { Eye, EyeOff } from 'lucide-react'
import { broadcastPasswordChange } from '@/lib/password-change-broadcast'
import { AccountManagement } from '@/components/account-management'

function SettingsContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const identity = useUserIdentity()
    
    // Valid tab values
    const validTabs = ['account', 'wallets', 'subscription', 'security'] as const
    type TabValue = typeof validTabs[number]
    
    // Get initial tab from URL or default to 'account'
    const getInitialTab = (): TabValue => {
        try {
            const tab = searchParams?.get('tab')
            if (tab && validTabs.includes(tab as TabValue)) {
                return tab as TabValue
            }
        } catch (error) {
            // Fallback: read from window.location if searchParams fails
            if (typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search)
                    const tab = params.get('tab')
                    if (tab && validTabs.includes(tab as TabValue)) {
                        return tab as TabValue
                    }
                } catch (e) {
                    // Ignore errors
                }
            }
        }
        return 'account'
    }
    
    const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab)
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
    const [isClient, setIsClient] = useState(false)

    // Ensure we're on the client side
    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth')
        }
    }, [status, router])

    // Sync tab from URL query parameter on mount and when URL changes
    useEffect(() => {
        if (!isClient) return // Wait for client-side hydration
        
        const tab = getInitialTab()
        if (tab !== activeTab) {
            setActiveTab(tab)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, isClient])

    // Update URL when tab changes (using replace to avoid cluttering history)
    const handleTabChange = (value: string) => {
        const newTab = validTabs.includes(value as TabValue) ? (value as TabValue) : 'account'
        setActiveTab(newTab)
        
        // Update URL without adding to history (replace instead of push)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (newTab === 'account') {
                // Remove tab param for default tab to keep URL clean
                params.delete('tab')
            } else {
                params.set('tab', newTab)
            }
            
            const newUrl = params.toString() 
                ? `${window.location.pathname}?${params.toString()}`
                : window.location.pathname
            
            router.replace(newUrl, { scroll: false })
        }
    }
    
    // Handle OAuth linking callback
    useEffect(() => {
        if (searchParams?.get('link') === 'google' && session?.user?.id) {
            // Reload accounts after OAuth linking
            setTimeout(() => {
                router.replace('/settings?tab=wallets', { scroll: false })
            }, 1000)
        }
    }, [searchParams, session, router])

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
            // Dynamic import to ensure client-side only
            const { startProCheckout } = await import('@/lib/payments')
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
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            {/* Mobile: Vertical stacked navigation cards */}
                            <div className="md:hidden space-y-3 mb-6">
                                <button
                                    onClick={() => handleTabChange('account')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 shadow-sm ${
                                        activeTab === 'account'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-green-500/10'
                                            : 'border-gray-200 dark:border-border/50 bg-white dark:bg-muted/30 text-gray-900 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-border hover:bg-gray-50 dark:hover:bg-muted/50 shadow-sm'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                                        activeTab === 'account' 
                                            ? 'bg-green-100 dark:bg-green-500/20' 
                                            : 'bg-gray-100 dark:bg-muted'
                                    }`}>
                                        <User className={`h-5 w-5 ${
                                            activeTab === 'account' 
                                                ? 'text-green-600 dark:text-green-400' 
                                                : 'text-gray-600 dark:text-muted-foreground'
                                        }`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className={`font-semibold text-base ${
                                            activeTab === 'account'
                                                ? 'text-green-900 dark:text-green-300'
                                                : 'text-gray-900 dark:text-foreground'
                                        }`}>Account</div>
                                        <div className={`text-xs mt-0.5 ${
                                            activeTab === 'account'
                                                ? 'text-green-700/80 dark:text-green-400/70'
                                                : 'text-gray-600 dark:text-muted-foreground/80'
                                        }`}>Manage your account details</div>
                                    </div>
                                    {activeTab === 'account' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0"></div>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => handleTabChange('wallets')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 shadow-sm ${
                                        activeTab === 'wallets'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-green-500/10'
                                            : 'border-gray-200 dark:border-border/50 bg-white dark:bg-muted/30 text-gray-900 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-border hover:bg-gray-50 dark:hover:bg-muted/50 shadow-sm'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                                        activeTab === 'wallets' 
                                            ? 'bg-green-100 dark:bg-green-500/20' 
                                            : 'bg-gray-100 dark:bg-muted'
                                    }`}>
                                        <Wallet className={`h-5 w-5 ${
                                            activeTab === 'wallets' 
                                                ? 'text-green-600 dark:text-green-400' 
                                                : 'text-gray-600 dark:text-muted-foreground'
                                        }`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className={`font-semibold text-base ${
                                            activeTab === 'wallets'
                                                ? 'text-green-900 dark:text-green-300'
                                                : 'text-gray-900 dark:text-foreground'
                                        }`}>Wallets</div>
                                        <div className={`text-xs mt-0.5 ${
                                            activeTab === 'wallets'
                                                ? 'text-green-700/80 dark:text-green-400/70'
                                                : 'text-gray-600 dark:text-muted-foreground/80'
                                        }`}>Link authentication methods</div>
                                    </div>
                                    {activeTab === 'wallets' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0"></div>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => handleTabChange('subscription')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 shadow-sm ${
                                        activeTab === 'subscription'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-green-500/10'
                                            : 'border-gray-200 dark:border-border/50 bg-white dark:bg-muted/30 text-gray-900 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-border hover:bg-gray-50 dark:hover:bg-muted/50 shadow-sm'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                                        activeTab === 'subscription' 
                                            ? 'bg-green-100 dark:bg-green-500/20' 
                                            : 'bg-gray-100 dark:bg-muted'
                                    }`}>
                                        <CreditCard className={`h-5 w-5 ${
                                            activeTab === 'subscription' 
                                                ? 'text-green-600 dark:text-green-400' 
                                                : 'text-gray-600 dark:text-muted-foreground'
                                        }`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className={`font-semibold text-base ${
                                            activeTab === 'subscription'
                                                ? 'text-green-900 dark:text-green-300'
                                                : 'text-gray-900 dark:text-foreground'
                                        }`}>Subscription</div>
                                        <div className={`text-xs mt-0.5 ${
                                            activeTab === 'subscription'
                                                ? 'text-green-700/80 dark:text-green-400/70'
                                                : 'text-gray-600 dark:text-muted-foreground/80'
                                        }`}>Manage your plan</div>
                                    </div>
                                    {activeTab === 'subscription' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0"></div>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => handleTabChange('security')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 shadow-sm ${
                                        activeTab === 'security'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-green-500/10'
                                            : 'border-gray-200 dark:border-border/50 bg-white dark:bg-muted/30 text-gray-900 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-border hover:bg-gray-50 dark:hover:bg-muted/50 shadow-sm'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                                        activeTab === 'security' 
                                            ? 'bg-green-100 dark:bg-green-500/20' 
                                            : 'bg-gray-100 dark:bg-muted'
                                    }`}>
                                        <Shield className={`h-5 w-5 ${
                                            activeTab === 'security' 
                                                ? 'text-green-600 dark:text-green-400' 
                                                : 'text-gray-600 dark:text-muted-foreground'
                                        }`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className={`font-semibold text-base ${
                                            activeTab === 'security'
                                                ? 'text-green-900 dark:text-green-300'
                                                : 'text-gray-900 dark:text-foreground'
                                        }`}>Security</div>
                                        <div className={`text-xs mt-0.5 ${
                                            activeTab === 'security'
                                                ? 'text-green-700/80 dark:text-green-400/70'
                                                : 'text-gray-600 dark:text-muted-foreground/80'
                                        }`}>Password and security</div>
                                    </div>
                                    {activeTab === 'security' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0"></div>
                                    )}
                                </button>
                            </div>

                            {/* Desktop: Horizontal tabs */}
                            <TabsList className="hidden md:grid md:grid-cols-4 gap-2 p-1.5 bg-gray-100/50 dark:bg-muted/30 border border-gray-200 dark:border-border/50 rounded-xl">
                                <TabsTrigger 
                                    value="account" 
                                    className="flex items-center justify-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm text-gray-700 dark:text-muted-foreground font-medium"
                                >
                                    <User className="h-4 w-4" />
                                    <span>Account</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="wallets" 
                                    className="flex items-center justify-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm text-gray-700 dark:text-muted-foreground font-medium"
                                >
                                    <Wallet className="h-4 w-4" />
                                    <span>Wallets</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="subscription" 
                                    className="flex items-center justify-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm text-gray-700 dark:text-muted-foreground font-medium"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    <span>Subscription</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="security" 
                                    className="flex items-center justify-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm text-gray-700 dark:text-muted-foreground font-medium"
                                >
                                    <Shield className="h-4 w-4" />
                                    <span>Security</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="account" className="space-y-6 mt-4 md:mt-6">
                                <Card className="border-border/50">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-2">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                            <CardTitle className="text-base">Account Information</CardTitle>
                                        </div>
                                        <CardDescription className="mt-1">
                                            View and manage your account details
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
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
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="wallets" className="space-y-6 mt-4 md:mt-6">
                                <AccountManagement />
                            </TabsContent>

                            <TabsContent value="security" className="space-y-6 mt-4 md:mt-6">
                                <Card className="border-border/50">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-muted-foreground" />
                                            <CardTitle className="text-base">Change Password</CardTitle>
                                        </div>
                                        <CardDescription className="mt-1">
                                            Update your password to keep your account secure
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ChangePasswordForm />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="subscription" className="space-y-6 mt-4 md:mt-6">
                                <Card className="border-border/50">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                                            <CardTitle className="text-base">Subscription & Billing</CardTitle>
                                        </div>
                                        <CardDescription className="mt-1">
                                            Manage your subscription plan and billing information
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
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
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)

    function validatePassword(pw: string): string | null {
        if (pw.length < 12) {
            return 'Password must be at least 12 characters.'
        }
        if (!/[A-Z]/.test(pw)) {
            return 'Password must contain an uppercase letter.'
        }
        if (!/[0-9]/.test(pw)) {
            return 'Password must contain a number.'
        }
        if (!/[^A-Za-z0-9]/.test(pw)) {
            return 'Password must contain a special character.'
        }
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const passwordError = validatePassword(newPassword)
        if (passwordError) {
            toast.error(passwordError)
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        setLoading(true)
        try {
            const token = localStorage.getItem('vs:authToken') || '' // NextAuth passes user id; fallback to empty
            const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/auth/password/change', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to change password')
            
            // Broadcast password change to other tabs/windows
            broadcastPasswordChange()
            
            toast.success('Password updated. You will be signed out of other devices.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            
            // Sign out current session after a short delay to allow broadcast
            setTimeout(() => {
                signOut({ callbackUrl: '/auth' })
            }, 1000)
        } catch (err: any) {
            toast.error(err?.message || 'Failed to change password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="current" className="text-sm text-muted-foreground">
                    Current Password
                </Label>
                <div className="relative">
                    <Input
                        id="current"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        className="bg-background pr-10"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    >
                        {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            <PasswordInput
                id="new"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Create a secure password"
                autoComplete="new-password"
                showStrength={true}
                showRules={true}
                required={true}
            />
            <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                    Confirm New Password
                </Label>
                <div className="relative">
                    <Input
                        id="confirm"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        className={`bg-background pr-10 transition-all ${
                            confirmPassword && newPassword && confirmPassword !== newPassword
                                ? 'border-red-500 focus-visible:ring-red-500'
                                : confirmPassword && newPassword && confirmPassword === newPassword && newPassword.length >= 12
                                    ? 'border-green-500 focus-visible:ring-green-500'
                                    : ''
                        }`}
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        Passwords don&apos;t match
                    </p>
                )}
                {confirmPassword && newPassword && confirmPassword === newPassword && newPassword.length >= 12 && (
                    <p className="text-xs text-green-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        Passwords match
                    </p>
                )}
            </div>
            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
            </Button>
        </form>
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

