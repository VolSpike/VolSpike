import axios from 'axios'

const BINANCE_BASE_URL = 'https://fapi.binance.com'

async function debugSymbol(symbol: string) {
    console.log(`\n=== Debugging symbol: ${symbol} ===`)
    
    // Test 1: Try exact symbol
    try {
        const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
            params: { symbol },
            timeout: 10000
        })
        console.log(`✅ Success with ${symbol}:`, {
            symbol: response.data.symbol,
            price: response.data.lastPrice,
            volume: response.data.quoteVolume,
        })
        return response.data
    } catch (error: any) {
        console.log(`❌ Failed with ${symbol}:`, error.response?.data || error.message)
    }
    
    // Test 2: Try with USDT suffix
    if (!symbol.endsWith('USDT')) {
        const symbolWithUSDT = `${symbol}USDT`
        try {
            const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
                params: { symbol: symbolWithUSDT },
                timeout: 10000
            })
            console.log(`✅ Success with ${symbolWithUSDT}:`, {
                symbol: response.data.symbol,
                price: response.data.lastPrice,
                volume: response.data.quoteVolume,
            })
            return response.data
        } catch (error: any) {
            console.log(`❌ Failed with ${symbolWithUSDT}:`, error.response?.data || error.message)
        }
    }
    
    // Test 3: Search for similar symbols
    try {
        const allTickers = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`)
        const matching = allTickers.data.filter((t: any) => 
            t.symbol.includes(symbol.toUpperCase()) || symbol.toUpperCase().includes(t.symbol)
        )
        if (matching.length > 0) {
            console.log(`\n🔍 Found similar symbols:`, matching.slice(0, 5).map((t: any) => t.symbol))
        }
    } catch (error) {
        console.log('Could not search for similar symbols')
    }
    
    return null
}

async function main() {
    const testSymbols = ['1000PEPE', '1000PEPEUSDT', 'PEPEUSDT']
    
    for (const symbol of testSymbols) {
        await debugSymbol(symbol)
    }
}

main().catch(console.error)

