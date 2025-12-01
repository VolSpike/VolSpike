#!/usr/bin/env ts-node

/**
 * One-time script to populate logoImageUrl field for all existing assets
 * This extracts CoinGecko image URLs and stores them in logoImageUrl field
 * for instant logo display without memory issues
 */

import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

interface CoinGeckoImageResponse {
    image?: {
        large?: string
        small?: string
        thumb?: string
    }
}

async function fetchCoinGeckoImageUrl(coingeckoId: string): Promise<string | null> {
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

        // Prefer high-quality logo images: large > small > thumb
        const logoUrl = data?.image?.large || data?.image?.small || data?.image?.thumb || null
        return logoUrl
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log(`  ⚠️  CoinGecko ID not found: ${coingeckoId}`)
            return null
        }
        if (error.response?.status === 429) {
            console.log(`  ⚠️  Rate limited, waiting 5 seconds...`)
            await new Promise((resolve) => setTimeout(resolve, 5000))
            // Retry once
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
                const logoUrl = data?.image?.large || data?.image?.small || data?.image?.thumb || null
                return logoUrl
            } catch (retryError) {
                console.log(`  ❌ Retry failed for ${coingeckoId}`)
                return null
            }
        }
        console.log(`  ❌ Error fetching ${coingeckoId}: ${error.message}`)
        return null
    }
}

async function populateLogoImageUrls() {
    console.log('🚀 Starting logoImageUrl population...\n')

    // Find all assets that have coingeckoId but no logoImageUrl
    const assets = await prisma.asset.findMany({
        where: {
            coingeckoId: { not: null },
            OR: [
                { logoImageUrl: null },
                { logoImageUrl: '' },
            ],
        },
        select: {
            id: true,
            baseSymbol: true,
            coingeckoId: true,
            logoImageUrl: true,
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
                console.log(`  ✅ Updated ${asset.baseSymbol}: ${logoImageUrl.substring(0, 60)}...`)
                updated++
            } catch (error: any) {
                console.log(`  ❌ Failed to update ${asset.baseSymbol}: ${error.message}`)
                failed++
            }
        } else {
            console.log(`  ⚠️  No logo URL found for ${asset.baseSymbol}`)
            failed++
        }

        // Rate limiting: wait 1.2 seconds between requests (50 requests per minute)
        if (i < assets.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200))
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

