#!/usr/bin/env ts-node

/**
 * One-time script to populate logoImageUrl field for all existing assets
 * Uses the existing refreshSingleAsset function which has proper retry logic
 * and rate limiting built-in
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file (if exists)
config({ path: resolve(__dirname, '../.env') })

// Import the refresh function which has proper CoinGecko handling
// We need to set up the prisma instance first
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

// Import the refresh function
// We need to patch the prisma import in asset-metadata.ts to use our custom instance
// First, let's import the module and patch it
import * as assetMetadataModule from '../src/services/asset-metadata'
import axios from 'axios'
import { createLogger } from '../src/lib/logger'

const logger = createLogger()
const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const REQUEST_GAP_MS = 12000 // 12 seconds between requests (5 calls/minute, very conservative for CoinGecko free tier)
// Manual refreshes work because they're naturally spaced out by user clicks (10-30 seconds)
// Script needs longer delay to avoid hitting CoinGecko's rolling rate limit window

// Patch prisma import in asset-metadata module to use our custom instance
// @ts-ignore - We're intentionally patching the module's prisma import
assetMetadataModule.prisma = prisma

interface CoinGeckoImageResponse {
    image?: {
        large?: string
        small?: string
        thumb?: string
    }
}

async function fetchCoinGeckoImageUrl(coingeckoId: string, retryCount: number = 0): Promise<string | null> {
    const maxRetries = 3
    const baseDelay = 5000 // 5 seconds base delay
    
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

        // Debug: Log what CoinGecko actually returned
        if (!data?.image) {
            console.log(`  ⚠️  CoinGecko response for ${coingeckoId} has no 'image' field`)
            console.log(`  ⚠️  Response keys:`, Object.keys(data || {}).slice(0, 10))
            return null
        }

        // Prefer high-quality logo images: large > small > thumb
        const logoUrl = data?.image?.large || data?.image?.small || data?.image?.thumb || null
        
        if (!logoUrl) {
            console.log(`  ⚠️  No image URL found in CoinGecko response for ${coingeckoId}`)
            console.log(`  ⚠️  Image object keys:`, data?.image ? Object.keys(data.image) : 'null')
            console.log(`  ⚠️  Image object:`, JSON.stringify(data?.image, null, 2).substring(0, 200))
        }
        
        return logoUrl
    } catch (error: any) {
        if (error.response?.status === 404) {
            logger.warn(`CoinGecko ID not found: ${coingeckoId}`)
            return null
        }
        
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff: 5s, 10s, 20s
            console.log(`  ⚠️  Rate limited (429) for ${coingeckoId}, waiting ${delay}ms before retry ${retryCount + 1}/${maxRetries}...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            // Retry with incremented retry count
            return fetchCoinGeckoImageUrl(coingeckoId, retryCount + 1)
        }
        
        // Log detailed error info
        console.log(`  ❌ Error fetching ${coingeckoId}:`, {
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
    console.log('📝 Using refreshSingleAsset function which has proper retry logic and rate limiting\n')

    // Find all assets that have coingeckoId but no logoImageUrl
    // Get full asset objects needed for refreshSingleAsset
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

        console.log(`${progress} 🔄 Refreshing ${asset.baseSymbol} (CoinGecko ID: ${asset.coingeckoId})...`)

        // Use refreshSingleAsset which has proper retry logic and exponential backoff
        // This is the same function used by manual refresh, so it should work identically
        const result = await assetMetadataModule.refreshSingleAsset(asset, true) // Force refresh

        if (result.success) {
            // Re-fetch the asset to get the updated logoImageUrl
            const updatedAsset = await prisma.asset.findUnique({
                where: { id: asset.id },
                select: { logoImageUrl: true, baseSymbol: true },
            })
            if (updatedAsset?.logoImageUrl) {
                console.log(`  ✅ Updated ${updatedAsset.baseSymbol}: ${updatedAsset.logoImageUrl.substring(0, 70)}...`)
                updated++
            } else {
                console.log(`  ⚠️  Refreshed ${asset.baseSymbol}, but logoImageUrl still not found. Reason: ${result.reason || 'Unknown'}`)
                // Check if asset has base64 logo as fallback
                const assetWithLogo = await prisma.asset.findUnique({
                    where: { id: asset.id },
                    select: { logoUrl: true },
                })
                if (assetWithLogo?.logoUrl) {
                    console.log(`  ℹ️  Asset has base64 logo (will use that)`)
                    skipped++
                } else {
                    failed++
                }
            }
        } else {
            console.log(`  ❌ Failed to refresh ${asset.baseSymbol}. Reason: ${result.reason || 'Unknown'}. Error: ${result.error || 'N/A'}`)
            failed++
        }

        // Rate limiting: wait 12 seconds between requests (5 calls/minute)
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

