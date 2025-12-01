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
    logoUrl?: string | null // Base64 data URL (backward compatibility, deprecated)
    logoImageUrl?: string | null // CoinGecko image URL (preferred - browser caches it)
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

const MANIFEST_CACHE_KEY = 'volspike:asset-manifest-v3' // Bump version to clear stale cache
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
let manifestMemoryIsStale = false
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
        logoUrl: record.logoUrl || null, // Base64 (backward compatibility)
        logoImageUrl: record.logoImageUrl || null, // CoinGecko URL (preferred)
        status: record.status || 'AUTO',
        isComplete: record.isComplete ?? false,
    }
}

const readCachedManifest = (): AssetRecord[] | null => {
    // Always return memory cache if available (even if stale) - it's better than nothing
    if (manifestMemory) {
        return manifestMemory
    }
    
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(MANIFEST_CACHE_KEY)
        if (!raw) return null
        
        const parsed = JSON.parse(raw) as { assets?: AssetRecord[]; timestamp?: number }
        if (!parsed?.assets || !parsed.timestamp) return null
        
        // CRITICAL: If cache has too few assets (< 100), it's incomplete - don't use it
        // This prevents using stale/incomplete caches that only have a few assets
        if (parsed.assets.length < 100) {
            console.log(`[readCachedManifest] Cache has only ${parsed.assets.length} assets - too few, ignoring incomplete cache`)
            localStorage.removeItem(MANIFEST_CACHE_KEY) // Clear incomplete cache
            return null // Force fresh fetch from backend
        }
        
        const age = Date.now() - parsed.timestamp
        const isStale = age > MANIFEST_TTL_MS
        
        // CRITICAL: localStorage cache doesn't include base64 logos (to prevent quota exceeded)
        // We can use it for metadata, but we MUST fetch fresh manifest from backend to get logos
        // Don't set manifestMemory here - let loadAssetManifest() fetch fresh data with logos
        // This ensures logos are always available instantly
        
        console.log(`[readCachedManifest] Found localStorage cache (${parsed.assets.length} assets, stale=${isStale}), but logos missing - will fetch fresh from backend`)
        
        // Return null to force fresh fetch - we need logos!
        return null
    } catch (error) {
        return null
    }
}

const writeManifestCache = (assets: AssetRecord[]) => {
    if (typeof window === 'undefined') return
    try {
        // CRITICAL: Strip base64 logos from localStorage cache to prevent quota exceeded errors
        // Base64 logos are ~15KB each, with 500+ assets that's ~7.5MB just for logos
        // localStorage limit is typically 5-10MB, so we can't store base64 logos
        // Solution: Store everything EXCEPT base64 logos in localStorage
        // Logos are kept in memory cache for instant display, and fetched fresh on page load
        const assetsForStorage = assets.map((asset) => {
            const { logoUrl, ...rest } = asset
            // Only store logo if it's a URL (not base64 data URL)
            // Base64 data URLs start with "data:image"
            const logoForStorage = logoUrl && !logoUrl.startsWith('data:image') ? logoUrl : undefined
            return {
                ...rest,
                logoUrl: logoForStorage,
            }
        })
        
        const payload = {
            assets: assetsForStorage,
            timestamp: Date.now(),
        }
        
        // CRITICAL: Store logoImageUrl (CoinGecko URLs) in memory cache, not base64 logos
        // Base64 logos are ~15KB each, with 534 assets that's ~8MB just for logos
        // CoinGecko URLs are tiny (~100 bytes each) and browser caches images naturally
        // This prevents memory issues while allowing instant logo display
        const assetsForMemory = assets.map((asset) => {
            const { logoUrl, logoImageUrl, ...rest } = asset
            // Prefer logoImageUrl (CoinGecko URL) over logoUrl (base64)
            // logoImageUrl is preferred because browser caches it naturally
            const logoForMemory = logoImageUrl || (logoUrl && !logoUrl.startsWith('data:image') ? logoUrl : undefined)
            return {
                ...rest,
                logoUrl: undefined, // Don't store base64 in memory
                logoImageUrl: logoForMemory, // Store CoinGecko URL
            }
        })
        
        manifestMemory = assetsForMemory
        manifestMemoryIsStale = false
        
        console.log(`[writeManifestCache] Stored ${manifestMemory.length} assets in memory (using CoinGecko URLs for logos)`)
        
        const jsonString = JSON.stringify(payload)
        const sizeMB = (jsonString.length / 1024 / 1024).toFixed(2)
        console.log(`[writeManifestCache] Writing ${assets.length} assets to localStorage (${sizeMB} MB, logos excluded)`)
        
        try {
            localStorage.setItem(MANIFEST_CACHE_KEY, jsonString)
            console.log(`[writeManifestCache] ✅ Successfully cached manifest (${sizeMB} MB)`)
        } catch (storageError: any) {
            if (storageError.name === 'QuotaExceededError') {
                console.error('[writeManifestCache] localStorage quota exceeded!', {
                    jsonSize: jsonString.length,
                    sizeMB,
                    error: storageError.message,
                })
                // Try to clear old cache and retry
                localStorage.removeItem(MANIFEST_CACHE_KEY)
                try {
                    localStorage.setItem(MANIFEST_CACHE_KEY, jsonString)
                    console.log('[writeManifestCache] ✅ Retry after clearing old cache succeeded')
                } catch (retryError) {
                    console.error('[writeManifestCache] ❌ Retry failed, cache not persisted:', retryError)
                    // Cache will be fetched fresh on next page load
                }
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
    logDebug(`Fetched manifest from backend API (${assets.length} assets, source=${json?.source})`)
    
    return assets.map(normalizeRecord)
}

/**
 * Fetch the cached asset manifest (DB + fallbacks) once per session.
 * Falls back to the baked-in static manifest if the API is unavailable.
 */
export const loadAssetManifest = async (): Promise<AssetRecord[]> => {
    // CRITICAL: Always fetch fresh manifest from backend on page load to get logos
    // localStorage cache doesn't have base64 logos (to prevent quota exceeded)
    // So we MUST fetch fresh to populate memory cache with logos for instant display
    
    // Check if we already have manifest in memory (from previous fetch)
    if (manifestMemory && !manifestMemoryIsStale) {
        console.log(`[loadAssetManifest] Using memory cache: ${manifestMemory.length} assets (with logos)`)
        return manifestMemory
    }
    
    // If already fetching, wait for it
    if (manifestPromise) {
        return manifestPromise
    }
    
    // Always fetch fresh from backend to get logos
    console.log('[loadAssetManifest] Fetching fresh manifest from backend (to get logos)...')
        manifestPromise = (async () => {
            try {
                const assets = await fetchManifestFromApi()
            console.log(`[loadAssetManifest] ✅ Fetched ${assets.length} assets from backend (with logos)`)
            writeManifestCache(assets) // Stores full data in memory, stripped version in localStorage
            manifestMemoryIsStale = false
                return assets
            } catch (error) {
            console.error('[loadAssetManifest] Backend fetch failed:', error)
                logDebug('Manifest fetch failed, using static seed', error)
                const assets = Object.values(STATIC_ASSET_MANIFEST).map(normalizeRecord)
                writeManifestCache(assets)
                return assets
            } finally {
                manifestPromise = null
            }
        })()

    return manifestPromise
}

export const prefetchAssetManifest = async (): Promise<void> => {
    // If already in memory, return immediately
    if (manifestMemory && !manifestMemoryIsStale) return Promise.resolve()
    
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
    
    // If the cache we just used was stale, refresh it without blocking UI
    if (manifestMemoryIsStale) {
        manifestMemoryIsStale = false
        prefetchAssetManifest().catch(() => {
            /* ignore refresh errors */
        })
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

// Warm manifest as soon as this module is loaded in the browser so first interaction is instant
if (typeof window !== 'undefined') {
    prefetchAssetManifest().catch(() => {
        /* ignore warmup errors */
    })
}
