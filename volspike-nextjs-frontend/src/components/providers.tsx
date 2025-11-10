'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'react-hot-toast'
import { Footer } from '@/components/footer'
import { TierChangeListener } from '@/components/tier-change-listener'

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
                <Web3Providers>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <div className="flex min-h-screen flex-col bg-background">
                            <div className="flex-1 flex flex-col">
                                {children}
                            </div>
                            <Footer />
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
