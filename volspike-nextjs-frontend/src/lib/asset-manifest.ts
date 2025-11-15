export type AssetStatus = 'AUTO' | 'VERIFIED' | 'HIDDEN'

export interface AssetRecord {
    id?: string
    baseSymbol: string
    binanceSymbol?: string | null
    extraSymbols?: string[] | null
    coingeckoId?: string | null
    displayName?: string | null
    websiteUrl?: string | null
    twitterUrl?: string | null
    logoUrl?: string | null
    status?: AssetStatus
}

// Seed manifest for important symbols; the admin panel and backend
// Asset model will become the long-term source of truth, but this
// keeps the frontend self-contained and fast even before the admin
// data is populated.
export const STATIC_ASSET_MANIFEST: Record<string, AssetRecord> = {
    BTC: {
        baseSymbol: 'BTC',
        coingeckoId: 'bitcoin',
        displayName: 'Bitcoin',
        websiteUrl: 'https://bitcoin.org',
    },
    ETH: {
        baseSymbol: 'ETH',
        coingeckoId: 'ethereum',
        displayName: 'Ethereum',
        websiteUrl: 'https://ethereum.org',
    },
    SOL: {
        baseSymbol: 'SOL',
        coingeckoId: 'solana',
        displayName: 'Solana',
        websiteUrl: 'https://solana.com/',
        twitterUrl: 'https://x.com/solana',
    },
    ENA: {
        baseSymbol: 'ENA',
        coingeckoId: 'ethena',
        displayName: 'Ethena',
    },
    SOON: {
        baseSymbol: 'SOON',
        coingeckoId: 'soon-2',
        displayName: 'SOON',
    },
    '1000PEPE': {
        baseSymbol: '1000PEPE',
        coingeckoId: 'pepe',
        displayName: 'Pepe',
    },
    BEAT: {
        baseSymbol: 'BEAT',
        coingeckoId: 'audiera',
        displayName: 'Audiera',
    },
}

