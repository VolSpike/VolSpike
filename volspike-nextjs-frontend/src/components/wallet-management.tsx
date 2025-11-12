'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, X, Copy, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { SiweMessage } from 'siwe'

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
                <h3 className="text-sm font-medium mb-2">Linked Wallets</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Manage your connected cryptocurrency wallets. Link wallets to access your account with Web3 authentication.
                </p>
            </div>

            {/* Link New Wallet */}
            {isConnected && address && (
                <Card className="border-green-400/30 bg-green-500/5">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-green-400" />
                            Connect Wallet
                        </CardTitle>
                        <CardDescription>
                            Link your connected wallet ({formatAddress(address)}) to your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleLinkWallet}
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
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Link Wallet
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isConnected && (
                <Card className="border-yellow-400/30 bg-yellow-500/5">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium mb-1">No Wallet Connected</p>
                                <p className="text-sm text-muted-foreground">
                                    Connect your wallet using the button in the header to link it to your account.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Linked Wallets List */}
            {wallets.length > 0 ? (
                <div className="space-y-3">
                    {wallets.map((wallet) => (
                        <Card key={wallet.id} className="border-border/50">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Wallet className="h-4 w-4 text-green-400" />
                                            <span className="text-sm font-medium">
                                                {getChainName(wallet.chainId, wallet.provider)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({wallet.provider === 'evm' ? 'EVM' : 'Solana'})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                                {formatAddress(wallet.address)}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCopy(wallet.address)}
                                                className="h-6 w-6 p-0"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Linked {new Date(wallet.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnlinkWallet(wallet)}
                                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-border/50">
                    <CardContent className="pt-6">
                        <div className="text-center py-8">
                            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <p className="text-sm text-muted-foreground">
                                No wallets linked yet. Connect your wallet above to get started.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

