'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/header'
import { AdBanner } from '@/components/ad-banner'

interface HeaderWithBannerProps {
    hideWalletConnect?: boolean
}

export function HeaderWithBanner({ hideWalletConnect = false }: HeaderWithBannerProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isPricingPage = pathname === '/pricing'
    const userTier = session?.user?.tier || 'free'
    const showAdBanner = !isPricingPage && userTier === 'free'

    return (
        <>
            <Header hideWalletConnect={hideWalletConnect} />
            {showAdBanner && (
                <div className="w-full border-b border-border/50 bg-background">
                    <div className="container mx-auto px-4 py-4 md:py-6">
                        <AdBanner userTier={userTier} />
                    </div>
                </div>
            )}
        </>
    )
}

