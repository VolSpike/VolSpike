# Telegram Channel Monitor - Requirements

## Purpose

Monitor and display messages from public Telegram channels (specifically @marketfeed) in real-time on the admin panel. This provides administrators with a centralized view of market intelligence from Telegram without manually checking the app.

## Scope

### Included
- Fetch messages from public Telegram channels using Pyrogram
- Store the 1000 most recent messages in the database
- Admin panel page to view messages in real-time
- Message polling daemon running on Digital Ocean
- API endpoints for fetching stored messages

### Excluded
- Posting messages to channels (read-only)
- Private channels/groups (would require different auth)
- Media download/storage (text only initially)
- User-facing features (admin-only)
- Notifications/alerts based on message content (future enhancement)

## User Stories

1. **As an admin**, I want to view the latest messages from @marketfeed channel, so that I can stay informed about market signals without opening Telegram.

2. **As an admin**, I want to see messages in chronological order with timestamps, so that I can understand the timing of market events.

3. **As an admin**, I want messages to refresh automatically, so that I always see the most current information.

4. **As an admin**, I want to see message metadata (sender, date, views), so that I can assess message credibility and reach.

## Acceptance Criteria

1. **Message Fetching**
   - [ ] Pyrogram script runs as a daemon on Digital Ocean
   - [ ] Fetches new messages from @marketfeed every 30 seconds
   - [ ] Posts messages to backend API for storage
   - [ ] Handles reconnection and errors gracefully

2. **Message Storage**
   - [ ] Database stores up to 1000 messages per channel
   - [ ] Automatically cleans up older messages beyond limit
   - [ ] Stores: message ID, text, date, sender, views, channel info
   - [ ] Deduplicates by message ID

3. **Admin Panel**
   - [ ] New page at /admin/telegram
   - [ ] Displays messages in reverse chronological order
   - [ ] Shows message text, timestamp, sender name
   - [ ] Auto-refreshes every 30 seconds
   - [ ] Manual refresh button available
   - [ ] Shows channel stats (total messages, last update)

4. **API Endpoints**
   - [ ] GET /api/admin/telegram/messages - List messages with pagination
   - [ ] GET /api/admin/telegram/channels - List monitored channels
   - [ ] GET /api/admin/telegram/stats - Channel statistics
   - [ ] POST /api/telegram/ingest - Ingest messages (API key protected)

## Constraints

### Technical
- Pyrogram requires API credentials from Telegram (api_id, api_hash)
- Rate limits: Telegram allows ~30 requests/minute for channel history
- Must run on Digital Ocean (not Railway) to maintain persistent session
- Session file must be preserved across restarts

### Security
- Admin-only access for viewing messages
- API key authentication for message ingestion endpoint
- No storage of sensitive user data beyond message content

### Performance
- Polling interval: 30 seconds minimum
- Message limit: 1000 per channel
- API response time: < 1 second for message list
