import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()
const BINANCE_BASE_URL = 'https://fapi.binance.com'

async function testWatchlistEndpoint() {
    try {
        console.log('\n=== Testing Watchlist Market Data Endpoint ===\n')

        // Step 1: Find a watchlist with symbols
        const watchlist = await prisma.watchlist.findFirst({
            where: {
                name: {
                    contains: "Nik",
                    mode: 'insensitive',
                },
            },
            include: {
                items: {
                    include: {
                        contract: {
                            select: { symbol: true, isActive: true },
                        },
                    },
                },
                user: {
                    select: { id: true, email: true, tier: true },
                },
            },
        })

        if (!watchlist) {
            console.log('❌ No watchlist found with "Nik" in the name')
            const allWatchlists = await prisma.watchlist.findMany({
                include: {
                    items: {
                        include: {
                            contract: true,
                        },
                    },
                },
                take: 5,
            })
            console.log(`\nFound ${allWatchlists.length} watchlists:`)
            allWatchlists.forEach(w => {
                console.log(`  - ${w.name} (${w.items.length} items):`, w.items.map(i => i.contract.symbol))
            })
            return
        }

        console.log(`✅ Found watchlist: "${watchlist.name}"`)
        console.log(`   User: ${watchlist.user.email} (${watchlist.user.tier})`)
        console.log(`   Items: ${watchlist.items.length}`)
        console.log(`   Symbols:`, watchlist.items.map(item => item.contract.symbol))

        // Step 2: Extract symbols exactly as the endpoint does
        const symbols = watchlist.items
            .map(item => {
                let symbol = item.contract.symbol?.toUpperCase() || ''
                // Current code appends USDT - let's test both ways
                if (symbol && !symbol.endsWith('USDT')) {
                    symbol = `${symbol}USDT`
                }
                return symbol
            })
            .filter(symbol => symbol)

        console.log(`\n📋 Extracted symbols:`, symbols)

        // Step 3: Test fetching each symbol from Binance
        console.log(`\n=== Testing Binance API Calls ===`)
        for (const symbol of symbols) {
            try {
                console.log(`\n🔍 Testing: ${symbol}`)
                const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
                    params: { symbol },
                    timeout: 10000
                })

                if (!response.data) {
                    console.log(`   ❌ No data returned`)
                    continue
                }

                const ticker = response.data
                const price = parseFloat(ticker.lastPrice)
                const volume24h = parseFloat(ticker.quoteVolume)

                console.log(`   ✅ Success!`)
                console.log(`      Symbol: ${ticker.symbol}`)
                console.log(`      Price: ${price}`)
                console.log(`      Volume: ${volume24h}`)
                console.log(`      Volume valid: ${!isNaN(volume24h) && volume24h > 0}`)

                // Test the getMarketData logic
                if (isNaN(volume24h) || volume24h <= 0) {
                    console.log(`   ⚠️  Would be filtered: Invalid volume`)
                } else {
                    console.log(`   ✅ Would pass validation`)
                }

            } catch (error: any) {
                console.log(`   ❌ Failed:`, error.response?.data || error.message)
                
                // Try without USDT if it has USDT
                if (symbol.endsWith('USDT')) {
                    const symbolWithoutUSDT = symbol.slice(0, -4)
                    console.log(`   🔄 Trying without USDT: ${symbolWithoutUSDT}`)
                    try {
                        const response2 = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
                            params: { symbol: symbolWithoutUSDT },
                            timeout: 10000
                        })
                        console.log(`   ✅ Works without USDT!`, response2.data.symbol)
                    } catch (e: any) {
                        console.log(`   ❌ Also failed:`, e.response?.data || e.message)
                    }
                }
            }
        }

        // Step 4: Simulate the exact endpoint logic
        console.log(`\n=== Simulating Endpoint Logic ===`)
        const symbolDataPromises = symbols.map(async (symbol) => {
            try {
                console.log(`\n📡 Fetching: ${symbol}`)
                const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
                    params: { symbol },
                    timeout: 10000
                })

                if (!response.data) {
                    console.log(`   ❌ No data`)
                    return null
                }

                const ticker = response.data
                
                if (!ticker || !ticker.symbol || !ticker.lastPrice) {
                    console.log(`   ❌ Invalid ticker data`)
                    return null
                }
                
                const price = parseFloat(ticker.lastPrice)
                const volume24h = parseFloat(ticker.quoteVolume)

                console.log(`   📊 Data: price=${price}, volume=${volume24h}`)

                if (isNaN(volume24h) || volume24h <= 0) {
                    console.log(`   ❌ Filtered: Invalid volume`)
                    return null
                }

                // skipVolumeFilter=true, so skip volume check
                const skipVolumeFilter = true
                if (!skipVolumeFilter && volume24h < 1000000) {
                    console.log(`   ❌ Filtered: Low volume`)
                    return null
                }

                // Fetch funding rate
                let fundingRate = 0
                try {
                    const fundingResponse = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/premiumIndex`, {
                        params: { symbol },
                        timeout: 5000
                    })
                    if (fundingResponse.data && fundingResponse.data.lastFundingRate) {
                        fundingRate = parseFloat(fundingResponse.data.lastFundingRate)
                    }
                } catch (fundingError) {
                    // Ignore funding rate errors
                }

                const result = {
                    symbol: ticker.symbol,
                    price,
                    volume24h,
                    volumeChange: 0, // Simplified
                    fundingRate,
                    openInterest: 0,
                    timestamp: Date.now(),
                }

                console.log(`   ✅ Returning:`, {
                    symbol: result.symbol,
                    price: result.price,
                    volume24h: result.volume24h,
                })

                return result
            } catch (error: any) {
                console.log(`   ❌ Error:`, error.response?.data || error.message)
                return null
            }
        })

        const results = await Promise.all(symbolDataPromises)
        const validResults = results.filter(r => r !== null)

        console.log(`\n=== Final Results ===`)
        console.log(`Total symbols: ${symbols.length}`)
        console.log(`Valid results: ${validResults.length}`)
        console.log(`Failed: ${symbols.length - validResults.length}`)
        
        if (validResults.length > 0) {
            console.log(`\n✅ Successfully fetched:`)
            validResults.forEach(r => {
                console.log(`   - ${r.symbol}: $${r.price} (vol: ${r.volume24h})`)
            })
        } else {
            console.log(`\n❌ No valid results! This is the problem.`)
        }

    } catch (error) {
        console.error('Test failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testWatchlistEndpoint()

