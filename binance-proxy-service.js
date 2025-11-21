/**
 * Binance Proxy Service for Digital Ocean Droplet
 *
 * This simple Express server proxies Binance API requests to bypass Railway IP blocking.
 * Deploy this on your Digital Ocean droplet that already has Binance API access.
 *
 * Installation:
 * 1. SSH into your Digital Ocean droplet
 * 2. Create directory: mkdir -p ~/binance-proxy && cd ~/binance-proxy
 * 3. Copy this file as server.js
 * 4. Run: npm init -y && npm install express axios cors dotenv
 * 5. Create .env file with PORT=3002 (or any available port)
 * 6. Run: node server.js
 * 7. Set up PM2 for auto-restart: pm2 start server.js --name binance-proxy && pm2 save
 */

const express = require('express')
const axios = require('axios')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3002

// CORS configuration - restrict to your Railway backend domain in production
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

        // Return the exact Binance response
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

// Generic Binance proxy (optional - for future use)
app.get('/api/binance/*', async (req, res) => {
    const binancePath = req.params[0]
    const queryString = new URLSearchParams(req.query).toString()
    const binanceUrl = `https://fapi.binance.com/${binancePath}${queryString ? '?' + queryString : ''}`

    try {
        console.log(`[BinanceProxy] Proxying: ${binanceUrl}`)

        const response = await axios.get(binanceUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'VolSpike/1.0',
            }
        })

        res.json(response.data)

    } catch (error) {
        console.error('[BinanceProxy] Error:', error.message)
        res.status(error.response?.status || 500).json({
            error: 'Proxy request failed',
            message: error.message
        })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Binance Proxy Service running on port ${PORT}`)
    console.log(`📡 Health check: http://localhost:${PORT}/health`)
    console.log(`🔗 Futures info: http://localhost:${PORT}/api/binance/futures/info`)
})
