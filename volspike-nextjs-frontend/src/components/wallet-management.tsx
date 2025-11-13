'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, X, Copy, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { SiweMessage } from 'siwe'
import { WalletConnectButton } from '@/components/wallet-connect-button'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface WalletAccount {
    id: string
    provider: 'evm' | 'solana'
    address: string
    chainId: string
    caip10: string
    lastLoginAt: string
    createdAt: string
}

export function WalletManagement() {
    const { data: session } = useSession()
    const { address, chainId, isConnected } = useAccount()
    const { signMessageAsync } = useSignMessage()
    const [wallets, setWallets] = useState<WalletAccount[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLinking, setIsLinking] = useState(false)

    useEffect(() => {
        if (session?.user?.id) {
            loadWallets()
        }
    }, [session])

    const loadWallets = async () => {
        try {
            setIsLoading(true)
            const res = await fetch(`${API_URL}/api/auth/wallet/list`, {
                headers: {
                    'Authorization': `Bearer ${session?.user?.id}`,
                },
                credentials: 'include',
            })

            if (res.ok) {
                const data = await res.json()
                setWallets(data.wallets || [])
            }
        } catch (error) {
            console.error('Failed to load wallets:', error)
        } finally {
            setIsLoading(false)
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
            await loadWallets()
        } catch (error: any) {
            console.error('Link wallet error:', error)
            toast.error(error.message || 'Failed to link wallet')
        } finally {
            setIsLinking(false)
        }
    }

    const handleUnlinkWallet = async (wallet: WalletAccount) => {
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
            await loadWallets()
        } catch (error: any) {
            console.error('Unlink wallet error:', error)
            toast.error(error.message || 'Failed to unlink wallet')
        }
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success('Address copied')
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

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Linked Wallets</h3>
                <p className="text-sm text-muted-foreground">
                    Connect and manage your cryptocurrency wallets. Link wallets to enable Web3 authentication and access your account from any device.
                </p>
            </div>

            {/* Connect Wallet Section */}
            {!isConnected ? (
                <Card className="border-2 border-dashed border-border/50 bg-muted/30 hover:border-green-400/50 transition-all duration-200">
                    <CardContent className="pt-6 pb-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="rounded-full bg-muted p-3">
                                <Wallet className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">No Wallet Connected</p>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Connect your wallet to link it to your account and enable Web3 authentication.
                                </p>
                            </div>
                            <WalletConnectButton />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-green-400/40 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-green-500/20 p-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        Wallet Connected
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {formatAddress(address!)} on {getChainName(chainId?.toString() || '1', 'evm')}
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50 border border-border/50">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                                    <code className="text-sm font-mono text-foreground break-all">
                                        {address}
                                    </code>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(address!)}
                                    className="shrink-0"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button
                                onClick={handleLinkWallet}
                                disabled={isLinking}
                                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
                            >
                                {isLinking ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Linking Wallet...
                                    </>
                                ) : (
                                    <>
                                        <Wallet className="h-4 w-4 mr-2" />
                                        Link Wallet to Account
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                Sign a message to securely link this wallet to your account
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Linked Wallets List */}
            {wallets.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Linked Wallets ({wallets.length})</h4>
                    </div>
                    <div className="space-y-3">
                        {wallets.map((wallet) => {
                            const isCurrentWallet = isConnected && wallet.address.toLowerCase() === address?.toLowerCase()
                            return (
                                <Card 
                                    key={wallet.id} 
                                    className={`border-border/50 transition-all duration-200 hover:border-green-400/30 ${
                                        isCurrentWallet ? 'border-green-400/50 bg-green-500/5' : ''
                                    }`}
                                >
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`rounded-full p-2 ${
                                                        wallet.provider === 'evm' 
                                                            ? 'bg-blue-500/10' 
                                                            : 'bg-purple-500/10'
                                                    }`}>
                                                        <Wallet className={`h-4 w-4 ${
                                                            wallet.provider === 'evm' 
                                                                ? 'text-blue-400' 
                                                                : 'text-purple-400'
                                                        }`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-semibold">
                                                                {getChainName(wallet.chainId, wallet.provider)}
                                                            </span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                                {wallet.provider === 'evm' ? 'EVM' : 'Solana'}
                                                            </span>
                                                            {isCurrentWallet && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-400/30">
                                                                    Connected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-11">
                                                    <code className="text-xs font-mono bg-muted/80 px-3 py-1.5 rounded-md border border-border/50 text-foreground">
                                                        {formatAddress(wallet.address)}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCopy(wallet.address)}
                                                        className="h-7 w-7 p-0 hover:bg-muted"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-4 pl-11">
                                                    <p className="text-xs text-muted-foreground">
                                                        Linked {new Date(wallet.createdAt).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    {wallet.lastLoginAt && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Last used {new Date(wallet.lastLoginAt).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleUnlinkWallet(wallet)}
                                                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0"
                                                title="Unlink wallet"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Empty State - Only show if no wallets and wallet is connected */}
            {wallets.length === 0 && isConnected && (
                <Card className="border-border/50">
                    <CardContent className="pt-6 pb-6">
                        <div className="text-center py-6">
                            <div className="rounded-full bg-muted/50 p-4 w-fit mx-auto mb-4">
                                <Wallet className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium mb-1">No wallets linked yet</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Link your connected wallet above to enable Web3 authentication
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

