import axios from 'axios'
import type { Asset, AssetStatus } from '@prisma/client'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'

const logger = createLogger()

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const BINANCE_FUTURES_INFO = 'https://fapi.binance.com/fapi/v1/exchangeInfo'

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
const MAX_REFRESH_PER_RUN_BULK = 30 // Bulk mode: when many assets need refresh
const MAX_REFRESH_PER_RUN_MAINTENANCE = 15 // Maintenance mode: normal operation
const REQUEST_GAP_MS = 3000 // 3 seconds between requests (~20 calls/minute, safe for CoinGecko)
const MAX_NEW_SYMBOLS_PER_RUN = 60 // cap to avoid long startup loops

export interface AssetManifestEntry {
    baseSymbol: string
    binanceSymbol?: string | null
    extraSymbols?: string[]
    coingeckoId?: string | null
    displayName?: string | null
    websiteUrl?: string | null
    twitterUrl?: string | null
    logoUrl?: string | null
    status?: AssetStatus
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
        websiteUrl: asset.websiteUrl,
        twitterUrl: asset.twitterUrl,
        logoUrl: asset.logoUrl,
        status: asset.status,
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
    if (!asset.logoUrl || !asset.displayName || !asset.coingeckoId) return true
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

const fetchCoinProfile = async (coingeckoId: string) => {
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

    const homepage: string | undefined = Array.isArray(data?.links?.homepage)
        ? data.links.homepage.find((url: string | null | undefined) => !!url?.trim())
        : undefined

    const twitterName: string | undefined = data?.links?.twitter_screen_name
        ? String(data.links.twitter_screen_name).trim()
        : undefined

    const twitterUrl = twitterName ? `https://x.com/${twitterName}` : undefined

    const logoUrl: string | undefined = data?.image?.small || data?.image?.thumb || data?.image?.large || undefined

    // Extract description from CoinGecko (supports both 'en' localized and direct description)
    const description: string | undefined = data?.description?.en || data?.description || undefined

    return {
        name: data?.name as string | undefined,
        description,
        homepage,
        twitterUrl,
        logoUrl,
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

export const refreshSingleAsset = async (asset: Asset): Promise<boolean> => {
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
            return false
        }

        logger.debug(`[AssetMetadata] Found CoinGecko id for ${symbol}: ${coingeckoId} (source: ${source})`)

        const profile = await fetchCoinProfile(coingeckoId)
        logger.debug(`[AssetMetadata] Fetched profile for ${symbol}`, {
            hasName: !!profile.name,
            hasDescription: !!profile.description,
            hasHomepage: !!profile.homepage,
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

        if (allowOverwrite || !asset.displayName) {
            payload.displayName = profile.name || asset.displayName || symbol
        }
        if (allowOverwrite || !asset.description) {
            payload.description = profile.description ?? asset.description
        }
        if (allowOverwrite || !asset.websiteUrl) {
            payload.websiteUrl = profile.homepage ?? asset.websiteUrl
        }
        if (allowOverwrite || !asset.twitterUrl) {
            payload.twitterUrl = profile.twitterUrl ?? asset.twitterUrl
        }
        if (logoDataUrl && (allowOverwrite || !asset.logoUrl)) {
            payload.logoUrl = logoDataUrl
        }
        if (allowOverwrite || !asset.coingeckoId) {
            payload.coingeckoId = coingeckoId
        }

        if (!Object.keys(payload).length) {
            logger.debug(`[AssetMetadata] No updates needed for ${symbol} (all fields present and verified)`)
            return false
        }

        await prisma.asset.update({
            where: { id: asset.id },
            data: payload,
        })

        const elapsedMs = Date.now() - now
        logger.info(`[AssetMetadata] ✅ Refreshed ${symbol}`, {
            elapsedMs,
            updatedFields: Object.keys(payload),
            coingeckoId,
        })
        return true
    } catch (error) {
        const elapsedMs = Date.now() - now
        logger.warn(`[AssetMetadata] ❌ Failed to refresh ${symbol}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            elapsedMs,
        })
        return false
    }
}

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

export const runAssetRefreshCycle = async (reason: string = 'scheduled') => {
    const now = Date.now()
    logger.info(`[AssetMetadata] 🔄 Refresh cycle started (${reason})`)

    // Check if database is empty and sync Binance universe first
    const assetCount = await prisma.asset.count()
    if (assetCount === 0) {
        logger.info('[AssetMetadata] Database is empty, syncing Binance universe first...')
        const synced = await ensureBinanceUniverse()
        logger.info(`[AssetMetadata] Initial Binance sync completed: ${synced} assets created`)
    } else {
        // Ensure Binance universe is synced (non-blocking, runs in background)
        ensureBinanceUniverse().catch((error) => {
            logger.warn('[AssetMetadata] Binance universe sync failed (non-critical)', {
                error: error instanceof Error ? error.message : String(error),
            })
        })
    }

    const assets = await prisma.asset.findMany({
        orderBy: { updatedAt: 'asc' },
    })

    logger.debug(`[AssetMetadata] Found ${assets.length} total assets in database`)

    // Count how many assets need refresh to determine mode
    const assetsNeedingRefresh = assets.filter((asset) => shouldRefresh(asset, now))
    const needsRefreshCount = assetsNeedingRefresh.length

    // Adaptive batch size: bulk mode for initial setup, maintenance mode for normal operation
    const isBulkMode = needsRefreshCount > 20
    const maxPerRun = isBulkMode ? MAX_REFRESH_PER_RUN_BULK : MAX_REFRESH_PER_RUN_MAINTENANCE
    const mode = isBulkMode ? 'BULK' : 'MAINTENANCE'

    const candidates = assetsNeedingRefresh.slice(0, maxPerRun)

    if (!candidates.length) {
        logger.info('[AssetMetadata] ✅ No assets need refresh')
        return { refreshed: 0, candidates: [], total: assets.length, needsRefreshCount: 0 }
    }

    logger.info(`[AssetMetadata] 🔄 Mode: ${mode} | Found ${needsRefreshCount} assets needing refresh (processing ${candidates.length} this cycle)`)

    let refreshed = 0
    const results: Array<{ symbol: string; success: boolean; error?: string }> = []

    for (let i = 0; i < candidates.length; i++) {
        const asset = candidates[i]
        const progress = `[${i + 1}/${candidates.length}]`

        logger.info(`[AssetMetadata] ${progress} Processing ${asset.baseSymbol}...`)

        const updated = await refreshSingleAsset(asset)

        if (updated) {
            refreshed += 1
            results.push({ symbol: asset.baseSymbol, success: true })
            logger.info(`[AssetMetadata] ${progress} ✅ ${asset.baseSymbol} enriched (${refreshed} successful so far)`)
        } else {
            results.push({ symbol: asset.baseSymbol, success: false })
            logger.info(`[AssetMetadata] ${progress} ⚠️  ${asset.baseSymbol} skipped (no CoinGecko ID found)`)
        }

        // Rate limit: wait between requests (except for the last one)
        if (i < candidates.length - 1) {
            await sleep(REQUEST_GAP_MS)
        }
    }

    const elapsedMs = Date.now() - now
    const remaining = needsRefreshCount - refreshed
    logger.info(`[AssetMetadata] ✅ Refresh cycle complete`, {
        mode,
        refreshed,
        remaining,
        total: candidates.length,
        elapsedMs,
        reason,
    })

    return {
        refreshed,
        candidates: candidates.map((c) => c.baseSymbol),
        total: assets.length,
        needsRefreshCount,
        remaining,
        mode,
        results,
    }
}

