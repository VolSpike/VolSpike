import { useEffect, useState } from 'react'
import { STATIC_ASSET_MANIFEST } from '@/lib/asset-manifest'
import { rateLimitedFetch } from '@/lib/coingecko-rate-limiter'

export interface AssetProfile {
    id: string
    symbol: string
    name: string
    logoUrl?: string
    websiteUrl?: string
    twitterUrl?: string
    description?: string
    categories?: string[]
}

interface UseAssetProfileResult {
    profile?: AssetProfile
    loading: boolean
    error?: string | null
}

const CACHE_KEY = 'volspike-asset-profile-cache-v1'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

interface CacheEntry {
    profile: AssetProfile
    updatedAt: number
}

interface CacheShape {
    [symbol: string]: CacheEntry
}

let memoryCache: CacheShape | null = null
const inflightPrefetches: Record<string, Promise<void>> = {}

type AssetProfileOverride = Partial<AssetProfile> & {
    coingeckoId?: string
}

// Hand-tuned overrides for assets where CoinGecko metadata is missing
// or we want to guarantee a stable mapping from symbol -> CoinGecko id.
const SYMBOL_OVERRIDES: Record<string, AssetProfileOverride> = {
    // Seeded from STATIC_ASSET_MANIFEST to keep the hook
    // self-contained even before admin data is populated.
    ...Object.fromEntries(
        Object.entries(STATIC_ASSET_MANIFEST).map(([symbol, asset]) => [
            symbol,
            {
                coingeckoId: asset.coingeckoId ?? undefined,
                name: asset.displayName ?? asset.baseSymbol,
                websiteUrl: asset.websiteUrl ?? undefined,
                twitterUrl: asset.twitterUrl ?? undefined,
                logoUrl: asset.logoUrl ?? undefined,
            } satisfies AssetProfileOverride,
        ])
    ),
}

const safeParseCache = (): CacheShape => {
    if (memoryCache) return memoryCache
    if (typeof window === 'undefined') return {}
    try {
        const raw = window.localStorage.getItem(CACHE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as CacheShape
        if (parsed && typeof parsed === 'object') {
            memoryCache = parsed
            return parsed
        }
        return {}
    } catch {
        return {}
    }
}

const writeCache = (symbol: string, profile: AssetProfile) => {
    if (typeof window === 'undefined') return
    try {
        const existing = safeParseCache()
        existing[symbol] = { profile, updatedAt: Date.now() }
        memoryCache = existing
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(existing))
    } catch {
        // Ignore cache write errors
    }
}

export const prefetchAssetProfile = (symbol: string): void => {
    if (typeof window === 'undefined') return
    const upper = symbol.toUpperCase()
    const cache = safeParseCache()
    const entry = cache[upper]
    const now = Date.now()

    // Fresh enough: nothing to do
    if (entry && now - entry.updatedAt < CACHE_TTL_MS) {
        return
    }

    // Already fetching: reuse existing promise
    if (upper in inflightPrefetches) {
        return
    }

    inflightPrefetches[upper] = (async () => {
        try {
            const profile = await fetchProfileFromCoinGecko(upper)
            if (profile) {
                writeCache(upper, profile)
            }
        } catch {
            // Ignore prefetch errors – UI will fall back to on-demand fetch
        } finally {
            delete inflightPrefetches[upper]
        }
    })()
}

const stripHtml = (html: string): string => {
    if (!html) return ''
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

const shorten = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    const truncated = text.slice(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trimEnd() + '…'
}

const fetchProfileFromCoinGecko = async (symbol: string): Promise<AssetProfile | undefined> => {
    const upper = symbol.toUpperCase()
    const override = SYMBOL_OVERRIDES[upper]

    let coingeckoId: string | undefined = override?.coingeckoId

    if (!coingeckoId) {
        try {
            // First, search by symbol to get a CoinGecko id (rate-limited)
            const searchRes = await rateLimitedFetch(
                `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(upper)}`,
                undefined,
                'normal'
            )

            const searchJson = (await searchRes.json()) as any
            let coins: any[] = Array.isArray(searchJson?.coins) ? searchJson.coins : []

            // If nothing comes back for the raw perp symbol (e.g. 1000PEPE),
            // try a de-multiplied variant like PEPE as a second pass.
            if (!coins.length) {
                const multiplierMatch = /^(10|100|1000|10000)([A-Z0-9]+)$/.exec(upper)
                const stripped = multiplierMatch?.[2]

                if (stripped && stripped !== upper) {
                    try {
                        const altRes = await rateLimitedFetch(
                            `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(stripped)}`,
                            undefined,
                            'low' // Lower priority for fallback search
                        )
                        if (altRes.ok) {
                            const altJson = (await altRes.json()) as any
                            const altCoins: any[] = Array.isArray(altJson?.coins) ? altJson.coins : []
                            if (altCoins.length) {
                                coins = altCoins
                            }
                        }
                    } catch (altError) {
                        // Ignore fallback search errors
                        console.debug(`[use-asset-profile] Fallback search failed for ${stripped}:`, altError)
                    }
                }
            }

            if (!coins.length) {
                // No coins found - use override if available
                if (override) {
                    return {
                        id: override.id ?? upper,
                        symbol: upper,
                        name: override.name ?? upper,
                        logoUrl: override.logoUrl,
                        websiteUrl: override.websiteUrl,
                        twitterUrl: override.twitterUrl,
                        description: override.description,
                        categories: override.categories,
                    }
                }
                return undefined
            }

            // Prefer exact symbol matches and highest market cap rank / score
            const candidates = coins.filter((c) => (c?.symbol || '').toUpperCase() === upper)
            const ranked = (candidates.length ? candidates : coins).slice().sort((a: any, b: any) => {
                const rankA = typeof a.market_cap_rank === 'number' ? a.market_cap_rank : Number.MAX_SAFE_INTEGER
                const rankB = typeof b.market_cap_rank === 'number' ? b.market_cap_rank : Number.MAX_SAFE_INTEGER
                if (rankA !== rankB) return rankA - rankB
                const scoreA = typeof a.coingecko_score === 'number' ? -a.coingecko_score : 0
                const scoreB = typeof b.coingecko_score === 'number' ? -b.coingecko_score : 0
                return scoreA - scoreB
            })

            const chosen = ranked[0]
            coingeckoId = chosen?.id
        } catch (searchError: any) {
            // Handle rate limit or other errors gracefully
            console.warn(`[use-asset-profile] CoinGecko search failed for ${upper}:`, searchError)
            
            // Fallback to static override if we have one
            if (override) {
                return {
                    id: override.id ?? upper,
                    symbol: upper,
                    name: override.name ?? upper,
                    logoUrl: override.logoUrl,
                    websiteUrl: override.websiteUrl,
                    twitterUrl: override.twitterUrl,
                    description: override.description,
                    categories: override.categories,
                }
            }
            return undefined
        }
    }

    if (!coingeckoId) {
        if (override) {
            return {
                id: override.id ?? upper,
                symbol: upper,
                name: override.name ?? upper,
                logoUrl: override.logoUrl,
                websiteUrl: override.websiteUrl,
                twitterUrl: override.twitterUrl,
                description: override.description,
                categories: override.categories,
            }
        }
        return undefined
    }

    try {
        // Fetch coin details (rate-limited)
        const coinRes = await rateLimitedFetch(
            `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false&sparkline=false`,
            undefined,
            'normal'
        )

        const coin = (await coinRes.json()) as any

        const descriptionRaw = typeof coin?.description?.en === 'string' ? coin.description.en : ''
        const descriptionText = stripHtml(descriptionRaw)

        const homepage: string | undefined = Array.isArray(coin?.links?.homepage)
            ? coin.links.homepage.find((url: string | null | undefined) => !!url?.trim())
            : undefined

        const twitterName: string | undefined = coin?.links?.twitter_screen_name
            ? String(coin.links.twitter_screen_name).trim()
            : undefined

        const twitterUrl = twitterName ? `https://x.com/${twitterName}` : undefined

        const logoUrl: string | undefined =
            coin?.image?.small || coin?.image?.thumb || coin?.image?.large || undefined

        const categories: string[] | undefined = Array.isArray(coin?.categories)
            ? coin.categories.filter((c: unknown) => typeof c === 'string' && c.trim().length > 0)
            : undefined

        const baseProfile: AssetProfile = {
            id: String(coin.id || coingeckoId),
            symbol: upper,
            name: String(coin.name || upper),
            logoUrl,
            websiteUrl: homepage,
            twitterUrl,
            description: descriptionText || undefined,
            categories,
        }

        const merged: AssetProfile = {
            ...baseProfile,
            ...override,
            id: override?.id ?? baseProfile.id,
            symbol: upper,
            name: override?.name ?? baseProfile.name,
            description: override?.description ?? baseProfile.description,
        }

        return merged
    } catch (coinError: any) {
        // Handle rate limit or other errors gracefully
        console.warn(`[use-asset-profile] CoinGecko coin fetch failed for ${coingeckoId}:`, coinError)
        
        // Fallback to override if available
        if (override) {
            return {
                id: override.id ?? upper,
                symbol: upper,
                name: override.name ?? upper,
                logoUrl: override.logoUrl,
                websiteUrl: override.websiteUrl,
                twitterUrl: override.twitterUrl,
                description: override.description,
                categories: override.categories,
            }
        }
        return undefined
    }
}

export function useAssetProfile(symbol?: string | null): UseAssetProfileResult {
    const [state, setState] = useState<UseAssetProfileResult>({ loading: !!symbol })

    useEffect(() => {
        if (!symbol) {
            setState({ loading: false, profile: undefined, error: null })
            return
        }

        let cancelled = false
        const upper = symbol.toUpperCase()

        const run = async () => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const cache = safeParseCache()
                const entry = cache[upper]
                const now = Date.now()

                if (entry) {
                    const isFresh = now - entry.updatedAt < CACHE_TTL_MS
                    if (!cancelled) {
                        // Always show cached data immediately; if it's stale,
                        // keep loading=true while we revalidate in the background.
                        setState({
                            loading: !isFresh,
                            profile: entry.profile,
                            error: null,
                        })
                    }
                    if (isFresh) {
                        return
                    }
                }

                const profile = await fetchProfileFromCoinGecko(upper)

                if (!cancelled) {
                    if (profile) {
                        writeCache(upper, profile)
                        setState({ loading: false, profile, error: null })
                    } else {
                        setState((prev) => ({
                            loading: false,
                            profile: prev.profile,
                            error: null,
                        }))
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setState({ loading: false, profile: undefined, error: (err as Error).message })
                }
            }
        }

        run()

        return () => {
            cancelled = true
        }
    }, [symbol])

    return state
}
