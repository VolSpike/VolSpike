'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PasswordInput } from '@/components/password-input'
import { 
    Wallet, 
    Mail, 
    Key, 
    X, 
    Copy, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    Link2,
    Unlink,
    Shield,
    Eye,
    EyeOff
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { SiweMessage } from 'siwe'
import { WalletConnectButton } from '@/components/wallet-connect-button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface LinkedAccounts {
    email: {
        email: string
        hasPassword: boolean
        verified: boolean
    }
    oauth: Array<{
        id: string
        provider: string
        providerAccountId: string
        type: string
    }>
    wallets: Array<{
        id: string
        provider: 'evm' | 'solana'
        address: string
        chainId: string
        caip10: string
        lastLoginAt: string
        createdAt: string
    }>
}

export function AccountManagement() {
    const { data: session } = useSession()
    const { address, chainId, isConnected } = useAccount()
    const { signMessageAsync } = useSignMessage()
    const [accounts, setAccounts] = useState<LinkedAccounts | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLinking, setIsLinking] = useState(false)
    const [linkType, setLinkType] = useState<'email' | 'oauth' | 'wallet' | null>(null)
    
    // Email/password linking state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [emailDialogOpen, setEmailDialogOpen] = useState(false)

    useEffect(() => {
        if (session?.user?.id) {
            loadAccounts()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.id])

    const loadAccounts = async () => {
        try {
            setIsLoading(true)
            const res = await fetch(`${API_URL}/api/auth/accounts/list`, {
                headers: {
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                credentials: 'include',
            })

            if (res.ok) {
                const data = await res.json()
                setAccounts(data)
            }
        } catch (error) {
            console.error('Failed to load accounts:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLinkEmail = async () => {
        if (!email || !password) {
            toast.error('Please fill in all fields')
            return
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        try {
            setIsLinking(true)
            const res = await fetch(`${API_URL}/api/auth/email/link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to link email/password')
            }

            toast.success('Email and password linked successfully!')
            setEmailDialogOpen(false)
            setEmail('')
            setPassword('')
            setConfirmPassword('')
            await loadAccounts()
        } catch (error: any) {
            console.error('Link email error:', error)
            toast.error(error.message || 'Failed to link email/password')
        } finally {
            setIsLinking(false)
        }
    }

    const handleLinkGoogle = async () => {
        try {
            setIsLinking(true)
            // Trigger NextAuth Google sign-in
            await signIn('google', { 
                callbackUrl: '/settings?tab=wallets&link=google',
                redirect: true 
            })
        } catch (error: any) {
            console.error('Link Google error:', error)
            toast.error('Failed to link Google account')
            setIsLinking(false)
        }
    }

    const handleLinkWallet = async () => {
        if (!isConnected || !address || !chainId) {
            toast.error('Please connect your wallet first')
            return
        }

        try {
            setIsLinking(true)

            // Get nonce
            const nonceRes = await fetch(`${API_URL}/api/auth/siwe/nonce`, { credentials: 'include' })
            if (!nonceRes.ok) throw new Error('Failed to get nonce')
            const { nonce } = await nonceRes.json()

            // Get server-prepared SIWE message
            const prepRes = await fetch(`${API_URL}/api/auth/siwe/prepare?address=${address}&chainId=${chainId}&nonce=${nonce}`, { credentials: 'include' })
            if (!prepRes.ok) throw new Error('Failed to prepare message')
            const { message: messageToSign } = await prepRes.json()

            // Sign message
            const signature = await signMessageAsync({ message: messageToSign })

            // Link wallet
            const linkRes = await fetch(`${API_URL}/api/auth/wallet/link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                body: JSON.stringify({
                    message: messageToSign,
                    signature,
                    address,
                    chainId,
                    provider: 'evm',
                }),
                credentials: 'include',
            })

            if (!linkRes.ok) {
                const errorData = await linkRes.json()
                throw new Error(errorData.error || 'Failed to link wallet')
            }

            toast.success('Wallet linked successfully!')
            await loadAccounts()
        } catch (error: any) {
            console.error('Link wallet error:', error)
            toast.error(error.message || 'Failed to link wallet')
        } finally {
            setIsLinking(false)
        }
    }

    const handleUnlinkEmail = async () => {
        if (!confirm('Are you sure you want to remove email/password authentication? You will need another method to sign in.')) {
            return
        }

        // Check if it's the only auth method
        const hasOAuth = accounts?.oauth && accounts.oauth.length > 0
        const hasWallets = accounts?.wallets && accounts.wallets.length > 0

        if (!hasOAuth && !hasWallets) {
            toast.error('Cannot remove. Please link another authentication method first.')
            return
        }

        try {
            // For email/password, we need to clear the password hash
            // This is a special case - we'll need an endpoint for this
            toast.error('Email/password unlinking not yet implemented. Please contact support.')
        } catch (error: any) {
            console.error('Unlink email error:', error)
            toast.error(error.message || 'Failed to unlink email/password')
        }
    }

    const handleUnlinkOAuth = async (provider: string) => {
        if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) {
            return
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/oauth/unlink`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                body: JSON.stringify({ provider }),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to unlink OAuth account')
            }

            toast.success(`${provider} account unlinked successfully`)
            await loadAccounts()
        } catch (error: any) {
            console.error('Unlink OAuth error:', error)
            toast.error(error.message || 'Failed to unlink OAuth account')
        }
    }

    const handleUnlinkWallet = async (wallet: LinkedAccounts['wallets'][0]) => {
        if (!confirm(`Are you sure you want to unlink ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}?`)) {
            return
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/wallet/unlink`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                body: JSON.stringify({
                    address: wallet.address,
                    chainId: wallet.chainId,
                    provider: wallet.provider,
                }),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to unlink wallet')
            }

            toast.success('Wallet unlinked successfully')
            await loadAccounts()
        } catch (error: any) {
            console.error('Unlink wallet error:', error)
            toast.error(error.message || 'Failed to unlink wallet')
        }
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success('Copied')
        } catch (err) {
            toast.error('Failed to copy')
        }
    }

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const getChainName = (chainId: string, provider: string) => {
        if (provider === 'solana') return 'Solana'
        const id = parseInt(chainId)
        const chains: Record<number, string> = {
            1: 'Ethereum',
            137: 'Polygon',
            8453: 'Base',
            10: 'Optimism',
            42161: 'Arbitrum',
        }
        return chains[id] || `Chain ${chainId}`
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-400" />
            </div>
        )
    }

    if (!accounts) {
        return (
            <Card className="border-border/50">
                <CardContent className="pt-6">
                    <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                        <p className="text-sm text-muted-foreground">Failed to load account information</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const hasAnyAuth = accounts.email.hasPassword || accounts.oauth.length > 0 || accounts.wallets.length > 0

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Linked Accounts</h3>
                <p className="text-sm text-muted-foreground">
                    Manage all your authentication methods. Link multiple methods for secure access from any device.
                </p>
            </div>

            {/* Email/Password Section */}
            <Card className="border-border/50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="rounded-full bg-blue-500/10 p-2 flex-shrink-0">
                                <Mail className="h-5 w-5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-base">Email & Password</CardTitle>
                                <CardDescription className="mt-1 break-words">
                                    {accounts.email.email || 'No email set'}
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
                            {accounts.email.hasPassword ? (
                                <>
                                    <Badge variant="outline" className="text-green-400 border-green-400/30">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Active
                                    </Badge>
                                    {hasAnyAuth && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleUnlinkEmail}
                                            className="text-muted-foreground hover:text-red-400"
                                        >
                                            <Unlink className="h-4 w-4" />
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="border-green-400/50 text-green-400 hover:bg-green-500/10 whitespace-nowrap">
                                            <Link2 className="h-4 w-4 mr-2" />
                                            Link Email
                                        </Button>
                                    </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Link Email & Password</DialogTitle>
                                        <DialogDescription>
                                            Add email and password authentication to your account
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="link-email">Email Address</Label>
                                            <Input
                                                id="link-email"
                                                type="email"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="link-password">Password</Label>
                                            <PasswordInput
                                                id="link-password"
                                                label="Password"
                                                value={password}
                                                onChange={(value) => setPassword(value)}
                                                placeholder="Create a password"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="link-confirm">Confirm Password</Label>
                                            <PasswordInput
                                                id="link-confirm"
                                                label="Confirm Password"
                                                value={confirmPassword}
                                                onChange={(value) => setConfirmPassword(value)}
                                                placeholder="Confirm password"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleLinkEmail}
                                            disabled={isLinking}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            {isLinking ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Linking...
                                                </>
                                            ) : (
                                                <>
                                                    <Link2 className="h-4 w-4 mr-2" />
                                                    Link Email & Password
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* OAuth Section */}
            <Card className="border-border/50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-red-500/10 p-2">
                                <Shield className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Social Accounts</CardTitle>
                                <CardDescription className="mt-1">
                                    Link your Google account for quick sign-in
                                </CardDescription>
                            </div>
                        </div>
                        {accounts.oauth.length === 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLinkGoogle}
                                disabled={isLinking}
                                className="border-red-400/50 text-red-400 hover:bg-red-500/10"
                            >
                                {isLinking ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Linking...
                                    </>
                                ) : (
                                    <>
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Link Google
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                    {accounts.oauth.length > 0 ? (
                        <div className="space-y-2">
                            {accounts.oauth.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-red-500/10 p-2">
                                            <Shield className="h-4 w-4 text-red-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium capitalize">{account.provider}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {account.providerAccountId.slice(0, 20)}...
                                            </p>
                                        </div>
                                    </div>
                                    {hasAnyAuth && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleUnlinkOAuth(account.provider)}
                                            className="text-muted-foreground hover:text-red-400"
                                        >
                                            <Unlink className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                            No social accounts linked
                        </div>
                    )}
                </CardHeader>
            </Card>

            {/* Wallets Section */}
            <Card className="border-border/50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-purple-500/10 p-2">
                                <Wallet className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Crypto Wallets</CardTitle>
                                <CardDescription className="mt-1">
                                    Link wallets for Web3 authentication
                                </CardDescription>
                            </div>
                        </div>
                    </div>

                    {/* Connect Wallet Section */}
                    {!isConnected ? (
                        <Card className="border-2 border-dashed border-border/50 bg-muted/20 hover:border-green-400/50 transition-all duration-200 mb-4">
                            <CardContent className="pt-4 pb-4">
                                <div className="flex flex-col items-center text-center space-y-3">
                                    <div className="rounded-full bg-muted p-2">
                                        <Wallet className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">No Wallet Connected</p>
                                        <p className="text-xs text-muted-foreground">
                                            Connect your wallet to link it to your account
                                        </p>
                                    </div>
                                    <WalletConnectButton />
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-green-400/40 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent mb-4">
                            <CardContent className="pt-4 pb-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-green-500/20 p-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Wallet Connected</p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {formatAddress(address!)} on {getChainName(chainId?.toString() || '1', 'evm')}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleLinkWallet}
                                            disabled={isLinking}
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            {isLinking ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    Linking...
                                                </>
                                            ) : (
                                                <>
                                                    <Link2 className="h-3 w-3 mr-1" />
                                                    Link
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Linked Wallets List */}
                    {accounts.wallets.length > 0 ? (
                        <div className="space-y-2 mt-4">
                            {accounts.wallets.map((wallet) => {
                                const isCurrentWallet = isConnected && wallet.address.toLowerCase() === address?.toLowerCase()
                                return (
                                    <div
                                        key={wallet.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                            isCurrentWallet
                                                ? 'border-green-400/50 bg-green-500/5'
                                                : 'border-border/50 bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`rounded-full p-1.5 ${
                                                wallet.provider === 'evm' 
                                                    ? 'bg-blue-500/10' 
                                                    : 'bg-purple-500/10'
                                            }`}>
                                                <Wallet className={`h-3.5 w-3.5 ${
                                                    wallet.provider === 'evm' 
                                                        ? 'text-blue-400' 
                                                        : 'text-purple-400'
                                                }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium">
                                                        {getChainName(wallet.chainId, wallet.provider)}
                                                    </span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                        {wallet.provider === 'evm' ? 'EVM' : 'Solana'}
                                                    </span>
                                                    {isCurrentWallet && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-400/30">
                                                            Connected
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/50">
                                                        {formatAddress(wallet.address)}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCopy(wallet.address)}
                                                        className="h-5 w-5 p-0"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        {hasAnyAuth && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleUnlinkWallet(wallet)}
                                                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0 ml-2"
                                            >
                                                <Unlink className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                            No wallets linked yet
                        </div>
                    )}
                </CardHeader>
            </Card>

            {/* Security Notice */}
            <Card className="border-blue-400/30 bg-blue-500/5">
                <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium mb-1">Security Best Practices</p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                <li>Link multiple authentication methods for better account recovery</li>
                                <li>Keep your passwords strong and unique</li>
                                <li>Never share your wallet private keys</li>
                                <li>Enable 2FA when available</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

