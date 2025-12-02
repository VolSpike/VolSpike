# Next Steps - OI Realtime Feature Deployment

## ✅ Completed (Steps 0-10)

1. ✅ **Backend Foundation** - All endpoints, database schema, WebSocket broadcasting
2. ✅ **Python Poller** - Complete realtime OI poller script (`oi_realtime_poller.py`)
3. ✅ **Architecture Fix** - Moved liquid universe job to Digital Ocean (per AGENTS.md)
4. ✅ **Debug UI** - Frontend debug page at `/debug/open-interest`

## 🎯 Current Status

**Backend (Railway):**
- ✅ Database schema migrated (3 new tables)
- ✅ OI ingestion endpoints working
- ✅ OI alert endpoints working
- ✅ WebSocket broadcasting implemented
- ✅ Debug endpoints available
- ✅ **NO Binance REST API calls** (per AGENTS.md)

**Python Scripts (Digital Ocean):**
- ✅ Realtime OI poller ready (`oi_realtime_poller.py`)
- ✅ Liquid universe job ready (`oi_liquid_universe_job.py`)
- ⏳ **NOT YET DEPLOYED** - Need to set up on Digital Ocean

## 📋 Next Steps (In Order)

### Step 1: Deploy Liquid Universe Job to Digital Ocean

**Goal:** Get liquid universe populated so poller has symbols to work with.

1. **Upload script to Digital Ocean:**
   ```bash
   scp "Digital Ocean/oi_liquid_universe_job.py" root@YOUR_IP:/home/trader/volume-spike-bot/
   ```

2. **Test manually first:**
   ```bash
   # SSH into Digital Ocean
   ssh root@YOUR_IP
   
   # Set environment variables
   export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
   export VOLSPIKE_API_KEY="your-api-key"
   
   # Run script
   cd /home/trader/volume-spike-bot
   python3 oi_liquid_universe_job.py
   ```

3. **Verify it works:**
   - Check script output: Should see "✅ Posted liquid universe: X symbols"
   - Check backend: `curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe`
   - Should return symbols (not empty)

4. **Set up systemd service** (same pattern as volume alert script):
   ```bash
   # Create service file
   sudo nano /etc/systemd/system/oi-liquid-universe.service
   ```
   
   ```ini
   [Unit]
   Description=VolSpike Liquid Universe Classification Job
   After=network.target
   
   [Service]
   Type=oneshot
   User=trader
   WorkingDirectory=/home/trader/volume-spike-bot
   ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/oi_liquid_universe_job.py
   
   Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
   Environment="VOLSPIKE_API_KEY=your-api-key"
   Environment="BINANCE_PROXY_URL=http://localhost:3002"
   
   StandardOutput=journal
   StandardError=journal
   
   [Install]
   WantedBy=multi-user.target
   ```

5. **Set up cron job** (runs every 5 minutes):
   ```bash
   # Add to crontab
   crontab -e
   
   # Add this line:
   */5 * * * * /usr/bin/systemd-run --unit=oi-liquid-universe.service
   ```

6. **Verify it's running:**
   ```bash
   # Check logs
   sudo journalctl -u oi-liquid-universe.service -f
   
   # Should see successful runs every 5 minutes
   ```

---

### Step 2: Deploy Realtime OI Poller to Digital Ocean

**Goal:** Start polling OI for liquid symbols and posting to backend.

1. **Upload script to Digital Ocean:**
   ```bash
   scp "Digital Ocean/oi_realtime_poller.py" root@YOUR_IP:/home/trader/volume-spike-bot/
   ```

2. **Test manually first:**
   ```bash
   # SSH into Digital Ocean
   ssh root@YOUR_IP
   
   # Set environment variables
   export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
   export VOLSPIKE_API_KEY="your-api-key"
   
   # Run script
   cd /home/trader/volume-spike-bot
   python3 oi_realtime_poller.py
   ```

3. **Verify it works:**
   - Should see "✅ Loaded X symbols from liquid universe" (X > 0)
   - Should see "Posted OI batch: X symbols" every 1-2 minutes
   - Check backend: `curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=10`
   - Should show rows with `source="realtime"`

4. **Set up systemd service:**
   ```bash
   sudo nano /etc/systemd/system/oi-realtime-poller.service
   ```
   
   ```ini
   [Unit]
   Description=VolSpike Realtime Open Interest Poller
   After=network.target
   
   [Service]
   Type=simple
   User=trader
   WorkingDirectory=/home/trader/volume-spike-bot
   ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/oi_realtime_poller.py
   Restart=always
   RestartSec=10
   
   Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
   Environment="VOLSPIKE_API_KEY=your-api-key"
   
   StandardOutput=journal
   StandardError=journal
   
   [Install]
   WantedBy=multi-user.target
   ```

5. **Enable and start:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable oi-realtime-poller.service
   sudo systemctl start oi-realtime-poller.service
   sudo systemctl status oi-realtime-poller.service
   ```

6. **Monitor:**
   ```bash
   sudo journalctl -u oi-realtime-poller.service -f
   ```

---

### Step 3: Verify End-to-End Flow

**Goal:** Ensure everything works together.

1. **Check liquid universe:**
   ```bash
   curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe
   ```
   - Should return symbols (> 0)

2. **Check OI samples:**
   ```bash
   curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=10
   ```
   - Should show recent realtime OI data

3. **Check debug UI:**
   - Open: `https://your-frontend-domain.com/debug/open-interest`
   - Should show liquid universe, OI samples, WebSocket connected

4. **Monitor for 24 hours:**
   - Check Digital Ocean logs for both scripts
   - Check Railway backend logs for ingestion
   - Verify no errors

---

### Step 4: Production Rollout (Steps 11-13)

Once Steps 1-3 are verified and stable:

1. **Step 11:** Production rollout (shadow mode)
2. **Step 12:** Enable realtime OI for Pro/Elite tiers
3. **Step 13:** Optimize existing Python OI snapshot behavior

---

## 🔍 Verification Checklist

After deploying both scripts:

- [ ] Liquid universe job runs every 5 minutes
- [ ] Liquid universe has symbols (> 0)
- [ ] Realtime OI poller loads liquid universe successfully
- [ ] OI poller posts batches every 1-2 minutes
- [ ] Backend receives OI data (`source='realtime'`)
- [ ] Debug UI shows data
- [ ] WebSocket broadcasts OI updates
- [ ] No errors in Digital Ocean logs
- [ ] No errors in Railway backend logs
- [ ] No Binance REST API calls from Railway backend (per AGENTS.md)

---

## 📚 Documentation

- **Deployment Guide:** `Digital Ocean/OI_REALTIME_POLLER_DEPLOYMENT.md`
- **Quick Test Guide:** `Digital Ocean/QUICK_TEST_GUIDE.md`
- **Deployment Checklist:** `DEPLOYMENT_CHECKLIST.md`
- **Verification Script:** `Digital Ocean/verify_oi_setup.sh`

---

## 🚨 Important Notes

1. **Architecture Compliance:** 
   - ✅ Backend NEVER calls Binance REST API
   - ✅ Only Digital Ocean scripts call Binance REST API
   - ✅ Backend only stores/retrieves data

2. **Environment Variables:**
   - Both scripts need `VOLSPIKE_API_URL` and `VOLSPIKE_API_KEY`
   - Liquid universe job also needs `BINANCE_PROXY_URL` (optional, defaults to localhost:3002)

3. **Testing:**
   - Always test manually before setting up as service
   - Monitor logs for first 24 hours
   - Verify data flow end-to-end

4. **Rollback:**
   - If issues occur, stop services:
     ```bash
     sudo systemctl stop oi-liquid-universe.service
     sudo systemctl stop oi-realtime-poller.service
     ```
   - Existing volume alert script continues unaffected

