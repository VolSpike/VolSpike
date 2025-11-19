'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'react-hot-toast'
import { Footer } from '@/components/footer'
import { AdPlaceholder } from '@/components/ad-placeholder'
import { TierChangeListener } from '@/components/tier-change-listener'
import { PasswordChangeListener } from '@/components/password-change-listener'
import { SessionTracker } from '@/components/session-tracker'
import { SessionValidator } from '@/components/session-validator'
import { UserDeletionHandler } from '@/components/user-deletion-handler'
import { AuthDebugPanel } from '@/components/auth-debug-panel'
import { useBuildVersionGuard } from '@/hooks/use-build-version-guard'

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


// Inner component to conditionally render AdPlaceholder (Advertisement) at bottom
function ConditionalAdPlaceholder() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isAuthPage = pathname?.startsWith('/auth')
    const userTier = session?.user?.tier || 'free'
    
    // Show on all pages except auth pages, only show for free tier users
    // Note: Also shows on Pricing page as requested
    if (isAuthPage || userTier !== 'free') {
        return null
    }
    
    return (
        <div className="w-full bg-background border-t border-border/50">
            <div className="container mx-auto px-4 py-4 md:py-6">
                <AdPlaceholder variant="horizontal" />
            </div>
        </div>
    )
}

// Inner component to conditionally render Footer based on route
function ConditionalFooter() {
    const pathname = usePathname()
    const isAuthPage = pathname?.startsWith('/auth')
    const isAdminPage = pathname?.startsWith('/admin')
    
    // Don't show footer on auth pages or admin pages
    // Admin panels are internal tools and don't need marketing footers
    if (isAuthPage || isAdminPage) {
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

    // Reload long-lived tabs when a new build is deployed so they always
    // run the latest auth/deletion/session logic.
    useBuildVersionGuard()

    useEffect(() => setMounted(true), [])

    if (!mounted) {
        // Avoid rendering children before providers (prevents wallet context errors on hard refresh)
        return null
    }

    // Anything that depends on window / localStorage / media queries must only run after mount
    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <SessionValidator />
                <SessionTracker />
                <TierChangeListener />
                <PasswordChangeListener />
                <UserDeletionHandler />
                <Web3Providers>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="dark"  
                        enableSystem
                        disableTransitionOnChange
                    >
                        <div className="flex min-h-screen flex-col bg-background">
                            <div className="flex-1 flex flex-col">
                                {children}
                            </div>
                            <AuthDebugPanel />
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
