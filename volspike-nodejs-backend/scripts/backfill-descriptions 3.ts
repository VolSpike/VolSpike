/**
 * Asset description backfill script.
 *
 * Usage examples:
 *   DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts
 *   DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts --limit=50
 *   DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts --symbols=BTC,ETH,SOL
 *   DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts --allow-overwrite
 *   DATABASE_URL="postgres://..." npx tsx scripts/backfill-descriptions.ts --dry-run
 */

import axios, { AxiosError } from 'axios'
import { PrismaClient, AssetStatus } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

const DEFAULT_DELAY_MS = Number(process.env.ASSET_BACKFILL_DELAY_MS ?? '3500')
const RATE_LIMIT_BACKOFF_MS = Number(process.env.ASSET_BACKFILL_RATE_LIMIT_BACKOFF_MS ?? '60000')
const COINGECKO_API = (process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3').replace(/\/$/, '')

interface ScriptOptions {
    limit?: number
    allowOverwrite: boolean
    dryRun: boolean
    delayMs: number
    symbols: string[]
    resumeAfter?: string
}

interface AssetRecordLite {
    id: string
    baseSymbol: string
    coingeckoId: string | null
    description: string | null
    displayName: string | null
    websiteUrl: string | null
    twitterUrl: string | null
    status: AssetStatus
}

interface ProcessStats {
    considered: number
    processed: number
    updated: number
    dryRuns: number
    skippedHasDescription: number
    skippedVerified: number
    skippedNoProfile: number
    skippedNoDescription: number
    noMatch: number
    rateLimited: number
    errors: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseArgs = (): ScriptOptions => {
    const options: ScriptOptions = {
        allowOverwrite: false,
        dryRun: false,
        delayMs: DEFAULT_DELAY_MS,
        symbols: [],
    }

    for (const raw of process.argv.slice(2)) {
        const arg = raw.trim()
        if (!arg) continue

        if (arg === '--allow-overwrite') {
            options.allowOverwrite = true
        } else if (arg === '--dry-run') {
            options.dryRun = true
        } else if (arg.startsWith('--limit=')) {
            const value = Number(arg.split('=')[1])
            if (Number.isFinite(value) && value > 0) {
                options.limit = Math.floor(value)
            }
        } else if (arg.startsWith('--delay=')) {
            const value = Number(arg.split('=')[1])
            if (Number.isFinite(value) && value >= 0) {
                options.delayMs = Math.floor(value)
            }
        } else if (arg.startsWith('--symbols=')) {
            const list = arg.split('=')[1]
            if (list) {
                options.symbols = list
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean)
            }
        } else if (arg.startsWith('--resume-after=')) {
            const symbol = arg.split('=')[1]
            if (symbol) {
                options.resumeAfter = symbol.trim().toUpperCase()
            }
        } else {
            console.warn(`[Backfill] Unknown argument ignored: ${arg}`)
        }
    }

    return options
}

const options = parseArgs()

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required. Set it via environment variable before running this script.')
    process.exit(1)
}

console.log('📦 Asset description backfill starting...')
console.log(
    JSON.stringify(
        {
            limit: options.limit ?? 'ALL',
            allowOverwrite: options.allowOverwrite,
            dryRun: options.dryRun,
            delayMs: options.delayMs,
            symbols: options.symbols.length ? options.symbols : 'ALL',
            resumeAfter: options.resumeAfter ?? 'NONE',
            coingeckoApi: COINGECKO_API,
        },
        null,
        2,
    ),
)

const pickCoingeckoId = async (baseSymbol: string, knownId?: string | null): Promise<{ id?: string; source: 'override' | 'search' }> => {
    if (knownId) return { id: knownId, source: 'override' }

    const query = baseSymbol.toUpperCase()

    try {
        const { data } = await axios.get(`${COINGECKO_API}/search`, {
            params: { query },
            timeout: 8000,
        })

        const coins: any[] = Array.isArray(data?.coins) ? data.coins : []
        if (!coins.length) {
            return { id: undefined, source: 'search' }
        }

        const candidates = coins.filter((c) => (c?.symbol || '').toUpperCase() === query)
        const ranked = (candidates.length ? candidates : coins)
            .slice()
            .sort((a: any, b: any) => {
                const rankA = typeof a.market_cap_rank === 'number' ? a.market_cap_rank : Number.MAX_SAFE_INTEGER
                const rankB = typeof b.market_cap_rank === 'number' ? b.market_cap_rank : Number.MAX_SAFE_INTEGER
                return rankA - rankB
            })

        return { id: ranked[0]?.id, source: 'search' }
    } catch (error) {
        console.warn(`[Backfill] CoinGecko search failed for ${query}:`, {
            message: error instanceof Error ? error.message : String(error),
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
        timeout: 10000,
    })

    const homepage: string | undefined = Array.isArray(data?.links?.homepage)
        ? data.links.homepage.find((url: string | null | undefined) => !!url?.trim())
        : undefined

    const twitterName: string | undefined = data?.links?.twitter_screen_name
        ? String(data.links.twitter_screen_name).trim()
        : undefined

    const twitterUrl = twitterName ? `https://x.com/${twitterName}` : undefined

    const rawDescription = typeof data?.description?.en === 'string' ? data.description.en : data?.description
    const description: string | undefined = typeof rawDescription === 'string' ? rawDescription : undefined

    return {
        name: data?.name as string | undefined,
        description: description?.trim(),
        homepage,
        twitterUrl,
    }
}

const isRateLimitError = (error: unknown): error is AxiosError => {
    return axios.isAxiosError(error) && error.response?.status === 429
}

const processAsset = async (asset: AssetRecordLite, attempt = 1): Promise<{ status: 'updated'; fields: string[] } | { status: 'skipped'; reason: string } | { status: 'error'; error: unknown }> => {
    if (!options.allowOverwrite) {
        if (asset.status === 'VERIFIED') {
            return { status: 'skipped', reason: 'verified' }
        }
        if (asset.description && asset.description.trim().length > 0) {
            return { status: 'skipped', reason: 'has-description' }
        }
    }

    try {
        const { id: coingeckoId, source } = await pickCoingeckoId(asset.baseSymbol, asset.coingeckoId)

        if (!coingeckoId) {
            return { status: 'skipped', reason: 'no-coingecko-match' }
        }

        const profile = await fetchCoinProfile(coingeckoId)

        if (!profile.description || profile.description.trim().length < 20) {
            return { status: 'skipped', reason: 'empty-description' }
        }

        const payload: Record<string, any> = {}
        payload.description = profile.description

        if (!asset.displayName && profile.name) {
            payload.displayName = profile.name
        }
        if (!asset.websiteUrl && profile.homepage) {
            payload.websiteUrl = profile.homepage
        }
        if (!asset.twitterUrl && profile.twitterUrl) {
            payload.twitterUrl = profile.twitterUrl
        }
        if (!asset.coingeckoId || source === 'search') {
            payload.coingeckoId = coingeckoId
        }

        const updatedFields = Object.keys(payload)

        if (!updatedFields.length) {
            return { status: 'skipped', reason: 'no-updates-needed' }
        }

        if (options.dryRun) {
            console.log(`[Backfill] (dry-run) ${asset.baseSymbol}: would update fields ${updatedFields.join(', ')}`)
            return { status: 'updated', fields: updatedFields }
        }

        await prisma.asset.update({
            where: { id: asset.id },
            data: payload,
        })

        console.log(
            `[Backfill] ✅ ${asset.baseSymbol} updated (${updatedFields.join(', ')})`,
            source === 'override' ? '' : `(CoinGecko: ${coingeckoId})`,
        )

        return { status: 'updated', fields: updatedFields }
    } catch (error) {
        if (isRateLimitError(error) && attempt <= 3) {
            const waitMs = RATE_LIMIT_BACKOFF_MS * attempt
            console.warn(`[Backfill] ⚠️ Rate limited on ${asset.baseSymbol}. Waiting ${waitMs / 1000}s before retry (attempt ${attempt}/3)...`)
            await sleep(waitMs)
            return processAsset(asset, attempt + 1)
        }

        return { status: 'error', error }
    }
}

const main = async () => {
    const totalAssets = await prisma.asset.count()
    const withoutDescription = await prisma.asset.count({
        where: {
            OR: [{ description: null }, { description: '' }],
        },
    })

    console.log(`📊 Database contains ${totalAssets} assets (${withoutDescription} missing descriptions)\n`)

    let assets = await prisma.asset.findMany({
        select: {
            id: true,
            baseSymbol: true,
            coingeckoId: true,
            description: true,
            displayName: true,
            websiteUrl: true,
            twitterUrl: true,
            status: true,
        },
        orderBy: { baseSymbol: 'asc' },
    })

    if (options.symbols.length) {
        const allowed = new Set(options.symbols.map((s) => s.toUpperCase()))
        assets = assets.filter((asset) => allowed.has(asset.baseSymbol.toUpperCase()))
    }

    if (options.resumeAfter) {
        assets = assets.filter((asset) => asset.baseSymbol.toUpperCase() > options.resumeAfter!)
    }

    if (!options.allowOverwrite) {
        assets = assets.filter((asset) => !asset.description || asset.description.trim().length === 0)
    }

    if (options.limit) {
        assets = assets.slice(0, options.limit)
    }

    if (assets.length === 0) {
        console.log('✨ Nothing to do – no assets match the provided filters.')
        return
    }

    console.log(`🚀 Processing ${assets.length} asset${assets.length === 1 ? '' : 's'}...\n`)

    const stats: ProcessStats = {
        considered: assets.length,
        processed: 0,
        updated: 0,
        dryRuns: 0,
        skippedHasDescription: 0,
        skippedVerified: 0,
        skippedNoProfile: 0,
        skippedNoDescription: 0,
        noMatch: 0,
        rateLimited: 0,
        errors: 0,
    }

    for (let index = 0; index < assets.length; index++) {
        const asset = assets[index]
        const label = `[${index + 1}/${assets.length}] ${asset.baseSymbol}`
        console.log(`${label} · starting`)

        const result = await processAsset(asset)

        stats.processed += 1

        if (result.status === 'updated') {
            if (options.dryRun) {
                stats.dryRuns += 1
            } else {
                stats.updated += 1
            }
        } else if (result.status === 'skipped') {
            switch (result.reason) {
                case 'has-description':
                    stats.skippedHasDescription += 1
                    console.log(`${label} · skipped (already has description)`)
                    break
                case 'verified':
                    stats.skippedVerified += 1
                    console.log(`${label} · skipped (verified asset)`)
                    break
                case 'no-coingecko-match':
                    stats.noMatch += 1
                    console.warn(`${label} · skipped (no CoinGecko match found)`)
                    break
                case 'empty-description':
                    stats.skippedNoDescription += 1
                    console.warn(`${label} · skipped (CoinGecko returned empty description)`)
                    break
                default:
                    stats.skippedNoProfile += 1
                    console.warn(`${label} · skipped (${result.reason})`)
            }
        } else if (result.status === 'error') {
            stats.errors += 1
            if (isRateLimitError(result.error)) {
                stats.rateLimited += 1
            }
            console.error(`${label} · failed`, result.error)
        }

        if (index < assets.length - 1) {
            await sleep(options.delayMs)
        }
    }

    console.log('\n📈 Backfill summary:')
    console.table({
        Considered: stats.considered,
        Processed: stats.processed,
        Updated: stats.updated,
        DryRunUpdates: stats.dryRuns,
        SkippedVerified: stats.skippedVerified,
        SkippedHasDescription: stats.skippedHasDescription,
        SkippedEmptyDescription: stats.skippedNoDescription,
        SkippedNoMatch: stats.noMatch,
        Errors: stats.errors,
        RateLimited: stats.rateLimited,
    })

    console.log('✅ Backfill complete.')
}

main()
    .catch((error) => {
        console.error('❌ Backfill failed:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


