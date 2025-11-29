import axios from 'axios'
import type { Asset, AssetStatus } from '@prisma/client'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'

const logger = createLogger()

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const BINANCE_FUTURES_INFO = 'https://fapi.binance.com/fapi/v1/exchangeInfo'

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
const REQUEST_GAP_MS = 3000 // 3 seconds between requests (~20 calls/minute, safe for CoinGecko)
const MAX_NEW_SYMBOLS_PER_RUN = 60 // cap to avoid long startup loops

// Progress tracking for continuous refresh cycle
interface RefreshProgress {
    isRunning: boolean
    current: number
    total: number
    currentSymbol?: string
    startedAt?: number
    lastUpdated?: number
    refreshed: number
    failed: number
    skipped: number // Assets skipped (no CoinGecko ID found)
    noUpdate: number // Assets that didn't need updates
    errors: Array<{ symbol: string; reason: string; error?: string }> // Detailed error list
    successes: string[] // List of successfully refreshed symbols
}

let refreshProgress: RefreshProgress = {
    isRunning: false,
    current: 0,
    total: 0,
    refreshed: 0,
    failed: 0,
    skipped: 0,
    noUpdate: 0,
    errors: [],
    successes: [],
}

/**
 * Get current refresh cycle progress
 */
export const getRefreshProgress = (): RefreshProgress => {
    return { ...refreshProgress }
}

export interface AssetManifestEntry {
    baseSymbol: string
    binanceSymbol?: string | null
    extraSymbols?: string[]
    coingeckoId?: string | null
    displayName?: string | null
    description?: string | null
    websiteUrl?: string | null
    twitterUrl?: string | null
    logoUrl?: string | null
    status?: AssetStatus
    isComplete?: boolean
    updatedAt?: string
    source: 'db' | 'fallback'
}

// Small curated seed set so we always have blue-chip coverage even before DB warms
const STATIC_SEED_MANIFEST: AssetManifestEntry[] = [
    {
        baseSymbol: 'BTC',
        coingeckoId: 'bitcoin',
        displayName: 'Bitcoin',
        websiteUrl: 'https://bitcoin.org',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: 'ETH',
        coingeckoId: 'ethereum',
        displayName: 'Ethereum',
        websiteUrl: 'https://ethereum.org',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: 'SOL',
        coingeckoId: 'solana',
        displayName: 'Solana',
        websiteUrl: 'https://solana.com/',
        twitterUrl: 'https://x.com/solana',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: 'ENA',
        coingeckoId: 'ethena',
        displayName: 'Ethena',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: 'SOON',
        coingeckoId: 'soon-2',
        displayName: 'SOON',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: '1000PEPE',
        coingeckoId: 'pepe',
        displayName: 'Pepe',
        status: 'AUTO',
        source: 'fallback',
    },
    {
        baseSymbol: 'BEAT',
        coingeckoId: 'audiera',
        displayName: 'Audiera',
        status: 'AUTO',
        source: 'fallback',
    },
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseExtraSymbols = (raw?: string | null): string[] => {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map((s) => String(s).toUpperCase()) : []
    } catch {
        return []
    }
}

export const getAssetManifest = async (): Promise<{ assets: AssetManifestEntry[]; generatedAt: string; source: 'db' | 'fallback' }> => {
    const assets = await prisma.asset.findMany({
        orderBy: { baseSymbol: 'asc' },
    })

    const manifest = assets.map<AssetManifestEntry>((asset) => ({
        baseSymbol: asset.baseSymbol,
        binanceSymbol: asset.binanceSymbol,
        extraSymbols: parseExtraSymbols(asset.extraSymbols),
        coingeckoId: asset.coingeckoId,
        displayName: asset.displayName,
        description: asset.description,
        websiteUrl: asset.websiteUrl,
        twitterUrl: asset.twitterUrl,
        logoUrl: asset.logoUrl,
        status: asset.status,
        isComplete: asset.isComplete ?? false,
        updatedAt: asset.updatedAt.toISOString(),
        source: 'db',
    }))

    // Ensure seeds are present even if DB is empty or partially populated
    const existingSymbols = new Set(manifest.map((m) => m.baseSymbol.toUpperCase()))
    STATIC_SEED_MANIFEST.forEach((seed) => {
        if (!existingSymbols.has(seed.baseSymbol.toUpperCase())) {
            manifest.push(seed)
        }
    })

    return {
        assets: manifest,
        generatedAt: new Date().toISOString(),
        source: assets.length ? 'db' : 'fallback',
    }
}

const shouldRefresh = (asset: Asset, now: number): boolean => {
    if (asset.status === 'HIDDEN') return false
    
    // Only process assets marked as Complete by admin (weekly refresh cycles)
    // Incomplete assets are still auto-refreshed when new Binance pairs are detected,
    // but they don't go into scheduled weekly cycles until admin marks them Complete
    if (!asset.isComplete) return false
    
    // Skip assets without CoinGecko ID - they can't be refreshed until admin adds one
    // These will appear in "Missing Data" filter for admin review
    if (!asset.coingeckoId) return false
    
    // Refresh if missing other critical fields (logo, displayName, description)
    if (!asset.logoUrl || !asset.displayName || !asset.description) return true
    
    // Refresh if data is stale (>1 week old)
    const updatedAt = asset.updatedAt?.getTime?.() ?? Date.now()
    return now - updatedAt > REFRESH_INTERVAL_MS
}

const pickCoingeckoId = async (baseSymbol: string, knownId?: string | null): Promise<{ id?: string; source: 'override' | 'search' }> => {
    if (knownId) return { id: knownId, source: 'override' }

    const query = baseSymbol.toUpperCase()

    try {
        const { data } = await axios.get(`${COINGECKO_API}/search`, {
            params: { query },
            timeout: 8000, // Reduced from 12s to 8s
        })

        const coins: any[] = Array.isArray(data?.coins) ? data.coins : []
        if (!coins.length) {
            logger.debug(`[AssetMetadata] No CoinGecko results for ${query}`)
            return { id: undefined, source: 'search' }
        }

        const candidates = coins.filter((c) => (c?.symbol || '').toUpperCase() === query)
        const ranked = (candidates.length ? candidates : coins).slice().sort((a: any, b: any) => {
            const rankA = typeof a.market_cap_rank === 'number' ? a.market_cap_rank : Number.MAX_SAFE_INTEGER
            const rankB = typeof b.market_cap_rank === 'number' ? b.market_cap_rank : Number.MAX_SAFE_INTEGER
            return rankA - rankB
        })

        return { id: ranked[0]?.id, source: 'search' }
    } catch (error) {
        logger.warn(`[AssetMetadata] CoinGecko search failed for ${query}:`, {
            error: error instanceof Error ? error.message : String(error)
        })
        return { id: undefined, source: 'search' }
    }
}

interface CoinProfile {
    name?: string
    description?: string
    homepage?: string
    twitterUrl?: string
    logoUrl?: string
}

const fetchCoinProfile = async (coingeckoId: string, retryCount: number = 0): Promise<CoinProfile> => {
    const maxRetries = 3
    const baseDelay = 5000 // 5 seconds base delay
    
    try {
        const { data } = await axios.get(`${COINGECKO_API}/coins/${encodeURIComponent(coingeckoId)}`, {
            params: {
                localization: 'false',
                tickers: 'false',
                market_data: 'false',
                community_data: 'true',
                developer_data: 'false',
                sparkline: 'false',
            },
            timeout: 10000, // Reduced from 15s to 10s
        })

    // Log raw CoinGecko response for debugging
    logger.debug(`[AssetMetadata] CoinGecko API response for ${coingeckoId}:`, {
        hasLinks: !!data?.links,
        linksKeys: data?.links ? Object.keys(data.links) : [],
        homepageRaw: data?.links?.homepage,
        homepageType: Array.isArray(data?.links?.homepage) ? 'array' : typeof data?.links?.homepage,
        homepageArrayLength: Array.isArray(data?.links?.homepage) ? data.links.homepage.length : undefined,
        twitterScreenName: data?.links?.twitter_screen_name,
        hasImage: !!data?.image,
        imageKeys: data?.image ? Object.keys(data.image) : [],
    })

    const homepageRaw: string | undefined = Array.isArray(data?.links?.homepage)
        ? data.links.homepage.find((url: string | null | undefined) => !!url?.trim())
        : undefined

    // Validate homepage URL before using it
    let homepage: string | undefined = undefined
    if (homepageRaw) {
        const isValid = await validateUrl(homepageRaw)
        if (isValid) {
            homepage = homepageRaw
            logger.info(`[AssetMetadata] ✅ Extracted and validated homepage from CoinGecko for ${coingeckoId}: ${homepage}`)
        } else {
            logger.warn(`[AssetMetadata] ⚠️  Homepage URL failed validation for ${coingeckoId}: ${homepageRaw} (filtered out)`)
        }
    } else {
        logger.info(`[AssetMetadata] ⚠️  No homepage found in CoinGecko response for ${coingeckoId}`)
    }

    const twitterName: string | undefined = data?.links?.twitter_screen_name
        ? String(data.links.twitter_screen_name).trim()
        : undefined

    const twitterUrl = twitterName ? `https://x.com/${twitterName}` : undefined

    // Prefer high-quality logo images: large > small > thumb (for better visibility on dark backgrounds)
    const logoUrl: string | undefined = data?.image?.large || data?.image?.small || data?.image?.thumb || undefined

    // Extract description from CoinGecko (supports both 'en' localized and direct description)
    // Strip HTML tags and entities for clean text storage
    // Handle case where description might be an object or non-string value
    let rawDescription: string | undefined = undefined
    if (data?.description?.en && typeof data.description.en === 'string') {
        rawDescription = data.description.en
    } else if (data?.description && typeof data.description === 'string') {
        rawDescription = data.description
    }
    
    // Log raw description for debugging
    if (rawDescription) {
        logger.debug(`[AssetMetadata] Raw description from CoinGecko for ${coingeckoId}:`, {
            length: rawDescription.length,
            first100Chars: rawDescription.substring(0, 100),
            hasUnicodeBrackets: rawDescription.includes('【') || rawDescription.includes('】'),
        })
    }
    
    const description: string | undefined = rawDescription
        ? rawDescription
              .replace(/<[^>]+>/g, ' ') // Remove HTML tags
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim()
        : undefined
    
    // Log cleaned description
    if (description) {
        logger.debug(`[AssetMetadata] Cleaned description for ${coingeckoId}:`, {
            length: description.length,
            first100Chars: description.substring(0, 100),
        })
    }

        return {
            name: data?.name as string | undefined,
            description,
            homepage,
            twitterUrl,
            logoUrl,
        }
    } catch (error: any) {
        // Handle rate limit errors with exponential backoff
        if (error?.response?.status === 429 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff: 5s, 10s, 20s
            logger.warn(`[AssetMetadata] Rate limit hit for ${coingeckoId}, retrying after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
            await sleep(delay)
            return fetchCoinProfile(coingeckoId, retryCount + 1)
        }
        // Re-throw other errors
        throw error
    }
}

const fetchAsDataUrl = async (url?: string | null): Promise<string | undefined> => {
    if (!url) return undefined
    try {
        const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 15000 })
        const contentType = response.headers['content-type'] || 'image/png'
        const base64 = Buffer.from(response.data).toString('base64')
        return `data:${contentType};base64,${base64}`
    } catch (error) {
        logger.warn('[AssetMetadata] Failed to cache logo, falling back to remote URL', {
            url,
            error: error instanceof Error ? error.message : String(error),
        })
        return url
    }
}

/**
 * Validate if a URL is accessible and not broken
 * Returns true if URL is valid and accessible, false otherwise
 */
const validateUrl = async (url: string): Promise<boolean> => {
    try {
        // Basic URL format validation
        try {
            new URL(url)
        } catch {
            logger.debug(`[AssetMetadata] Invalid URL format: ${url}`)
            return false
        }

        // Check for obviously invalid patterns (local/private addresses only)
        // Don't hardcode specific domains - let HEAD request check actual accessibility
        const invalidPatterns = [
            /^https?:\/\/localhost/,
            /^https?:\/\/127\.0\.0\.1/,
            /^https?:\/\/0\.0\.0\.0/,
            /^https?:\/\/192\.168\./, // Private network
            /^https?:\/\/10\./, // Private network
            /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./, // Private network
        ]

        for (const pattern of invalidPatterns) {
            if (pattern.test(url)) {
                logger.debug(`[AssetMetadata] URL matches invalid pattern (local/private): ${url}`)
                return false
            }
        }

        // Try a HEAD request to check if URL is accessible (with short timeout)
        try {
            const response = await axios.head(url, {
                timeout: 5000, // 5 second timeout
                maxRedirects: 5,
                validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx but not 5xx
            })

            // Consider 4xx (client errors) as potentially broken, but 2xx/3xx as valid
            if (response.status >= 400 && response.status < 500) {
                logger.debug(`[AssetMetadata] URL returned client error (${response.status}): ${url}`)
                return false
            }

            return true
        } catch (error: any) {
            // Network errors, timeouts, or 5xx errors mean URL is likely broken
            if (axios.isAxiosError(error)) {
                const status = error.response?.status
                if (status && status >= 500) {
                    logger.debug(`[AssetMetadata] URL returned server error (${status}): ${url}`)
                    return false
                }
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                    logger.debug(`[AssetMetadata] URL is not accessible (${error.code}): ${url}`)
                    return false
                }
            }
            logger.debug(`[AssetMetadata] URL validation failed: ${url}`, {
                error: error instanceof Error ? error.message : String(error),
            })
            return false
        }
    } catch (error) {
        logger.debug(`[AssetMetadata] URL validation error: ${url}`, {
            error: error instanceof Error ? error.message : String(error),
        })
        return false
    }
}

export const refreshSingleAsset = async (asset: Asset): Promise<{ success: boolean; reason?: string; error?: string }> => {
    const now = Date.now()
    const symbol = asset.baseSymbol.toUpperCase()
    const allowOverwrite = asset.status !== 'VERIFIED'

    try {
        logger.debug(`[AssetMetadata] Starting refresh for ${symbol}`, {
            hasCoingeckoId: !!asset.coingeckoId,
            hasLogo: !!asset.logoUrl,
            hasDisplayName: !!asset.displayName,
            status: asset.status,
        })

        const { id: coingeckoId, source } = await pickCoingeckoId(symbol, asset.coingeckoId)
        if (!coingeckoId) {
            logger.warn(`[AssetMetadata] No CoinGecko id found for ${symbol}`, {
                hadKnownId: !!asset.coingeckoId,
            })
            return { success: false, reason: 'NO_COINGECKO_ID', error: 'No CoinGecko ID found for this symbol' }
        }

        logger.debug(`[AssetMetadata] Found CoinGecko id for ${symbol}: ${coingeckoId} (source: ${source})`)

        const profile = await fetchCoinProfile(coingeckoId)
        logger.debug(`[AssetMetadata] Fetched profile for ${symbol}`, {
            hasName: !!profile.name,
            name: profile.name,
            hasDescription: !!profile.description,
            hasHomepage: !!profile.homepage,
            homepage: profile.homepage, // Log actual homepage value
            hasTwitter: !!profile.twitterUrl,
            hasLogoUrl: !!profile.logoUrl,
        })

        const logoDataUrl = await fetchAsDataUrl(profile.logoUrl)
        logger.debug(`[AssetMetadata] Logo fetch result for ${symbol}`, {
            originalUrl: profile.logoUrl,
            convertedToDataUrl: !!logoDataUrl,
            isDataUrl: logoDataUrl?.startsWith('data:'),
        })

        const payload: Partial<Asset> = {}

        // Always update displayName if we have it from CoinGecko (when allowOverwrite is true)
        if (allowOverwrite || !asset.displayName) {
            payload.displayName = profile.name || asset.displayName || symbol
        }
        
        // Always update description if we have it from CoinGecko (when allowOverwrite is true)
        if (allowOverwrite || !asset.description) {
            payload.description = profile.description ?? asset.description
        }
        
        // For websiteUrl: if CoinGecko has no homepage, set to null (don't keep old wrong URLs)
        // Only update if allowOverwrite is true OR if we don't have a websiteUrl yet
        if (allowOverwrite || !asset.websiteUrl) {
            const newWebsiteUrl = profile.homepage || null
            logger.debug(`[AssetMetadata] Setting websiteUrl for ${symbol}:`, {
                oldWebsiteUrl: asset.websiteUrl,
                newWebsiteUrl: newWebsiteUrl,
                fromCoinGecko: !!profile.homepage,
                allowOverwrite,
            })
            payload.websiteUrl = newWebsiteUrl // Explicitly set to null if CoinGecko has no homepage
        }
        
        // For twitterUrl: if CoinGecko has no Twitter, set to null (don't keep old wrong URLs)
        if (allowOverwrite || !asset.twitterUrl) {
            payload.twitterUrl = profile.twitterUrl || null // Explicitly set to null if CoinGecko has no Twitter
        }
        
        // Always update logo if we successfully fetched it
        if (logoDataUrl && (allowOverwrite || !asset.logoUrl)) {
            payload.logoUrl = logoDataUrl
        }
        
        // Always update CoinGecko ID to ensure it matches what we just fetched
        if (allowOverwrite || !asset.coingeckoId) {
            payload.coingeckoId = coingeckoId
        }

        if (!Object.keys(payload).length) {
            logger.debug(`[AssetMetadata] No updates needed for ${symbol} (all fields present and verified)`)
            return { success: false, reason: 'NO_UPDATE_NEEDED', error: 'Asset already has all required data' }
        }

        await prisma.asset.update({
            where: { id: asset.id },
            data: {
                ...payload,
                lastFailureReason: null, // Clear failure reason on success
            },
        })

        const elapsedMs = Date.now() - now
        logger.info(`[AssetMetadata] ✅ Refreshed ${symbol}`, {
            elapsedMs,
            updatedFields: Object.keys(payload),
            coingeckoId,
        })
        return { success: true }
    } catch (error) {
        const elapsedMs = Date.now() - now
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        // Categorize errors
        let reason = 'UNKNOWN_ERROR'
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            reason = 'RATE_LIMIT'
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            reason = 'NOT_FOUND'
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNABORTED')) {
            reason = 'TIMEOUT'
        } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
            reason = 'NETWORK_ERROR'
        }

        // Store failure reason in database for retry logic (only for incomplete assets)
        if (!asset.isComplete) {
            try {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: { lastFailureReason: reason },
                })
            } catch (updateError) {
                logger.warn(`[AssetMetadata] Failed to update lastFailureReason for ${symbol}:`, updateError)
            }
        }

        logger.warn(`[AssetMetadata] ❌ Failed to refresh ${symbol}`, {
            error: errorMessage,
            reason,
            stack: errorStack,
            elapsedMs,
        })
        return { success: false, reason, error: errorMessage }
    }
}

/**
 * Detect new assets from Market Data symbols (WebSocket-based detection)
 * Compares symbols from Market Data against existing Asset database
 * Creates new Asset records for symbols that don't exist yet
 * 
 * @param symbols Array of symbols from Market Data (e.g., ["BTCUSDT", "ETHUSDT"])
 * @returns Object with created assets count and list of new base symbols
 */
export const detectNewAssetsFromMarketData = async (symbols: string[]): Promise<{ created: number; newSymbols: string[] }> => {
    try {
        // Extract base symbols from Market Data symbols (e.g., "BTCUSDT" -> "BTC")
        const baseSymbols = symbols
            .filter((sym) => sym && typeof sym === 'string' && sym.endsWith('USDT'))
            .map((sym) => {
                // Remove "USDT" suffix and normalize to uppercase
                const base = sym.replace(/USDT$/i, '').toUpperCase()
                return base
            })
            .filter((base) => base.length > 0) // Filter out empty strings

        if (!baseSymbols.length) {
            logger.debug('[AssetMetadata] No valid base symbols to check')
            return { created: 0, newSymbols: [] }
        }

        // Get existing assets from database
        const existing = await prisma.asset.findMany({
            select: { baseSymbol: true },
        })
        const existingSet = new Set(existing.map((a) => a.baseSymbol.toUpperCase()))

        // Find new symbols that don't exist in database
        const newBaseSymbols = baseSymbols.filter((base) => !existingSet.has(base))
        const uniqueNewSymbols = Array.from(new Set(newBaseSymbols)) // Remove duplicates

        if (!uniqueNewSymbols.length) {
            logger.debug('[AssetMetadata] No new assets detected from Market Data')
            return { created: 0, newSymbols: [] }
        }

        logger.info(`[AssetMetadata] Detected ${uniqueNewSymbols.length} new assets from Market Data`, {
            newSymbols: uniqueNewSymbols.slice(0, 10), // Log first 10
        })

        // Create new Asset records
        let created = 0
        const createdSymbols: string[] = []

        for (const baseSymbol of uniqueNewSymbols) {
            try {
                // Reconstruct binanceSymbol from baseSymbol (e.g., "BTC" -> "BTCUSDT")
                const binanceSymbol = `${baseSymbol}USDT`

                await prisma.asset.create({
                    data: {
                        baseSymbol,
                        binanceSymbol,
                        status: 'AUTO',
                    },
                })

                created++
                createdSymbols.push(baseSymbol)
                logger.debug(`[AssetMetadata] Created new asset: ${baseSymbol}`)
            } catch (error: any) {
                // Handle unique constraint violations (race condition)
                if (error?.code === 'P2002') {
                    logger.debug(`[AssetMetadata] Asset ${baseSymbol} already exists (race condition)`)
                } else {
                    logger.warn(`[AssetMetadata] Failed to create asset ${baseSymbol}:`, {
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }

        if (created > 0) {
            logger.info(`[AssetMetadata] ✅ Created ${created} new assets from Market Data`, {
                createdSymbols: createdSymbols.slice(0, 10),
            })
        }

        return { created, newSymbols: createdSymbols }
    } catch (error) {
        logger.error('[AssetMetadata] Failed to detect new assets from Market Data', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
        return { created: 0, newSymbols: [] }
    }
}

/**
 * Legacy function: Sync Binance universe via API (deprecated, kept for fallback)
 * Note: This uses Binance API which may be blocked by IP restrictions
 * Prefer using detectNewAssetsFromMarketData() instead
 */
const ensureBinanceUniverse = async (): Promise<number> => {
    try {
        const { data } = await axios.get(BINANCE_FUTURES_INFO, { timeout: 20000 })
        const symbols: any[] = Array.isArray(data?.symbols) ? data.symbols : []
        if (!symbols.length) return 0

        const candidates = symbols
            .filter((s) => s?.contractType === 'PERPETUAL' && s?.quoteAsset === 'USDT' && s?.status === 'TRADING')
            .map((s) => ({
                baseSymbol: String(s.baseAsset || '').toUpperCase(),
                binanceSymbol: String(s.symbol || '').toUpperCase(),
            }))

        const existing = await prisma.asset.findMany({
            select: { baseSymbol: true },
        })
        const existingSet = new Set(existing.map((a) => a.baseSymbol.toUpperCase()))

        let created = 0
        for (const candidate of candidates) {
            if (created >= MAX_NEW_SYMBOLS_PER_RUN) break
            if (existingSet.has(candidate.baseSymbol)) continue

            await prisma.asset.upsert({
                where: { baseSymbol: candidate.baseSymbol },
                update: { binanceSymbol: candidate.binanceSymbol },
                create: {
                    baseSymbol: candidate.baseSymbol,
                    binanceSymbol: candidate.binanceSymbol,
                    status: 'AUTO',
                },
            })
            existingSet.add(candidate.baseSymbol)
            created += 1
        }

        if (created > 0) {
            logger.info(`[AssetMetadata] Seeded ${created} Binance assets`)
        }

        return created
    } catch (error) {
        logger.warn('[AssetMetadata] Failed to sync Binance assets', {
            error: error instanceof Error ? error.message : String(error),
        })
        return 0
    }
}

/**
 * Run continuous asset refresh cycle - processes ALL assets needing refresh
 * Respects CoinGecko rate limits but processes continuously without batch limits
 * Updates progress tracker for admin visibility
 */
export const runAssetRefreshCycle = async (reason: string = 'scheduled') => {
    // Prevent concurrent refresh cycles
    if (refreshProgress.isRunning) {
        logger.info('[AssetMetadata] Refresh cycle already running, skipping')
        return {
            refreshed: 0,
            candidates: [],
            total: 0,
            needsRefreshCount: 0,
            remaining: 0,
            mode: 'SKIPPED',
            results: [],
            message: 'Refresh cycle already running',
        }
    }

    const now = Date.now()
    logger.info(`[AssetMetadata] 🔄 Refresh cycle started (${reason})`)

        // Initialize progress tracker
        refreshProgress = {
            isRunning: true,
            current: 0,
            total: 0,
            startedAt: now,
            lastUpdated: now,
            refreshed: 0,
            failed: 0,
            skipped: 0,
            noUpdate: 0,
            errors: [],
            successes: [],
        }

    try {
        // Check if database is empty and sync Binance universe first
        const assetCount = await prisma.asset.count()
        if (assetCount === 0) {
            logger.info('[AssetMetadata] Database is empty, syncing Binance universe first...')
            const synced = await ensureBinanceUniverse()
            logger.info(`[AssetMetadata] Initial Binance sync completed: ${synced} assets created`)
        }

        const assets = await prisma.asset.findMany({
            orderBy: { updatedAt: 'asc' },
        })

        logger.debug(`[AssetMetadata] Found ${assets.length} total assets in database`)

        // Filter assets that need refresh (no batch limits - process ALL)
        const assetsNeedingRefresh = assets.filter((asset) => shouldRefresh(asset, now))
        const needsRefreshCount = assetsNeedingRefresh.length

        if (!needsRefreshCount) {
            logger.info('[AssetMetadata] ✅ No assets need refresh')
            // Don't set isRunning to true if there's nothing to refresh
            // This prevents frontend from showing completion popup for empty cycles
            return {
                refreshed: 0,
                candidates: [],
                total: assets.length,
                needsRefreshCount: 0,
                remaining: 0,
                mode: 'COMPLETE',
                results: [],
            }
        }

        // Update progress tracker with total count
        refreshProgress.total = needsRefreshCount

        logger.info(
            `[AssetMetadata] 🔄 Continuous processing mode | Found ${needsRefreshCount} assets needing refresh (processing ALL)`
        )

        const results: Array<{ symbol: string; success: boolean; reason?: string; error?: string }> = []

        // Process ALL assets continuously, respecting rate limits
        for (let i = 0; i < assetsNeedingRefresh.length; i++) {
            const asset = assetsNeedingRefresh[i]

            // Update progress tracker
            refreshProgress.current = i + 1
            refreshProgress.currentSymbol = asset.baseSymbol
            refreshProgress.lastUpdated = Date.now()

            const progress = `[${i + 1}/${needsRefreshCount}]`
            logger.info(`[AssetMetadata] ${progress} Processing ${asset.baseSymbol}...`)

            try {
                const result = await refreshSingleAsset(asset)

                if (result.success) {
                    refreshProgress.refreshed++
                    refreshProgress.successes.push(asset.baseSymbol)
                    results.push({ symbol: asset.baseSymbol, success: true })
                    logger.info(
                        `[AssetMetadata] ${progress} ✅ ${asset.baseSymbol} enriched (${refreshProgress.refreshed} successful so far)`
                    )
                } else {
                    // Categorize non-success results
                    if (result.reason === 'NO_COINGECKO_ID') {
                        refreshProgress.skipped++
                        results.push({ symbol: asset.baseSymbol, success: false, reason: result.reason, error: result.error })
                        logger.info(
                            `[AssetMetadata] ${progress} ⚠️  ${asset.baseSymbol} skipped (no CoinGecko ID found)`
                        )
                    } else if (result.reason === 'NO_UPDATE_NEEDED') {
                        refreshProgress.noUpdate++
                        results.push({ symbol: asset.baseSymbol, success: false, reason: result.reason, error: result.error })
                        logger.info(
                            `[AssetMetadata] ${progress} ℹ️  ${asset.baseSymbol} skipped (no updates needed)`
                        )
                    } else {
                        // Actual error
                        refreshProgress.failed++
                        refreshProgress.errors.push({
                            symbol: asset.baseSymbol,
                            reason: result.reason || 'UNKNOWN',
                            error: result.error,
                        })
                        results.push({ symbol: asset.baseSymbol, success: false, reason: result.reason, error: result.error })
                        logger.warn(
                            `[AssetMetadata] ${progress} ❌ ${asset.baseSymbol} failed: ${result.reason} - ${result.error}`
                        )
                    }
                }
            } catch (error) {
                // Unexpected error (shouldn't happen, but catch just in case)
                refreshProgress.failed++
                const errorMessage = error instanceof Error ? error.message : String(error)
                refreshProgress.errors.push({
                    symbol: asset.baseSymbol,
                    reason: 'UNEXPECTED_ERROR',
                    error: errorMessage,
                })
                results.push({
                    symbol: asset.baseSymbol,
                    success: false,
                    reason: 'UNEXPECTED_ERROR',
                    error: errorMessage,
                })
                logger.error(`[AssetMetadata] ${progress} ❌ ${asset.baseSymbol} unexpected error:`, error)
            }

            // Rate limit: wait between requests (except for the last one)
            if (i < assetsNeedingRefresh.length - 1) {
                await sleep(REQUEST_GAP_MS)
            }
        }

        const elapsedMs = Date.now() - now
        const remaining = needsRefreshCount - refreshProgress.refreshed - refreshProgress.failed - refreshProgress.skipped - refreshProgress.noUpdate

        logger.info(`[AssetMetadata] ✅ Refresh cycle complete`, {
            refreshed: refreshProgress.refreshed,
            failed: refreshProgress.failed,
            skipped: refreshProgress.skipped,
            noUpdate: refreshProgress.noUpdate,
            remaining,
            total: needsRefreshCount,
            elapsedMs,
            reason,
            errorCount: refreshProgress.errors.length,
        })

        const finalResult = {
            refreshed: refreshProgress.refreshed,
            failed: refreshProgress.failed,
            skipped: refreshProgress.skipped,
            noUpdate: refreshProgress.noUpdate,
            candidates: assetsNeedingRefresh.map((c) => c.baseSymbol),
            total: assets.length,
            needsRefreshCount,
            remaining,
            mode: 'CONTINUOUS',
            results,
            errors: refreshProgress.errors,
            successes: refreshProgress.successes,
            elapsedMs,
        }

        // Keep progress data for a short time so frontend can display final results
        // Reset after a delay to allow frontend to poll and get final state
        setTimeout(() => {
            refreshProgress.isRunning = false
            refreshProgress.current = 0
            refreshProgress.total = 0
            refreshProgress.currentSymbol = undefined
            refreshProgress.refreshed = 0
            refreshProgress.failed = 0
            refreshProgress.skipped = 0
            refreshProgress.noUpdate = 0
            refreshProgress.errors = []
            refreshProgress.successes = []
        }, 30000) // Keep for 30 seconds after completion

        return finalResult
    } catch (error) {
        logger.error('[AssetMetadata] ❌ Refresh cycle failed:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })

        // Reset progress tracker on error
        refreshProgress.isRunning = false
        refreshProgress.current = 0
        refreshProgress.total = 0
        refreshProgress.currentSymbol = undefined

        throw error
    }
}

/**
 * Retry incomplete assets that failed due to rate limit errors
 * This runs separately from the main refresh cycle to give rate-limited assets another chance
 */
export const retryRateLimitedAssets = async (): Promise<{ retried: number; succeeded: number; failed: number }> => {
    const now = Date.now()
    logger.info('[AssetMetadata] 🔄 Starting retry cycle for rate-limited incomplete assets')

    try {
        // Find incomplete assets that failed due to rate limits
        const rateLimitedAssets = await prisma.asset.findMany({
            where: {
                isComplete: false,
                lastFailureReason: 'RATE_LIMIT',
                coingeckoId: { not: null }, // Must have CoinGecko ID to retry
            },
            orderBy: { updatedAt: 'asc' }, // Retry oldest failures first
        })

        if (rateLimitedAssets.length === 0) {
            logger.debug('[AssetMetadata] No rate-limited assets to retry')
            return { retried: 0, succeeded: 0, failed: 0 }
        }

        logger.info(`[AssetMetadata] Found ${rateLimitedAssets.length} rate-limited assets to retry`)

        let succeeded = 0
        let failed = 0

        // Retry each asset with rate limiting (3s gap between requests)
        for (let i = 0; i < rateLimitedAssets.length; i++) {
            const asset = rateLimitedAssets[i]
            const progress = `[${i + 1}/${rateLimitedAssets.length}]`

            try {
                logger.info(`[AssetMetadata] ${progress} Retrying ${asset.baseSymbol}...`)
                const result = await refreshSingleAsset(asset)

                if (result.success) {
                    succeeded++
                    logger.info(`[AssetMetadata] ${progress} ✅ ${asset.baseSymbol} retry succeeded`)
                } else {
                    failed++
                    logger.warn(`[AssetMetadata] ${progress} ❌ ${asset.baseSymbol} retry failed: ${result.reason}`)
                }

                // Rate limit: wait 3 seconds between requests (except for last one)
                if (i < rateLimitedAssets.length - 1) {
                    await sleep(REQUEST_GAP_MS)
                }
            } catch (error) {
                failed++
                logger.error(`[AssetMetadata] ${progress} ❌ Unexpected error retrying ${asset.baseSymbol}:`, error)
            }
        }

        const elapsedMs = Date.now() - now
        logger.info(`[AssetMetadata] ✅ Rate limit retry cycle complete`, {
            retried: rateLimitedAssets.length,
            succeeded,
            failed,
            elapsedMs,
        })

        return { retried: rateLimitedAssets.length, succeeded, failed }
    } catch (error) {
        logger.error('[AssetMetadata] ❌ Rate limit retry cycle failed:', error)
        return { retried: 0, succeeded: 0, failed: 0 }
    }
}

