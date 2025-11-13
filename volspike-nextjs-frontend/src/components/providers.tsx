'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'react-hot-toast'
import { Footer } from '@/components/footer'
import { AdBanner } from '@/components/ad-banner'
import { AdPlaceholder } from '@/components/ad-placeholder'
import { TierChangeListener } from '@/components/tier-change-listener'
import { PasswordChangeListener } from '@/components/password-change-listener'

// Dynamic import for Web3 providers to prevent hydration mismatches
const Web3Providers = dynamic(
    () => import('./web3-providers'),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }
)

// Inner component to conditionally render AdBanner (Upgrade to Pro) at top
function ConditionalAdBannerTop() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isAuthPage = pathname?.startsWith('/auth')
    const isPricingPage = pathname === '/pricing'
    const userTier = session?.user?.tier || 'free'
    
    // Don't show on auth pages or pricing page, only show for free tier users
    if (isAuthPage || isPricingPage || userTier !== 'free') {
        return null
    }
    
    return (
        <div className="w-full px-4 py-4 md:py-6 border-b border-border/50">
            <div className="container mx-auto max-w-7xl">
                <AdBanner userTier={userTier} />
            </div>
        </div>
    )
}

// Inner component to conditionally render AdPlaceholder (Advertisement) at bottom
function ConditionalAdPlaceholder() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isAuthPage = pathname?.startsWith('/auth')
    const userTier = session?.user?.tier || 'free'
    
    // Don't show on auth pages, only show for free tier users
    if (isAuthPage || userTier !== 'free') {
        return null
    }
    
    return (
        <div className="w-full px-4 py-4 md:py-6">
            <div className="container mx-auto max-w-7xl">
                <AdPlaceholder variant="horizontal" />
            </div>
        </div>
    )
}

// Inner component to conditionally render Footer based on route
function ConditionalFooter() {
    const pathname = usePathname()
    const isAuthPage = pathname?.startsWith('/auth')
    
    if (isAuthPage) {
        return null
    }
    
    return <Footer />
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute
                gcTime: 5 * 60 * 1000, // 5 minutes
                retry: (failureCount) => failureCount < 3, // Simplified retry logic
            },
        },
    }))

    useEffect(() => setMounted(true), [])

    if (!mounted) {
        // Avoid rendering children before providers (prevents wallet context errors on hard refresh)
        return null
    }

    // Anything that depends on window / localStorage / media queries must only run after mount
    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <TierChangeListener />
                <PasswordChangeListener />
                <Web3Providers>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <div className="flex min-h-screen flex-col bg-background">
                            <ConditionalAdBannerTop />
                            <div className="flex-1 flex flex-col">
                                {children}
                            </div>
                            <ConditionalAdPlaceholder />
                            <ConditionalFooter />
                        </div>
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                duration: 4000,
                                style: {
                                    background: 'hsl(var(--card))',
                                    color: 'hsl(var(--card-foreground))',
                                    border: '1px solid hsl(var(--border))',
                                },
                            }}
                        />
                    </ThemeProvider>
                </Web3Providers>
            </SessionProvider>
        </QueryClientProvider>
    )
}
