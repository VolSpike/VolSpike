export interface User {
    id: string
    email: string
    tier: 'free' | 'pro' | 'elite'
    role?: 'USER' | 'ADMIN'
    refreshInterval: number
    theme: string
    walletAddress?: string
    stripeCustomerId?: string
}

export interface AuthenticatedSocket {
    userId?: string
    userTier?: string
}

export interface MarketData {
    symbol: string
    price: number
    volume: number
    change24h: number
    timestamp: number
}

export interface Alert {
    id: string
    symbol: string
    threshold: number
    reason: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface WatchlistItem {
    id: string
    symbol: string
    addedAt: Date
}

export interface UserPreferences {
    emailAlerts: boolean
    smsAlerts: boolean
    telegramAlerts: boolean
    discordAlerts: boolean
    volumeThreshold: number
    minQuoteVolume: number
    refreshInterval: number
}

// Hono context with user
export interface HonoContext {
    get: (key: string) => any
    set: (key: string, value: any) => void
    req: any
    json: (data: any, status?: number) => Response
}
