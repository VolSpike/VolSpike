#!/usr/bin/env ts-node

/**
 * One-time script to populate logoImageUrl field for all existing assets
 * 
 * Why manual refresh works but script doesn't:
 * - Manual refresh: User clicks are naturally spaced out (10-30 seconds)
 * - Script: Continuous requests need longer delays to avoid CoinGecko's rolling rate limit window
 * - Solution: Use same retry logic as refreshSingleAsset + 15 second delay (4 calls/minute)
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import axios from 'axios'
import { createLogger } from '../src/lib/logger'

// Load environment variables from .env file (if exists)
config({ path: resolve(__dirname, '../.env') })

// Allow DATABASE_URL to be overridden via environment variable for production
const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL or PRODUCTION_DATABASE_URL must be set')
    process.exit(1)
}

console.log(`📡 Connecting to database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`)

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL,
        },
    },
})

const logger = createLogger()
const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const REQUEST_GAP_MS = 15000 // 15 seconds between requests (4 calls/minute, very conservative)
// Manual refreshes work because they're naturally spaced out by user clicks (10-30 seconds)
// Script needs longer delay to avoid hitting CoinGecko's rolling rate limit window

interface CoinGeckoImageResponse {
    image?: {
        large?: string
        small?: string
        thumb?: string
    }
}

/**
 * Fetch CoinGecko image URL with exponential backoff retry logic
 * This matches the retry logic used in refreshSingleAsset
 */
async function fetchCoinGeckoImageUrl(coingeckoId: string, retryCount: number = 0): Promise<string | null> {
    const maxRetries = 3
    const baseDelay = 5000 // 5 seconds base delay (matches refreshSingleAsset)
    
    try {
        const { data } = await axios.get<CoinGeckoImageResponse>(
            `${COINGECKO_API}/coins/${encodeURIComponent(coingeckoId)}`,
            {
                params: {
                    localization: 'false',
                    tickers: 'false',
                    market_data: 'false',
                    community_data: 'false',
                    developer_data: 'false',
                    sparkline: 'false',
                },
                timeout: 10000,
            }
        )

        // Prefer high-quality logo images: large > small > thumb (matches refreshSingleAsset)
        const logoUrl = data?.image?.large || data?.image?.small || data?.image?.thumb || null
        
        if (!logoUrl) {
            logger.debug(`No image URL found in CoinGecko response for ${coingeckoId}`)
        }
        
        return logoUrl
    } catch (error: any) {
        if (error.response?.status === 404) {
            logger.warn(`CoinGecko ID not found: ${coingeckoId}`)
            return null
        }
        
        // Exponential backoff retry on rate limit (matches refreshSingleAsset logic)
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff: 5s, 10s, 20s
            logger.warn(`Rate limited (429) for ${coingeckoId}, waiting ${delay}ms before retry ${retryCount + 1}/${maxRetries}...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            return fetchCoinGeckoImageUrl(coingeckoId, retryCount + 1)
        }
        
        logger.error(`Error fetching ${coingeckoId}:`, {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            retryCount,
        })
        return null
    }
}

async function populateLogoImageUrls() {
    console.log('🚀 Starting logoImageUrl population...\n')
    console.log('📝 Using same retry logic as refreshSingleAsset with 15s delay (4 calls/minute)\n')

    // Find all assets that have coingeckoId but no logoImageUrl
    const assets = await prisma.asset.findMany({
        where: {
            coingeckoId: { not: null },
            OR: [
                { logoImageUrl: null },
                { logoImageUrl: '' },
            ],
        },
    })

    console.log(`Found ${assets.length} assets that need logoImageUrl\n`)

    if (assets.length === 0) {
        console.log('✅ All assets already have logoImageUrl!')
        await prisma.$disconnect()
        return
    }

    let updated = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i]
        const progress = `[${i + 1}/${assets.length}]`

        if (!asset.coingeckoId) {
            console.log(`${progress} ⏭️  Skipping ${asset.baseSymbol} (no CoinGecko ID)`)
            skipped++
            continue
        }

        console.log(`${progress} 🔍 Fetching logo URL for ${asset.baseSymbol} (${asset.coingeckoId})...`)

        const logoImageUrl = await fetchCoinGeckoImageUrl(asset.coingeckoId)

        if (logoImageUrl) {
            try {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: { logoImageUrl },
                })
                console.log(`  ✅ Updated ${asset.baseSymbol}: ${logoImageUrl.substring(0, 70)}...`)
                updated++
            } catch (error: any) {
                console.log(`  ❌ Failed to update database for ${asset.baseSymbol}: ${error.message}`)
                failed++
            }
        } else {
            // Check if asset already has a base64 logoUrl - if so, it's not critical
            const assetWithLogo = await prisma.asset.findUnique({
                where: { id: asset.id },
                select: { logoUrl: true },
            })
            
            if (assetWithLogo?.logoUrl) {
                console.log(`  ⚠️  No CoinGecko URL found for ${asset.baseSymbol}, but base64 logo exists (will use that)`)
                skipped++ // Count as skipped, not failed - asset still has logo
            } else {
                console.log(`  ⚠️  No logo URL found for ${asset.baseSymbol} (CoinGecko may not have image for this ID)`)
                failed++
            }
        }

        // Rate limiting: wait 15 seconds between requests (4 calls/minute)
        // This is much slower than manual refresh, but necessary for bulk operations
        // Manual refreshes work because they're naturally spaced out by user clicks (10-30 seconds)
        // CoinGecko free tier has a rolling window rate limit, so continuous requests need longer delays
        if (i < assets.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS))
        }
    }

    console.log('\n📊 Summary:')
    console.log(`  ✅ Updated: ${updated}`)
    console.log(`  ⏭️  Skipped: ${skipped}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📦 Total: ${assets.length}`)

    await prisma.$disconnect()
    console.log('\n✅ Done!')
}

populateLogoImageUrls().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
})
