export type AssetStatus = 'AUTO' | 'VERIFIED' | 'HIDDEN'

export interface AssetRecord {
    id?: string
    baseSymbol: string
    binanceSymbol?: string | null
    extraSymbols?: string[] | null
    coingeckoId?: string | null
    displayName?: string | null
    description?: string | null
    websiteUrl?: string | null
    twitterUrl?: string | null
    logoUrl?: string | null
    status?: AssetStatus
    isComplete?: boolean
    notes?: string | null
    updatedAt?: string | null
    source?: 'db' | 'fallback'
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

const MANIFEST_CACHE_KEY = 'volspike:asset-manifest-v1'
const MANIFEST_TTL_MS = 6.9 * 24 * 60 * 60 * 1000 // slightly under a week to stagger refreshes

const debugEnabled = () => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('volspike:debug:assets') === 'true'
}

const logDebug = (...args: any[]) => {
    if (debugEnabled()) {
        // eslint-disable-next-line no-console
        console.debug('[AssetManifest]', ...args)
    }
}

let manifestMemory: AssetRecord[] | null = null
let manifestPromise: Promise<AssetRecord[]> | null = null

const normalizeRecord = (record: AssetRecord): AssetRecord => {
    const extraSymbols = Array.isArray(record.extraSymbols)
        ? record.extraSymbols.map((s) => String(s).toUpperCase())
        : []

    return {
        ...record,
        baseSymbol: record.baseSymbol.toUpperCase(),
        binanceSymbol: record.binanceSymbol?.toUpperCase() ?? null,
        extraSymbols,
        coingeckoId: record.coingeckoId || null,
        displayName: record.displayName || null,
        description: record.description || null,
        websiteUrl: record.websiteUrl || null,
        twitterUrl: record.twitterUrl || null,
        logoUrl: record.logoUrl || null,
        status: record.status || 'AUTO',
        isComplete: record.isComplete ?? false,
    }
}

const readCachedManifest = (): AssetRecord[] | null => {
    if (manifestMemory) return manifestMemory
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(MANIFEST_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { assets?: AssetRecord[]; timestamp?: number }
        if (!parsed?.assets || !parsed.timestamp) return null
        if (Date.now() - parsed.timestamp > MANIFEST_TTL_MS) {
            logDebug('Manifest cache stale, refreshing')
            return null
        }
        manifestMemory = parsed.assets.map(normalizeRecord)
        return manifestMemory
    } catch {
        return null
    }
}

const writeManifestCache = (assets: AssetRecord[]) => {
    if (typeof window === 'undefined') return
    try {
        const payload = {
            assets,
            timestamp: Date.now(),
        }
        manifestMemory = assets
        localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(payload))
    } catch (error) {
        logDebug('Failed to persist manifest cache', error)
    }
}

const fetchManifestFromApi = async (): Promise<AssetRecord[]> => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const url = `${apiBase}/api/assets/manifest`

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!res.ok) {
        throw new Error(`Manifest request failed: ${res.status}`)
    }

    const json = await res.json()
    const assets: AssetRecord[] = Array.isArray(json?.assets) ? json.assets : []
    logDebug(`Fetched manifest from API (${assets.length} assets, source=${json?.source})`)
    return assets.map(normalizeRecord)
}

/**
 * Fetch the cached asset manifest (DB + fallbacks) once per session.
 * Falls back to the baked-in static manifest if the API is unavailable.
 */
export const loadAssetManifest = async (): Promise<AssetRecord[]> => {
    const cached = readCachedManifest()
    if (cached) return cached

    if (!manifestPromise) {
        manifestPromise = (async () => {
            try {
                const assets = await fetchManifestFromApi()
                writeManifestCache(assets)
                return assets
            } catch (error) {
                logDebug('Manifest fetch failed, using static seed', error)
                const assets = Object.values(STATIC_ASSET_MANIFEST).map(normalizeRecord)
                writeManifestCache(assets)
                return assets
            } finally {
                manifestPromise = null
            }
        })()
    }

    return manifestPromise
}

export const prefetchAssetManifest = () => {
    if (manifestMemory || manifestPromise) return
    loadAssetManifest().catch(() => {
        // ignore – fallback already handled by loadAssetManifest
    })
}

/**
 * Synchronously find asset in manifest if manifest is already loaded in memory
 * Falls back to async lookup if manifest needs to be fetched
 */
export const findAssetInManifestSync = (symbol: string): AssetRecord | undefined => {
    const cached = readCachedManifest()
    if (!cached) return undefined
    
    const upper = symbol.toUpperCase()
    return cached.find((asset) => {
        const baseMatch = asset.baseSymbol?.toUpperCase() === upper
        const binanceMatch = asset.binanceSymbol?.toUpperCase().replace(/USDT$/i, '') === upper
        const extraMatch = Array.isArray(asset.extraSymbols) && asset.extraSymbols.some((s) => s.toUpperCase() === upper)
        return baseMatch || binanceMatch || extraMatch
    })
}

export const findAssetInManifest = async (symbol: string): Promise<AssetRecord | undefined> => {
    // Try synchronous lookup first (fast path)
    const syncResult = findAssetInManifestSync(symbol)
    if (syncResult) return syncResult
    
    // Fallback to async if manifest not in memory
    const manifest = await loadAssetManifest()
    const upper = symbol.toUpperCase()

    return manifest.find((asset) => {
        const baseMatch = asset.baseSymbol?.toUpperCase() === upper
        const binanceMatch = asset.binanceSymbol?.toUpperCase().replace(/USDT$/i, '') === upper
        const extraMatch = Array.isArray(asset.extraSymbols) && asset.extraSymbols.some((s) => s.toUpperCase() === upper)
        return baseMatch || binanceMatch || extraMatch
    })
}
