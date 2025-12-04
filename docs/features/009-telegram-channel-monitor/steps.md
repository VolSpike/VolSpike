# Telegram Channel Monitor - Implementation Steps

## Status: COMPLETE (December 2025)

All steps have been implemented and tested. This document serves as a reference for future maintenance or similar implementations.

## Prerequisites

### Manual Steps Required (One-time Setup)

1. **Get Telegram API Credentials**
   - Go to https://my.telegram.org
   - Log in with your phone number
   - Go to "API development tools"
   - Create a new application
   - Note down: `api_id` and `api_hash`

2. **First-time Pyrogram Authentication**
   - After deploying the script, SSH into Digital Ocean
   - Run the script once manually: `python telegram_channel_poller.py`
   - Enter phone number when prompted
   - Enter verification code from Telegram
   - This creates `volspike_telegram.session` file that persists

## Implementation Steps - ALL COMPLETE

### Phase 1: Database Schema [DONE]

- [x] **1.1** Add TelegramChannel model to Prisma schema
- [x] **1.2** Add TelegramMessage model to Prisma schema
- [x] **1.3** Create and run database migration
- [x] **1.4** Verify tables created in Neon DB

**Files Modified:**
- `volspike-nodejs-backend/prisma/schema.prisma`

### Phase 2: Backend Service [DONE]

- [x] **2.1** Create TelegramService class
  - `ingestMessages()` - Store messages with auto-cleanup
  - `getChannels()` - List channels with message counts
  - `getMessages()` - Paginated message retrieval
  - `cleanupOldMessages()` - Keep only last N messages
  - `getStats()` - Dashboard statistics
  - `toggleChannel()` - Enable/disable channel
  - `deleteChannel()` - Remove channel and messages

- [x] **2.2** Create public ingest API route
  - POST /api/telegram/ingest (API key protected)
  - GET /api/telegram/health

**Files Created:**
- `volspike-nodejs-backend/src/services/telegram.ts`
- `volspike-nodejs-backend/src/routes/telegram.ts`

**Files Modified:**
- `volspike-nodejs-backend/src/index.ts` (register routes)

### Phase 3: Admin API Routes [DONE]

- [x] **3.1** Create admin telegram routes
  - GET /api/admin/telegram/channels
  - GET /api/admin/telegram/messages
  - GET /api/admin/telegram/stats
  - PATCH /api/admin/telegram/channels/:id
  - DELETE /api/admin/telegram/channels/:id

- [x] **3.2** Register routes in admin index

**Files Created:**
- `volspike-nodejs-backend/src/routes/admin/telegram.ts`

**Files Modified:**
- `volspike-nodejs-backend/src/routes/admin/index.ts`

### Phase 4: Admin Panel Frontend [DONE]

- [x] **4.1** Create /admin/telegram/page.tsx (server component)
- [x] **4.2** Create TelegramMonitorClient component
- [x] **4.3** Implement stats cards (4 cards: channels, messages, 24h, enabled)
- [x] **4.4** Implement channels section with enable/disable/delete
- [x] **4.5** Implement messages list with pagination
- [x] **4.6** Add auto-refresh functionality (30 seconds)
- [x] **4.7** Add to admin sidebar navigation

**Files Created:**
- `volspike-nextjs-frontend/src/app/(admin)/admin/telegram/page.tsx`
- `volspike-nextjs-frontend/src/app/(admin)/admin/telegram/telegram-monitor-client.tsx`

**Files Modified:**
- `volspike-nextjs-frontend/src/components/admin/layout/admin-sidebar.tsx`

### Phase 5: Digital Ocean Pyrogram Script [DONE]

- [x] **5.1** Create telegram_channel_poller.py
- [x] **5.2** Install Pyrogram on Digital Ocean
  ```bash
  ssh volspike-do
  cd /home/trader/volume-spike-bot
  source .venv/bin/activate
  pip install pyrogram tgcrypto
  ```
- [x] **5.3** Add Telegram credentials to .volspike.env
  ```
  TELEGRAM_API_ID=your_api_id
  TELEGRAM_API_HASH=your_api_hash
  TELEGRAM_CHANNELS=marketfeed
  ```
- [x] **5.4** Create systemd service file
- [x] **5.5** Deploy script via SCP
- [x] **5.6** Complete first-time authentication (manual)
- [x] **5.7** Fix file permissions (session file must be writable by trader)
- [x] **5.8** Enable and start service

**Files Created:**
- `Digital Ocean/telegram_channel_poller.py`
- `Digital Ocean/telegram-channel-poller.service`

### Phase 6: Testing & Verification [DONE]

- [x] **6.1** Verify messages appearing in database (100 initial messages)
- [x] **6.2** Test admin panel displays messages
- [x] **6.3** Test auto-refresh functionality
- [x] **6.4** Verify auto-cleanup works on ingestion
- [x] **6.5** Test error handling and reconnection

## Deployment Commands Reference

### Deploy Script to Digital Ocean
```bash
# Copy script
scp "Digital Ocean/telegram_channel_poller.py" volspike-do:/home/trader/volume-spike-bot/

# Copy service file
scp "Digital Ocean/telegram-channel-poller.service" volspike-do:/tmp/
ssh volspike-do "sudo mv /tmp/telegram-channel-poller.service /etc/systemd/system/"

# Fix permissions
ssh volspike-do "sudo chown trader:trader /home/trader/volume-spike-bot/telegram_channel_poller.py"
ssh volspike-do "sudo chmod 755 /home/trader/volume-spike-bot/telegram_channel_poller.py"

# Reload and enable service
ssh volspike-do "sudo systemctl daemon-reload"
ssh volspike-do "sudo systemctl enable telegram-channel-poller"
```

### First-time Authentication
```bash
ssh volspike-do
cd /home/trader/volume-spike-bot
source .venv/bin/activate
python telegram_channel_poller.py
# Enter phone number and verification code when prompted
# Ctrl+C after successful login
```

### Fix Session File Permissions
```bash
# Session file must be writable by trader user
ssh volspike-do "sudo chown trader:trader /home/trader/volume-spike-bot/volspike_telegram.session"
ssh volspike-do "sudo chmod 666 /home/trader/volume-spike-bot/volspike_telegram.session"
```

### Service Management
```bash
# Start service
ssh volspike-do "sudo systemctl start telegram-channel-poller"

# Check status
ssh volspike-do "sudo systemctl status telegram-channel-poller"

# View logs
ssh volspike-do "sudo journalctl -u telegram-channel-poller -n 50 --no-pager"

# Follow logs in real-time
ssh volspike-do "sudo journalctl -u telegram-channel-poller -f"

# Restart service
ssh volspike-do "sudo systemctl restart telegram-channel-poller"

# Stop service
ssh volspike-do "sudo systemctl stop telegram-channel-poller"
```

### Reset State (Backfill Messages)
```bash
# Delete state file to re-fetch historical messages
ssh volspike-do "rm -f /home/trader/volume-spike-bot/.telegram_poller_state.json"
ssh volspike-do "sudo systemctl restart telegram-channel-poller"
```

## Troubleshooting

### Common Issues

1. **"TELEGRAM_API_ID and TELEGRAM_API_HASH must be set"**
   - Verify credentials in `/home/trader/.volspike.env`
   - Check env file has no extra spaces around `=`

2. **"sqlite3.OperationalError: attempt to write a readonly database"**
   - Session file has wrong permissions
   - Fix: `sudo chown trader:trader volspike_telegram.session && sudo chmod 666 volspike_telegram.session`

3. **"Backend error: 400 - Invalid datetime"**
   - Backend Zod validation too strict
   - Fixed by using `Date.parse()` instead of `z.string().datetime()`

4. **Service keeps restarting**
   - Check logs: `journalctl -u telegram-channel-poller -n 100`
   - Common causes: missing credentials, network issues, session expired

5. **0 new messages fetched**
   - Normal if no new messages since last poll
   - To backfill: delete `.telegram_poller_state.json` and restart

### Verifying the System

```bash
# Check backend health
curl https://volspike-production.up.railway.app/api/telegram/health

# Check service is running
ssh volspike-do "sudo systemctl status telegram-channel-poller"

# Check recent logs
ssh volspike-do "sudo journalctl -u telegram-channel-poller -n 20 --no-pager"

# Verify messages in admin panel
# Visit: https://volspike.com/admin/telegram
```

## Dependencies

### Digital Ocean (Python)
```
pyrogram>=2.0.0
tgcrypto>=1.2.5  # For faster crypto operations
requests>=2.25.0  # For HTTP requests to backend
```

### Backend (Node.js)
```
@prisma/client  # Database ORM (existing)
hono            # API framework (existing)
zod             # Validation (existing)
```

## Environment Variables

### Digital Ocean (.volspike.env)
```bash
# Telegram credentials
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_CHANNELS=marketfeed

# Backend connection (existing)
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your_alert_ingest_key
```

### Backend (Railway)
No new variables needed - uses existing `ALERT_INGEST_API_KEY` for authentication.

## Lessons Learned

1. **Environment file path**: Use absolute path `/home/trader/.volspike.env` instead of `~/.volspike.env` since `~` expands differently for root vs trader user.

2. **Session file permissions**: When running first-time auth as root, the session file is created with root ownership. Must change to trader before starting systemd service.

3. **Date format compatibility**: Python's `isoformat()` produces `+00:00` suffix, not `Z`. Use `Date.parse()` in Zod validation instead of `z.string().datetime()`.

4. **BigInt JSON serialization**: Telegram IDs are BigInt which can't be serialized to JSON directly. Convert to string before returning from API.

5. **Graceful shutdown**: Important for systemd services to handle SIGTERM properly and complete current operations before exit.
