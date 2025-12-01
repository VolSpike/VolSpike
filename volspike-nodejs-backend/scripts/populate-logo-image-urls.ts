#!/usr/bin/env ts-node

/**
 * One-time script to populate logoImageUrl field for all existing assets
 * Uses refreshSingleAsset function which has proper retry logic and exponential backoff
 * 
 * Why manual refresh works but script doesn't:
 * - Manual refresh: User clicks are naturally spaced out (10-30 seconds)
 * - Script: Continuous requests need longer delays to avoid CoinGecko's rolling rate limit window
 * - Solution: Use same refreshSingleAsset function + 12 second delay (5 calls/minute)
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file (if exists)
config({ path: resolve(__dirname, '../.env') })

// Allow DATABASE_URL to be overridden via environment variable for production
// Priority: PRODUCTION_DATABASE_URL > DATABASE_URL from .env
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

// Import refreshSingleAsset - we'll need to patch prisma import
// Since asset-metadata.ts imports prisma from '../index', we need to create a mock
import { refreshSingleAsset } from '../src/services/asset-metadata'

// The issue: refreshSingleAsset uses prisma from '../index', but we have a custom instance
// Solution: We'll temporarily replace the prisma export in the index module
// This is a bit hacky but necessary for scripts with custom DATABASE_URL
const originalIndex = require('../src/index')
const originalPrisma = originalIndex.prisma

// Temporarily replace prisma in the index module
// @ts-ignore - We're intentionally patching the module
originalIndex.prisma = prisma

const REQUEST_GAP_MS = 12000 // 12 seconds between requests (5 calls/minute, very conservative)
// Manual refreshes work because they're naturally spaced out by user clicks (10-30 seconds)
// Script needs longer delay to avoid hitting CoinGecko's rolling rate limit window

async function populateLogoImageUrls() {
    console.log('🚀 Starting logoImageUrl population...\n')
    console.log('📝 Using refreshSingleAsset function (same as manual refresh) with 12s delay\n')

    // Find all assets that have coingeckoId but no logoImageUrl
    const assets = await prisma.asset.findMany({
        where: {
            coingeckoId: { not: null },
            OR: [
                { logoImageUrl: null },
                { logoImageUrl: '' },
            ],
        },
        // Select all fields needed by refreshSingleAsset
        select: {
            id: true,
            baseSymbol: true,
            binanceSymbol: true,
            extraSymbols: true,
            coingeckoId: true,
            displayName: true,
            description: true,
            websiteUrl: true,
            twitterUrl: true,
            logoUrl: true,
            logoImageUrl: true,
            status: true,
            isComplete: true,
            lastFailureReason: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
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

        console.log(`${progress} 🔄 Refreshing ${asset.baseSymbol} (${asset.coingeckoId}) to populate logoImageUrl...`)

        // Use refreshSingleAsset which has proper retry logic and exponential backoff
        // This is the same function used by manual refresh, so it should work identically
        try {
            const result = await refreshSingleAsset(asset as any, true) // Force refresh

            if (result.success) {
                // Re-fetch the asset to get the updated logoImageUrl
                const updatedAsset = await prisma.asset.findUnique({
                    where: { id: asset.id },
                    select: { logoImageUrl: true, baseSymbol: true },
                })
                if (updatedAsset?.logoImageUrl) {
                    console.log(`  ✅ Updated ${updatedAsset.baseSymbol}: ${updatedAsset.logoImageUrl.substring(0, 60)}...`)
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
        } catch (error: any) {
            console.log(`  ❌ Unexpected error refreshing ${asset.baseSymbol}: ${error.message}`)
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

    // Restore original prisma
    // @ts-ignore
    originalIndex.prisma = originalPrisma

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
