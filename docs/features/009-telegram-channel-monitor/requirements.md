# Telegram Channel Monitor - Requirements

## Status: IMPLEMENTED (December 2025)

## Purpose

Monitor and display messages from public Telegram channels (specifically @marketfeed) in real-time on the admin panel. This provides administrators with a centralized view of market intelligence from Telegram without manually checking the app.

## Scope

### Included
- Fetch messages from public Telegram channels using Pyrogram
- Store the 1000 most recent messages per channel in the database
- Admin panel page to view messages in real-time
- Message polling daemon running on Digital Ocean
- API endpoints for fetching stored messages
- Automatic cleanup to maintain message limits

### Excluded
- Posting messages to channels (read-only)
- Private channels/groups (would require different auth)
- Media download/storage (text only, media type indicated)
- User-facing features (admin-only)
- Notifications/alerts based on message content (future enhancement)

## User Stories

1. **As an admin**, I want to view the latest messages from @marketfeed channel, so that I can stay informed about market signals without opening Telegram.

2. **As an admin**, I want to see messages in chronological order with timestamps, so that I can understand the timing of market events.

3. **As an admin**, I want messages to refresh automatically, so that I always see the most current information.

4. **As an admin**, I want to see message metadata (sender, date, views), so that I can assess message credibility and reach.

5. **As an admin**, I want to enable/disable channels and delete them if needed, so that I can manage which channels are monitored.

## Acceptance Criteria - ALL COMPLETE

1. **Message Fetching**
   - [x] Pyrogram script runs as a daemon on Digital Ocean
   - [x] Fetches new messages from @marketfeed every 30 seconds
   - [x] Posts messages to backend API for storage
   - [x] Handles reconnection and errors gracefully
   - [x] Graceful shutdown on SIGTERM/SIGINT

2. **Message Storage**
   - [x] Database stores up to 1000 messages per channel
   - [x] Automatically cleans up older messages on every ingestion
   - [x] Stores: message ID, text, date, sender, views, forwards, media info
   - [x] Deduplicates by channel + message ID combination

3. **Admin Panel**
   - [x] New page at /admin/telegram
   - [x] Displays messages in reverse chronological order
   - [x] Shows message text, timestamp, sender name, views, forwards
   - [x] Auto-refreshes every 30 seconds
   - [x] Manual refresh button available
   - [x] Shows channel stats (total messages, last update, 24h count)
   - [x] Channel enable/disable toggle
   - [x] Channel delete functionality

4. **API Endpoints**
   - [x] GET /api/admin/telegram/messages - List messages with pagination
   - [x] GET /api/admin/telegram/channels - List monitored channels
   - [x] GET /api/admin/telegram/stats - Channel statistics
   - [x] PATCH /api/admin/telegram/channels/:id - Toggle channel enabled
   - [x] DELETE /api/admin/telegram/channels/:id - Delete channel and messages
   - [x] POST /api/telegram/ingest - Ingest messages (API key protected)
   - [x] GET /api/telegram/health - Health check for poller

## Constraints

### Technical
- Pyrogram requires API credentials from Telegram (api_id, api_hash)
- Rate limits: Telegram allows ~30 requests/minute for channel history
- Must run on Digital Ocean (not Railway) to maintain persistent session
- Session file must be preserved across restarts
- BigInt handling required for Telegram IDs (converted to string for JSON)

### Security
- Admin-only access for viewing messages
- API key authentication for message ingestion endpoint (reuses ALERT_INGEST_API_KEY)
- No storage of sensitive user data beyond message content

### Performance
- Polling interval: 30 seconds
- Message limit: 1000 per channel (auto-cleanup)
- Batch size: 50 messages per API request
- API response time: < 1 second for message list
