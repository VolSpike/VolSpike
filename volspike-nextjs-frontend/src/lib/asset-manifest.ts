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

const MANIFEST_CACHE_KEY = 'volspike:asset-manifest-v2' // Bump version to clear stale cache
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
        
        // Check for 1000PEPE before writing
        const pepAsset = assets.find(a => a.baseSymbol.toUpperCase() === '1000PEPE')
        if (pepAsset) {
            console.log('[writeManifestCache] 1000PEPE before localStorage write:', {
                hasLogoUrl: !!pepAsset.logoUrl,
                logoUrlLength: pepAsset.logoUrl?.length || 0,
                hasDescription: !!pepAsset.description,
                descriptionLength: pepAsset.description?.length || 0,
            })
        }
        
        const jsonString = JSON.stringify(payload)
        console.log('[writeManifestCache] JSON size:', jsonString.length, 'bytes')
        
        // Check if localStorage has size limits (usually 5-10MB)
        try {
            localStorage.setItem(MANIFEST_CACHE_KEY, jsonString)
            
            // Verify it was written correctly
            const verify = localStorage.getItem(MANIFEST_CACHE_KEY)
            if (verify) {
                const parsed = JSON.parse(verify)
                const pepAfter = parsed?.assets?.find((a: AssetRecord) => a.baseSymbol.toUpperCase() === '1000PEPE')
                if (pepAfter) {
                    console.log('[writeManifestCache] 1000PEPE after localStorage write:', {
                        hasLogoUrl: !!pepAfter.logoUrl,
                        logoUrlLength: pepAfter.logoUrl?.length || 0,
                        hasDescription: !!pepAfter.description,
                        descriptionLength: pepAfter.description?.length || 0,
                    })
                }
            }
        } catch (storageError: any) {
            if (storageError.name === 'QuotaExceededError') {
                console.error('[writeManifestCache] localStorage quota exceeded!', {
                    jsonSize: jsonString.length,
                    error: storageError.message,
                })
                // Try to clear old cache and retry
                localStorage.removeItem(MANIFEST_CACHE_KEY)
                localStorage.setItem(MANIFEST_CACHE_KEY, jsonString)
            } else {
                throw storageError
            }
        }
    } catch (error) {
        console.error('[writeManifestCache] Failed to persist manifest cache:', error)
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
    
    // Debug: Check 1000PEPE in API response
    const pepInApi = assets.find(a => a.baseSymbol.toUpperCase() === '1000PEPE')
    if (pepInApi) {
        console.log('[fetchManifestFromApi] 1000PEPE from API:', {
            hasLogoUrl: !!pepInApi.logoUrl,
            logoUrlLength: pepInApi.logoUrl?.length || 0,
            hasDescription: !!pepInApi.description,
            descriptionLength: pepInApi.description?.length || 0,
        })
    }
    
    const normalized = assets.map(normalizeRecord)
    
    // Debug: Check 1000PEPE after normalization
    const pepAfterNorm = normalized.find(a => a.baseSymbol.toUpperCase() === '1000PEPE')
    if (pepAfterNorm) {
        console.log('[fetchManifestFromApi] 1000PEPE after normalizeRecord:', {
            hasLogoUrl: !!pepAfterNorm.logoUrl,
            logoUrlLength: pepAfterNorm.logoUrl?.length || 0,
            hasDescription: !!pepAfterNorm.description,
            descriptionLength: pepAfterNorm.description?.length || 0,
        })
    }
    
    return normalized
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

export const prefetchAssetManifest = async (): Promise<void> => {
    // If already in memory, return immediately
    if (manifestMemory) return Promise.resolve()
    
    // If already loading, wait for it
    if (manifestPromise) return manifestPromise.then(() => undefined)
    
    // Start loading
    manifestPromise = loadAssetManifest().then((assets) => {
        manifestPromise = null
        return assets
    }).catch((err) => {
        manifestPromise = null
        throw err
    })
    
    return manifestPromise.then(() => undefined)
}

/**
 * Synchronously find asset in manifest if manifest is already loaded in memory
 * Falls back to async lookup if manifest needs to be fetched
 */
export const findAssetInManifestSync = (symbol: string): AssetRecord | undefined => {
    const cached = readCachedManifest()
    if (!cached) {
        console.log(`[findAssetInManifestSync] No cached manifest for "${symbol}"`)
        return undefined
    }
    
    const upper = symbol.toUpperCase()
    console.log(`[findAssetInManifestSync] Searching for "${upper}" in ${cached.length} cached assets`)
    
    const found = cached.find((asset) => {
        const baseMatch = asset.baseSymbol?.toUpperCase() === upper
        const binanceMatch = asset.binanceSymbol?.toUpperCase().replace(/USDT$/i, '') === upper
        const extraMatch = Array.isArray(asset.extraSymbols) && asset.extraSymbols.some((s) => s.toUpperCase() === upper)
        
        if (baseMatch || binanceMatch || extraMatch) {
            console.log(`[findAssetInManifestSync] ✅ Match found:`, {
                baseSymbol: asset.baseSymbol,
                binanceSymbol: asset.binanceSymbol,
                baseMatch,
                binanceMatch,
                extraMatch,
            })
        }
        
        return baseMatch || binanceMatch || extraMatch
    })
    
    if (!found) {
        // Log sample of what we're searching through
        const sample = cached.slice(0, 5).map(a => a.baseSymbol)
        console.log(`[findAssetInManifestSync] ❌ No match. Sample symbols in cache:`, sample)
    }
    
    return found
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
