const express = require('express')
const axios = require('axios')
const cors = require('cors')
const path = require('path')

// Load .env from /opt/perps directory
require('dotenv').config({ path: '/opt/perps/.env' })

const app = express()
const PORT = process.env.PORT || 3002

// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'binance-proxy',
        timestamp: new Date().toISOString()
    })
})

// Proxy endpoint for Binance Futures exchange info
app.get('/api/binance/futures/info', async (req, res) => {
    const startTime = Date.now()

    try {
        console.log('[BinanceProxy] 📡 Fetching Binance Futures exchange info...')

        const response = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo', {
            timeout: 30000,
            headers: {
                'User-Agent': 'VolSpike/1.0',
            }
        })

        const elapsed = Date.now() - startTime
        const symbolCount = response.data?.symbols?.length || 0

        console.log(`[BinanceProxy] ✅ Success: ${symbolCount} symbols in ${elapsed}ms`)

        res.json(response.data)

    } catch (error) {
        const elapsed = Date.now() - startTime
        console.error('[BinanceProxy] ❌ Error fetching from Binance:', {
            message: error.message,
            status: error.response?.status,
            elapsed
        })

        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch from Binance',
            message: error.message,
            timestamp: new Date().toISOString()
        })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Binance Proxy Service running on port ${PORT}`)
    console.log(`📡 Health check: http://localhost:${PORT}/health`)
    console.log(`🔗 Futures info: http://localhost:${PORT}/api/binance/futures/info`)
})
