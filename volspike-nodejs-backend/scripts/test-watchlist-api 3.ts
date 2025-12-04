import dotenv from 'dotenv'
dotenv.config()

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://volspike-production.up.railway.app'

async function testWatchlistAPI() {
    const email = 'colin.paran@gmail.com'
    
    console.log(`\n=== Testing Watchlist API for ${email} ===\n`)
    console.log(`API URL: ${API_URL}\n`)
    
    // First, we'd need to get a JWT token for this user
    // This is a simplified test - in reality, you'd need to authenticate first
    console.log('⚠️  Note: This test requires a valid JWT token.')
    console.log('   To get one, you need to:')
    console.log('   1. Log in via the frontend')
    console.log('   2. Copy the JWT token from your browser\'s localStorage or cookies')
    console.log('   3. Use it in the Authorization header\n')
    
    console.log('📋 To test manually:')
    console.log(`   curl -H "Authorization: Bearer YOUR_TOKEN" ${API_URL}/api/watchlist\n`)
    
    console.log('🔍 Or check browser console logs after refresh - look for [useWatchlists] messages\n')
}

testWatchlistAPI()

