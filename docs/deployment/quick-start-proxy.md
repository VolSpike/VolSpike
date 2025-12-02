# Quick Start - Binance Proxy Setup (5 Minutes)

## What You'll Do
Set up a simple proxy on your Digital Ocean droplet to bypass Railway's IP block.

---

## Step 1: On Digital Ocean (3 minutes)

### SSH into droplet
```bash
ssh root@YOUR_DROPLET_IP
```

### Copy and paste this entire block
```bash
# Create directory and navigate
mkdir -p ~/binance-proxy && cd ~/binance-proxy

# Download the proxy service file from your repo
# (You'll need to copy binance-proxy-service.js to your droplet)

# Initialize npm and install dependencies
npm init -y
npm install express axios cors dotenv

# Create .env file
cat > .env << 'EOF'
PORT=3002
ALLOWED_ORIGINS=*
EOF

# Open firewall
sudo ufw allow 3002/tcp

# Test it works
node server.js &
sleep 2
curl http://localhost:3002/health
curl http://localhost:3002/api/binance/futures/info | head -20

# If test passed, set up PM2 for auto-restart
npm install -g pm2
pm2 start server.js --name binance-proxy
pm2 save
pm2 startup  # Follow the instructions it prints
```

### Get your droplet's public IP
```bash
curl ifconfig.me
```
**Copy this IP - you'll need it for Railway**

---

## Step 2: Update Railway (2 minutes)

### Add environment variable
1. Go to https://railway.app
2. Open your backend project
3. Click "Variables" tab
4. Add new variable:
   - **Name**: `BINANCE_PROXY_URL`
   - **Value**: `http://YOUR_DROPLET_IP:3002`
5. Click "Save"

**Example:**
```
BINANCE_PROXY_URL=http://159.89.123.45:3002
```

### Deploy backend changes
```bash
cd volspike-nodejs-backend
git add src/routes/admin/assets.ts
git commit -m "feat(admin): Add Binance proxy support"
git push
```

Railway will auto-deploy in ~2 minutes.

---

## Step 3: Test (1 minute)

1. Go to `volspike.com/admin/assets`
2. Open browser console (F12)
3. Click "Sync from Binance"
4. Watch for success toast and beautiful asset cards

### Check Railway logs for:
```
[AdminAssets] 📡 Fetching Binance exchange info from: http://YOUR_DROPLET_IP:3002/api/binance/futures/info
[AdminAssets] ✅ Binance API response received (status: 200)
[AdminAssets] 📊 Found 639 total symbols from Binance
[AdminAssets] ✅ Created 300 new assets
```

---

## That's It!

Your Railway backend now fetches Binance data through your Digital Ocean droplet, bypassing the IP block.

**Total Time**: 5 minutes
**Total Cost**: $0 (uses existing droplet)

---

## Troubleshooting

### "Connection refused"
```bash
# On droplet
sudo ufw allow 3002/tcp
pm2 restart binance-proxy
```

### Check if proxy is running
```bash
# On droplet
pm2 status
pm2 logs binance-proxy
```

### Test proxy directly
```bash
curl http://YOUR_DROPLET_IP:3002/health
```

---

For detailed documentation, see [BINANCE_PROXY_SETUP.md](./BINANCE_PROXY_SETUP.md)
