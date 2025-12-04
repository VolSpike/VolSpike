'use client'

import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains'
import { http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

// Configure Wagmi with RainbowKit
const config = getDefaultConfig({
    appName: 'VolSpike',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'abcb0dcbc07f7524c16a4e3df252d18e',
    chains: [mainnet, polygon, optimism, arbitrum, base],
    transports: {
        [mainnet.id]: http(),
        [polygon.id]: http(),
        [optimism.id]: http(),
        [arbitrum.id]: http(),
        [base.id]: http(),
    },
    ssr: true, // Enable server-side rendering support
})

export default function Web3Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                retry: 1,
                staleTime: 5 * 60 * 1000, // 5 minutes
            },
        },
    }))

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#10b981', // Green-500 to match VolSpike branding
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                    })}
                    modalSize="compact"
                    showRecentTransactions={true}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
