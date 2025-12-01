import axios from 'axios'
import { createLogger } from '../lib/logger'

const logger = createLogger()

interface BinanceTicker {
    symbol: string
    price: string
    volume: string
    quoteVolume: string
    openPrice: string
    highPrice: string
    lowPrice: string
    lastPrice: string
    openTime: number
    closeTime: number
    count: number
}

interface BinanceFundingRate {
    symbol: string
    markPrice: string
    indexPrice: string
    estimatedSettlePrice: string
    lastFundingRate: string
    nextFundingTime: number
    time: number
}

interface MarketData {
    symbol: string
    price: number
    volume24h: number
    volumeChange: number
    fundingRate: number
    openInterest: number
    timestamp: number
}

const BINANCE_BASE_URL = 'https://fapi.binance.com'

export async function getMarketData(symbol?: string): Promise<MarketData[] | MarketData | null> {
    if (symbol) {
        // Fetch single symbol data
        try {
            const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
                params: { symbol },
                timeout: 10000
            })

            if (!response.data) {
                logger.warn(`No data returned for symbol ${symbol}`)
                return null
            }

            const ticker: BinanceTicker = response.data
            
            // Validate response data
            if (!ticker || !ticker.symbol || !ticker.lastPrice) {
                logger.warn(`Invalid ticker data returned for symbol ${symbol}`)
                return null
            }
            
            const price = parseFloat(ticker.lastPrice)
            const volume24h = parseFloat(ticker.quoteVolume)

            // Don't filter by volume for watchlist symbols - user explicitly added them
            // Only filter if volume is 0 or invalid
            if (isNaN(volume24h) || volume24h <= 0) {
                logger.warn(`Invalid volume for symbol ${symbol}: ${volume24h}`)
                return null
            }

            // Fetch funding rate separately
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
                // Funding rate fetch failed, use 0 as default
                logger.debug(`Failed to fetch funding rate for ${symbol}, using 0`)
            }

            return {
                symbol: ticker.symbol,
                price,
                volume24h,
                volumeChange: calculateVolumeChange(ticker),
                fundingRate,
                openInterest: 0, // Would need separate API call
                timestamp: Date.now(),
            }
        } catch (error) {
            logger.error(`Error fetching data for ${symbol}:`, error)
            return null
        }
    }

    // Fetch all symbols data (existing implementation)
    try {
        // Fetch ticker data and funding rates in parallel
        const [tickerResponse, fundingResponse] = await Promise.all([
            axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`),
            axios.get(`${BINANCE_BASE_URL}/fapi/v1/premiumIndex`)
        ])

        const tickers: BinanceTicker[] = tickerResponse.data
        const fundingRates: BinanceFundingRate[] = fundingResponse.data

        // Create a map of funding rates by symbol
        const fundingMap = new Map(
            fundingRates.map(rate => [rate.symbol, parseFloat(rate.lastFundingRate)])
        )

        // Process and normalize data
        const marketData: MarketData[] = tickers
            .filter(ticker => ticker.symbol.endsWith('USDT')) // Only USDT pairs
            .map(ticker => {
                const price = parseFloat(ticker.lastPrice)
                const volume24h = parseFloat(ticker.quoteVolume)
                const volumeChange = calculateVolumeChange(ticker)
                const fundingRate = fundingMap.get(ticker.symbol) || 0

                return {
                    symbol: ticker.symbol,
                    price,
                    volume24h,
                    volumeChange,
                    fundingRate,
                    openInterest: 0, // Will be fetched separately if needed
                    timestamp: Date.now(),
                }
            })
            .filter(data => data.volume24h > 1000000) // Filter out low volume pairs
            .sort((a, b) => b.volume24h - a.volume24h) // Sort by volume descending

        logger.info(`Fetched ${marketData.length} market data points from Binance`)
        return marketData

    } catch (error) {
        // Do not crash the process on upstream failures; log and return an empty list
        logger.error('Error fetching market data from Binance:', error)
        logger.warn('Returning empty market data due to Binance REST failure')
        return []
    }
}

function calculateVolumeChange(ticker: BinanceTicker): number {
    try {
        const currentVolume = parseFloat(ticker.quoteVolume)
        const openPrice = parseFloat(ticker.openPrice)
        const lastPrice = parseFloat(ticker.lastPrice)

        // Simple volume change calculation
        // In a real implementation, you'd compare with historical data
        const priceChange = ((lastPrice - openPrice) / openPrice) * 100
        return priceChange
    } catch (error) {
        logger.error('Error calculating volume change:', error)
        return 0
    }
}

export async function getSymbolData(symbol: string): Promise<MarketData | null> {
    try {
        const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/ticker/24hr`, {
            params: { symbol }
        })

        const ticker: BinanceTicker = response.data
        const price = parseFloat(ticker.lastPrice)
        const volume24h = parseFloat(ticker.quoteVolume)

        if (volume24h < 1000000) {
            return null // Filter out low volume pairs
        }

        return {
            symbol: ticker.symbol,
            price,
            volume24h,
            volumeChange: calculateVolumeChange(ticker),
            fundingRate: 0, // Would need separate API call
            openInterest: 0,
            timestamp: Date.now(),
        }

    } catch (error) {
        logger.error(`Error fetching data for symbol ${symbol}:`, error)
        return null
    }
}

export async function getHistoricalData(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
): Promise<any[]> {
    try {
        const response = await axios.get(`${BINANCE_BASE_URL}/fapi/v1/klines`, {
            params: {
                symbol,
                interval,
                limit,
            }
        })

        return response.data.map((kline: any[]) => ({
            openTime: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            closeTime: kline[6],
            quoteVolume: parseFloat(kline[7]),
            count: kline[8],
            takerBuyVolume: parseFloat(kline[9]),
            takerBuyQuoteVolume: parseFloat(kline[10]),
        }))

    } catch (error) {
        logger.error(`Error fetching historical data for ${symbol}:`, error)
        return []
    }
}
