import { PrismaClient } from '@prisma/client'
import { getMarketData } from '../src/services/binance-client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function testEndpointLogic() {
    try {
        console.log('\n=== Testing Exact Endpoint Logic ===\n')

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
            },
        })

        if (!watchlist) {
            console.log('❌ Watchlist not found')
            return
        }

        console.log(`✅ Watchlist: "${watchlist.name}"`)
        console.log(`   ID: ${watchlist.id}`)
        console.log(`   Items: ${watchlist.items.length}`)
        console.log(`   Symbols in DB:`, watchlist.items.map(i => i.contract.symbol))

        // Step 1: Extract symbols EXACTLY as endpoint does
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

        if (symbols.length === 0) {
            console.log(`\n❌ NO SYMBOLS EXTRACTED!`)
            console.log(`   Raw items:`, watchlist.items)
            return
        }

        // Step 2: Call getMarketData EXACTLY as endpoint does
        console.log(`\n=== Calling getMarketData ===`)
        const symbolDataPromises = symbols.map(async (symbol) => {
            try {
                console.log(`\n📡 Calling getMarketData("${symbol}", true)`)
                const data = await getMarketData(symbol, true)
                
                console.log(`   Result:`, {
                    type: typeof data,
                    isNull: data === null,
                    isArray: Array.isArray(data),
                    hasSymbol: data && typeof data === 'object' && 'symbol' in data,
                })

                if (data === null) {
                    console.log(`   ❌ Returned null`)
                    return null
                }

                if (Array.isArray(data)) {
                    console.log(`   ⚠️  Returned array (unexpected)`)
                    return null
                }

                if (data && typeof data === 'object' && 'symbol' in data) {
                    console.log(`   ✅ Valid object`)
                    console.log(`      Symbol: ${(data as any).symbol}`)
                    console.log(`      Price: ${(data as any).price}`)
                    return data
                }

                console.log(`   ❌ Invalid format`)
                return null
            } catch (error: any) {
                console.log(`   ❌ Error:`, error.message)
                console.log(`   Stack:`, error.stack)
                return null
            }
        })

        console.log(`\n⏳ Waiting for all promises...`)
        const symbolDataResults = await Promise.all(symbolDataPromises)
        
        console.log(`\n📊 Results:`, {
            total: symbolDataResults.length,
            nulls: symbolDataResults.filter(r => r === null).length,
            valid: symbolDataResults.filter(r => r !== null).length,
        })

        // Step 3: Filter EXACTLY as endpoint does
        const marketData = symbolDataResults
            .filter((data): data is any => data !== null && typeof data === 'object' && 'symbol' in data)

        console.log(`\n🔍 After filtering:`, {
            total: marketData.length,
            symbols: marketData.map(d => d.symbol),
        })

        // Step 4: Build response EXACTLY as endpoint does
        const response = {
            watchlistId: watchlist.id,
            watchlistName: watchlist.name,
            symbols: marketData,
            fetchedAt: Date.now(),
        }

        console.log(`\n=== Final Response ===`)
        console.log(`Response:`, {
            watchlistId: response.watchlistId,
            watchlistName: response.watchlistName,
            symbolsCount: response.symbols.length,
            symbols: response.symbols.map(s => s.symbol),
        })

        if (response.symbols.length === 0) {
            console.log(`\n❌ PROBLEM FOUND: Response has 0 symbols!`)
            console.log(`\nDebugging:`)
            console.log(`  1. Symbols extracted:`, symbols)
            console.log(`  2. getMarketData results:`, symbolDataResults)
            console.log(`  3. After filtering:`, marketData)
            console.log(`  4. Final response:`, response)
        } else {
            console.log(`\n✅ SUCCESS: Response has ${response.symbols.length} symbol(s)`)
        }

    } catch (error) {
        console.error('Test failed:', error)
        if (error instanceof Error) {
            console.error('Stack:', error.stack)
        }
    } finally {
        await prisma.$disconnect()
    }
}

testEndpointLogic()

