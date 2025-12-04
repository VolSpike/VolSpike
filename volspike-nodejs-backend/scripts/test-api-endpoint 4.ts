import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import dotenv from 'dotenv'
import { getMarketData } from '../src/services/binance-client'

dotenv.config()

const prisma = new PrismaClient()

async function testActualEndpoint() {
    try {
        console.log('\n=== Testing Actual Endpoint Logic ===\n')

        // Find the watchlist
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
            console.log('❌ Watchlist not found')
            return
        }

        console.log(`✅ Watchlist: "${watchlist.name}"`)
        console.log(`   Watchlist ID: ${watchlist.id}`)
        console.log(`   Symbols in DB:`, watchlist.items.map(i => i.contract.symbol))

        // Step 1: Extract symbols exactly as endpoint does
        const symbols = watchlist.items
            .map(item => {
                let symbol = item.contract.symbol?.toUpperCase() || ''
                if (symbol && !symbol.endsWith('USDT')) {
                    symbol = `${symbol}USDT`
                }
                return symbol
            })
            .filter(symbol => symbol)

        console.log(`\n📋 Extracted symbols:`, symbols)

        // Step 2: Call getMarketData exactly as endpoint does
        console.log(`\n=== Testing getMarketData Function ===`)
        const symbolDataPromises = symbols.map(async (symbol) => {
            try {
                console.log(`\n📡 Calling getMarketData("${symbol}", true)`)
                const data = await getMarketData(symbol, true)
                
                console.log(`   Result type:`, typeof data)
                console.log(`   Is array:`, Array.isArray(data))
                console.log(`   Is null:`, data === null)
                
                if (data === null) {
                    console.log(`   ❌ Returned null`)
                    return null
                }
                
                if (Array.isArray(data)) {
                    console.log(`   ⚠️  Returned array (unexpected for single symbol)`)
                    console.log(`   Array length:`, data.length)
                    if (data.length > 0) {
                        console.log(`   First item:`, data[0])
                    }
                    return null
                }
                
                if (typeof data === 'object' && 'symbol' in data) {
                    console.log(`   ✅ Valid MarketData object`)
                    console.log(`   Symbol:`, data.symbol)
                    console.log(`   Price:`, data.price)
                    console.log(`   Volume:`, data.volume24h)
                    return data
                }
                
                console.log(`   ❌ Invalid format`)
                return null
            } catch (error: any) {
                console.log(`   ❌ Error:`, error.message)
                return null
            }
        })

        const symbolDataResults = await Promise.all(symbolDataPromises)
        
        // Step 3: Filter exactly as endpoint does
        const marketData = symbolDataResults
            .filter((data): data is any => data !== null && typeof data === 'object' && 'symbol' in data)

        console.log(`\n=== Filtering Results ===`)
        console.log(`Total promises: ${symbolDataResults.length}`)
        console.log(`Valid after filter: ${marketData.length}`)
        console.log(`Null results: ${symbolDataResults.filter(d => d === null).length}`)

        // Step 4: Build response exactly as endpoint does
        const response = {
            watchlistId: watchlist.id,
            watchlistName: watchlist.name,
            symbols: marketData,
            fetchedAt: Date.now(),
        }

        console.log(`\n=== Final Response ===`)
        console.log(`Response structure:`, {
            watchlistId: response.watchlistId,
            watchlistName: response.watchlistName,
            symbolsCount: response.symbols.length,
            fetchedAt: response.fetchedAt,
        })

        if (response.symbols.length > 0) {
            console.log(`\n✅ Symbols in response:`)
            response.symbols.forEach(s => {
                console.log(`   - ${s.symbol}: $${s.price} (vol: ${s.volume24h})`)
            })
        } else {
            console.log(`\n❌ NO SYMBOLS IN RESPONSE!`)
            console.log(`\nDebugging:`)
            console.log(`  - symbolDataResults:`, symbolDataResults)
            console.log(`  - marketData:`, marketData)
        }

        // Step 5: Check what frontend expects
        console.log(`\n=== Frontend Expectations ===`)
        console.log(`Frontend expects: result.symbols (array)`)
        console.log(`We're returning: response.symbols (${response.symbols.length} items)`)
        console.log(`Match: ${response.symbols.length > 0 ? '✅' : '❌'}`)

    } catch (error) {
        console.error('Test failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testActualEndpoint()

