'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

export interface UserIdentity {
    displayName: string
    email: string | null
    address: string | null
    ens: string | null
    role: 'USER' | 'ADMIN' | null
    tier: 'free' | 'pro' | 'elite' | null
    image: string | null
    isLoading: boolean
}

export function useUserIdentity(): UserIdentity {
    const { data: session, status: sessionStatus } = useSession()

    const isLoading = sessionStatus === 'loading'

    const identity = useMemo(() => {
        const email = session?.user?.email || null
        const walletAddress = session?.user?.walletAddress || null
        const walletProvider = session?.user?.walletProvider || null
        const ens = null // TODO: Add ENS name when wallet address is available

        // Display name policy: if a wallet is connected, prefer short address
        // over generic names (e.g., "Wallet User"). Otherwise show email, then fallback.
        let displayName = 'User'
        if (walletAddress) {
            displayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        } else if (email) {
            displayName = email
        } else if (session?.user?.name) {
            displayName = session.user.name
        }

        return {
            displayName,
            email,
            address: walletAddress,
            ens,
            role: session?.user?.role || null,
            tier: session?.user?.tier || null,
            image: session?.user?.image || null,
            isLoading,
        }
    }, [session, isLoading])

    return identity
}
