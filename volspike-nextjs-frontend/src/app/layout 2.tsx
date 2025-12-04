export const dynamic = 'force-dynamic'
export const revalidate = 0
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import Providers from '@/components/providers'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AnalyticsProvider } from '@/components/analytics-provider'
import { RateLimitNotification } from '@/components/rate-limit-notification'

const inter = Inter({ subsets: ['latin'] })

// IMPORTANT: do NOT add "use client" here.
// Make sure the <html> has suppressHydrationWarning to absorb theme swaps.

export const metadata: Metadata = {
    title: 'VolSpike - Binance Perps Guru Dashboard',
    description: 'Real-time volume spike alerts for Binance perpetual futures trading',
    keywords: ['crypto', 'trading', 'binance', 'perpetual futures', 'volume spikes', 'alerts'],
    authors: [{ name: 'VolSpike Team' }],
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: 'white' },
        { media: '(prefers-color-scheme: dark)', color: 'black' },
    ],
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <Providers>
                    {children}
                </Providers>
                <AnalyticsProvider />
                <RateLimitNotification />
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    )
}
