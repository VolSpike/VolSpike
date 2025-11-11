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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import { Eye, EyeOff } from 'lucide-react'

function SettingsContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const identity = useUserIdentity()
    const [activeTab, setActiveTab] = useState('account')
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

    // Handle tab query parameter
    useEffect(() => {
        if (!isClient) return // Wait for client-side hydration
        
        try {
            const tab = searchParams?.get('tab')
            if (tab === 'subscription') {
                setActiveTab('subscription')
            }
        } catch (error) {
            // Fallback: read from window.location if searchParams fails
            if (typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search)
                    const tab = params.get('tab')
                    if (tab === 'subscription') {
                        setActiveTab('subscription')
                    }
                } catch (fallbackError) {
                    console.warn('Error reading search params:', fallbackError)
                }
            }
        }
    }, [searchParams, isClient])

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
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="account">
                                    <User className="h-4 w-4 mr-2" />
                                    Account
                                </TabsTrigger>
                                <TabsTrigger value="subscription">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Subscription
                                </TabsTrigger>
                                <TabsTrigger value="security">
                                    Security
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

                            <TabsContent value="security" className="space-y-6 mt-6">
                                <div>
                                    <h3 className="text-sm font-medium mb-4">Change Password</h3>
                                    <ChangePasswordForm />
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
            toast.success('Password updated')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: any) {
            toast.error(err?.message || 'Failed to change password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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

