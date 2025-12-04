# Binance Proxy Setup Guide

## Problem
Railway's IP addresses are blocked by Binance, causing `sync-binance` endpoint to fail with "empty symbols array" error.

## Solution
Deploy a lightweight proxy service on your Digital Ocean droplet (which already has Binance API access) to forward requests from Railway.

---

## Step 1: Deploy Proxy on Digital Ocean

### 1.1 SSH into your Digital Ocean droplet

```bash
ssh root@your-droplet-ip
```

### 1.2 Create proxy directory

```bash
mkdir -p ~/binance-proxy
cd ~/binance-proxy
```

### 1.3 Create server file

Copy the contents of `binance-proxy-service.js` from your local VolSpike repo:

```bash
nano server.js
# Paste the contents of binance-proxy-service.js
# Save: Ctrl+X, then Y, then Enter
```

### 1.4 Initialize and install dependencies

```bash
npm init -y
npm install express axios cors dotenv
```

### 1.5 Create .env file

```bash
nano .env
```

Add:
```env
PORT=3002
# Optional: Restrict CORS to your Railway backend domain
ALLOWED_ORIGINS=https://your-railway-backend.up.railway.app
```

Save: `Ctrl+X`, `Y`, `Enter`

### 1.6 Test the proxy

```bash
node server.js
```

You should see:
```
🚀 Binance Proxy Service running on port 3002
📡 Health check: http://localhost:3002/health
🔗 Futures info: http://localhost:3002/api/binance/futures/info
```

### 1.7 Test from another terminal

```bash
curl http://localhost:3002/health
curl http://localhost:3002/api/binance/futures/info | jq '.symbols | length'
# Should return: 639
```

### 1.8 Set up PM2 for auto-restart (optional but recommended)

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the proxy with PM2
pm2 start server.js --name binance-proxy

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system reboot
pm2 startup
# Follow the instructions PM2 prints
```

### 1.9 Configure firewall (if UFW is enabled)

```bash
# Allow port 3002 from your Railway backend IP
sudo ufw allow 3002/tcp

# Or allow from specific IP (recommended)
sudo ufw allow from RAILWAY_IP to any port 3002

# Check status
sudo ufw status
```

### 1.10 Get your droplet's public IP

```bash
curl ifconfig.me
# Note this IP - you'll use it in Railway env vars
```

---

## Step 2: Update Railway Backend

### 2.1 Add environment variable to Railway

1. Go to Railway dashboard: https://railway.app
2. Open your backend project
3. Go to "Variables" tab
4. Add new variable:
   - **Name**: `BINANCE_PROXY_URL`
   - **Value**: `http://YOUR_DROPLET_IP:3002`
5. Click "Save"

**Example:**
```
BINANCE_PROXY_URL=http://159.89.123.45:3002
```

### 2.2 Update backend code

The backend code has already been updated to use `BINANCE_PROXY_URL` if available.

**File**: `volspike-nodejs-backend/src/routes/admin/assets.ts` (line ~289)

**Old code:**
```typescript
const BINANCE_FUTURES_INFO = 'https://fapi.binance.com/fapi/v1/exchangeInfo'
```

**New code:**
```typescript
const BINANCE_FUTURES_INFO = process.env.BINANCE_PROXY_URL
    ? `${process.env.BINANCE_PROXY_URL}/api/binance/futures/info`
    : 'https://fapi.binance.com/fapi/v1/exchangeInfo'
```

### 2.3 Deploy backend changes

```bash
cd volspike-nodejs-backend
git add src/routes/admin/assets.ts
git commit -m "feat(admin): Add Binance proxy support to bypass Railway IP block"
git push
```

Railway will auto-deploy in ~2 minutes.

---

## Step 3: Test in Production

### 3.1 Test the proxy endpoint directly

```bash
curl http://YOUR_DROPLET_IP:3002/health
curl http://YOUR_DROPLET_IP:3002/api/binance/futures/info | jq '.symbols | length'
```

Should return `639`.

### 3.2 Test from Railway

1. Go to `volspike.com/admin/assets`
2. Open browser console (F12)
3. Click "Sync from Binance"
4. Watch Railway logs for:

```
[AdminAssets] 🔄 Manual Binance sync triggered
[AdminAssets] 📡 Fetching Binance exchange info from: http://YOUR_DROPLET_IP:3002/api/binance/futures/info
[AdminAssets] ✅ Binance API response received (status: 200)
[AdminAssets] 📊 Found 639 total symbols from Binance
[AdminAssets] ✅ Filtered to 300 valid perpetual USDT pairs
[AdminAssets] 🚀 Bulk creating 300 new assets...
[AdminAssets] ✅ Created 300 new assets
[AdminAssets] ✅ Binance sync completed in 2.3s
```

### 3.3 Verify assets were created

1. Check Railway logs for success message
2. Check frontend - beautiful asset cards should appear
3. Check Neon database:

```sql
SELECT COUNT(*) FROM "Asset";
-- Should return 300 (or more)

SELECT "baseSymbol", "binanceSymbol", "displayName", "logoUrl"
FROM "Asset"
LIMIT 10;
```

---

## Step 4: Troubleshooting

### Issue 1: "Connection refused" from Railway

**Cause**: Firewall blocking port 3002

**Solution**:
```bash
# On Digital Ocean droplet
sudo ufw allow 3002/tcp
sudo ufw reload
```

### Issue 2: "Timeout" from Railway

**Cause**: Slow network or Binance API delay

**Solution**: Increase timeout in proxy (already set to 30s)

### Issue 3: Proxy not running

**Check PM2 status**:
```bash
pm2 status
pm2 logs binance-proxy
```

**Restart proxy**:
```bash
pm2 restart binance-proxy
```

### Issue 4: Still getting empty symbols

**Check Railway env var**:
```bash
# In Railway dashboard, verify:
BINANCE_PROXY_URL=http://YOUR_DROPLET_IP:3002
```

**Check Railway logs**:
```
[AdminAssets] 📡 Fetching Binance exchange info from: http://YOUR_DROPLET_IP:3002/api/binance/futures/info
```

If it still says `https://fapi.binance.com`, the env var is not set correctly.

---

## Step 5: Security Hardening (Optional)

### 5.1 Add API key authentication

**Update proxy server.js**:
```javascript
const API_KEY = process.env.API_KEY || 'your-secret-key'

app.use((req, res, next) => {
    const authHeader = req.headers['x-api-key']
    if (authHeader !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
})
```

**Update Railway backend**:
```typescript
const response = await axios.get(BINANCE_FUTURES_INFO, {
    headers: {
        'X-API-Key': process.env.BINANCE_PROXY_API_KEY,
    },
    timeout: 30000,
})
```

**Add env var to Railway**:
```
BINANCE_PROXY_API_KEY=your-secret-key
```

### 5.2 Use HTTPS (if you have domain)

If your droplet has a domain with SSL:
```
BINANCE_PROXY_URL=https://api.yourdomain.com
```

Set up reverse proxy with Nginx + Let's Encrypt.

---

## Architecture Diagram

```
┌─────────────────┐
│   User Browser  │
│  (volspike.com) │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────┐
│ Vercel Frontend │
│   (Next.js)     │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Railway Backend │─────▶│ Digital Ocean    │
│   (Node.js)     │ HTTP │ Binance Proxy    │
│ (IP BLOCKED)    │      │ (IP ALLOWED)     │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  │ HTTPS
                                  ▼
                         ┌──────────────────┐
                         │  Binance API     │
                         │  (fapi.binance.  │
                         │   com)           │
                         └──────────────────┘
```

**Before**: Railway → Binance (BLOCKED ❌)
**After**: Railway → Digital Ocean → Binance (WORKS ✅)

---

## Expected Results

### Railway Logs (Success):
```
[AdminAssets] 🔄 Manual Binance sync triggered
[AdminAssets] 📡 Fetching Binance exchange info from: http://159.89.123.45:3002/api/binance/futures/info
[AdminAssets] ✅ Binance API response received (status: 200)
[AdminAssets] 📊 Found 639 total symbols from Binance
[AdminAssets] ✅ Filtered to 300 valid perpetual USDT pairs
[AdminAssets] 🚀 Bulk creating 300 new assets...
[AdminAssets] ✅ Created 300 new assets
[AdminAssets] 🎯 Triggering auto-enrichment for 300 assets
[AdminAssets] ✅ Binance sync completed in 2.3s
```

### Digital Ocean Proxy Logs (PM2):
```
[BinanceProxy] 📡 Fetching Binance Futures exchange info...
[BinanceProxy] ✅ Success: 639 symbols in 1200ms
```

### Frontend UI:
- Toast: "✅ Successfully synced 300 assets from Binance (300 new, 0 updated)"
- Beautiful asset cards appear with logos
- Status indicators show enrichment progress

---

## Maintenance

### Monitor proxy health

```bash
# Check if proxy is running
pm2 status

# View logs
pm2 logs binance-proxy

# Restart if needed
pm2 restart binance-proxy
```

### Update proxy

```bash
cd ~/binance-proxy
nano server.js
# Make changes
pm2 restart binance-proxy
```

---

## Rollback

If issues occur, revert to direct Binance calls:

1. Remove `BINANCE_PROXY_URL` from Railway env vars
2. Redeploy backend (or wait for auto-deploy)

---

## Cost

- **Digital Ocean droplet**: Already running (no extra cost)
- **Proxy service**: Lightweight Express app (~50MB RAM)
- **Network**: Negligible bandwidth usage

---

**Status**: Ready to deploy
**Estimated Setup Time**: 10 minutes
**Difficulty**: Easy (copy-paste commands)

**Last Updated**: 2025-11-21
