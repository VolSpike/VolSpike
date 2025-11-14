import { useEffect, useState } from 'react'

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

const safeParseCache = (): CacheShape => {
    if (typeof window === 'undefined') return {}
    try {
        const raw = window.localStorage.getItem(CACHE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as CacheShape
        if (parsed && typeof parsed === 'object') return parsed
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
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(existing))
    } catch {
        // Ignore cache write errors
    }
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

    // First, search by symbol to get a CoinGecko id
    const searchRes = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(upper)}`
    )

    if (!searchRes.ok) return undefined

    const searchJson = (await searchRes.json()) as any
    const coins: any[] = Array.isArray(searchJson?.coins) ? searchJson.coins : []

    if (!coins.length) return undefined

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
    if (!chosen?.id) return undefined

    const coinRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(chosen.id)}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false&sparkline=false`
    )

    if (!coinRes.ok) return undefined

    const coin = (await coinRes.json()) as any

    const descriptionRaw = typeof coin?.description?.en === 'string' ? coin.description.en : ''
    const descriptionText = shorten(stripHtml(descriptionRaw), 320)

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

    return {
        id: String(coin.id || chosen.id),
        symbol: upper,
        name: String(coin.name || chosen.name || upper),
        logoUrl,
        websiteUrl: homepage,
        twitterUrl,
        description: descriptionText || undefined,
        categories,
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

                if (entry && now - entry.updatedAt < CACHE_TTL_MS) {
                    if (!cancelled) {
                        setState({ loading: false, profile: entry.profile, error: null })
                    }
                    return
                }

                const profile = await fetchProfileFromCoinGecko(upper)

                if (!cancelled) {
                    if (profile) {
                        writeCache(upper, profile)
                        setState({ loading: false, profile, error: null })
                    } else {
                        setState({ loading: false, profile: undefined, error: null })
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
