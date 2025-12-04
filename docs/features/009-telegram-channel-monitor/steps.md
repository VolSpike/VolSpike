# Telegram Channel Monitor - Implementation Steps

## Prerequisites

### Manual Steps Required (User Action)

1. **Get Telegram API Credentials**
   - Go to https://my.telegram.org
   - Log in with your phone number
   - Go to "API development tools"
   - Create a new application
   - Note down: `api_id` and `api_hash`

2. **First-time Pyrogram Authentication**
   - After deploying the script, SSH into Digital Ocean
   - Run the script once manually to complete phone verification
   - This creates a session file that persists

## Implementation Steps

### Phase 1: Database Schema

- [ ] **1.1** Add TelegramChannel model to Prisma schema
- [ ] **1.2** Add TelegramMessage model to Prisma schema
- [ ] **1.3** Create and run database migration
- [ ] **1.4** Verify tables created in Neon DB

### Phase 2: Backend Service

- [ ] **2.1** Create TelegramService class (similar to NewsService)
  - getChannels()
  - getMessages()
  - ingestMessages()
  - cleanupOldMessages()
  - getStats()

- [ ] **2.2** Create ingest API route
  - POST /api/telegram/ingest
  - API key authentication
  - Message deduplication

### Phase 3: Admin API Routes

- [ ] **3.1** Create admin telegram routes file
  - GET /api/admin/telegram/messages
  - GET /api/admin/telegram/channels
  - GET /api/admin/telegram/stats

- [ ] **3.2** Register routes in admin index
- [ ] **3.3** Test endpoints with curl/Postman

### Phase 4: Admin Panel Frontend

- [ ] **4.1** Create /admin/telegram/page.tsx (server component)
- [ ] **4.2** Create TelegramMonitorClient component
- [ ] **4.3** Implement stats cards
- [ ] **4.4** Implement messages list with pagination
- [ ] **4.5** Add auto-refresh functionality
- [ ] **4.6** Add to admin sidebar navigation

### Phase 5: Digital Ocean Pyrogram Script

- [ ] **5.1** Create telegram_channel_poller.py
- [ ] **5.2** Install Pyrogram on Digital Ocean
- [ ] **5.3** Add Telegram credentials to .volspike.env
- [ ] **5.4** Create systemd service file
- [ ] **5.5** Deploy and test script
- [ ] **5.6** Complete first-time authentication (manual)
- [ ] **5.7** Enable and start service

### Phase 6: Testing & Verification

- [ ] **6.1** Verify messages appearing in database
- [ ] **6.2** Test admin panel displays messages
- [ ] **6.3** Test auto-refresh functionality
- [ ] **6.4** Verify message cleanup job works
- [ ] **6.5** Test error handling and reconnection

## Rollout Plan

1. Deploy database migration to production (Railway)
2. Deploy backend API routes (Railway auto-deploy)
3. Deploy frontend admin page (Vercel auto-deploy)
4. Deploy Pyrogram script to Digital Ocean
5. Complete Telegram authentication
6. Monitor logs for first 24 hours

## Rollback Plan

1. **Database**: Keep tables, messages are non-critical
2. **Backend**: Revert commit, Railway auto-redeploys
3. **Frontend**: Revert commit, Vercel auto-redeploys
4. **Digital Ocean**: Stop service with `systemctl stop telegram-poller`

## Testing Strategy

### Unit Tests
- TelegramService methods
- Message deduplication logic
- Cleanup job logic

### Integration Tests
- API endpoint responses
- Database operations
- Authentication checks

### Manual Tests
- Admin panel UI functionality
- Real-time message updates
- Error state handling

## Dependencies

```
# Digital Ocean (Python)
pyrogram>=2.0.0
tgcrypto>=1.2.5  # For faster crypto operations

# Backend (already installed)
@prisma/client  # Database ORM
hono            # API framework
```

## Environment Variables

### Digital Ocean (.volspike.env additions)
```
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_CHANNELS=marketfeed  # Comma-separated channel usernames
```

### Backend (Railway)
No new variables needed - uses existing VOLSPIKE_API_KEY for auth
