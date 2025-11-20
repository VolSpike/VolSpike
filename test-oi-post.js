#!/usr/bin/env node

/**
 * Test script to manually POST Open Interest data to the backend
 * This simulates what the DigitalOcean script should be doing
 *
 * Usage:
 * 1. Make sure backend is running (npm run dev in volspike-nodejs-backend)
 * 2. Run: node test-oi-post.js
 */

const API_KEY = '48a1a55a8af5cdc6d6e8b31108e3063570dc9564f6fa844e89c7ee5f943ced09';

// Sample Open Interest data (format matching DigitalOcean script)
const sampleData = {
  data: [
    { symbol: 'BTCUSDT', openInterestUsd: 8500000000 },
    { symbol: 'ETHUSDT', openInterestUsd: 3200000000 },
    { symbol: 'SOLUSDT', openInterestUsd: 950000000 },
    { symbol: 'BNBUSDT', openInterestUsd: 780000000 },
    { symbol: 'XRPUSDT', openInterestUsd: 650000000 },
    { symbol: 'DOGEUSDT', openInterestUsd: 420000000 },
    { symbol: 'ADAUSDT', openInterestUsd: 310000000 },
    { symbol: 'MATICUSDT', openInterestUsd: 280000000 },
    { symbol: 'DOTUSDT', openInterestUsd: 220000000 },
    { symbol: 'AVAXUSDT', openInterestUsd: 190000000 },
  ]
};

async function postOpenInterest(baseUrl) {
  const url = `${baseUrl}/api/market/open-interest/ingest`;

  console.log(`\n📡 Posting Open Interest data to: ${url}`);
  console.log(`🔑 Using API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`📊 Sample data: ${sampleData.data.length} symbols\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(sampleData)
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      console.log('✅ POST successful!');
      console.log('Response:', responseData);
    } else {
      console.error(`❌ POST failed: ${response.status} ${response.statusText}`);
      console.error('Response:', responseData);
    }

    return response.ok;
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
    return false;
  }
}

async function getOpenInterest(baseUrl) {
  const url = `${baseUrl}/api/market/open-interest`;

  console.log(`\n📥 Fetching Open Interest data from: ${url}\n`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`❌ GET failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    console.log('✅ GET successful!');
    console.log('Cache info:', {
      symbolCount: Object.keys(data.data || {}).length,
      stale: data.stale,
      dangerouslyStale: data.dangerouslyStale,
      asOf: data.asOf ? new Date(data.asOf).toISOString() : null
    });

    if (Object.keys(data.data || {}).length > 0) {
      console.log('\nFirst 5 symbols:');
      Object.entries(data.data).slice(0, 5).forEach(([symbol, oi]) => {
        console.log(`  ${symbol}: $${oi.toLocaleString()}`);
      });
    } else {
      console.warn('⚠️  Cache is empty!');
    }

  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3001';

  console.log('='.repeat(60));
  console.log('Open Interest Test Script');
  console.log('='.repeat(60));
  console.log(`Backend URL: ${baseUrl}`);

  // Test 1: Check current cache state
  console.log('\n📋 Test 1: Check current cache state');
  await getOpenInterest(baseUrl);

  // Test 2: POST new data
  console.log('\n📋 Test 2: POST new Open Interest data');
  const postSuccess = await postOpenInterest(baseUrl);

  if (!postSuccess) {
    console.error('\n❌ POST failed. Backend may not be running or API key is incorrect.');
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure backend is running: cd volspike-nodejs-backend && npm run dev');
    console.log('2. Check ALERT_INGEST_API_KEY in backend/.env matches this script');
    console.log('3. Check for firewall/network issues');
    process.exit(1);
  }

  // Test 3: Verify data was cached
  console.log('\n📋 Test 3: Verify data was cached');
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  await getOpenInterest(baseUrl);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
