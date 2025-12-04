# Telegram Channel Monitor - Design

## Architecture Overview

```
+-------------------+     +------------------+     +------------------+
|   Digital Ocean   |     |  Railway Backend |     |  Vercel Frontend |
|   (Pyrogram)      |---->|  (Hono API)      |<----|  (Next.js Admin) |
+-------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        |
   @marketfeed             PostgreSQL                Admin Panel
   (Telegram)              (Neon DB)                /admin/telegram
```

### Data Flow

1. **Pyrogram Poller** (Digital Ocean)
   - Connects to Telegram using user session (not bot)
   - Polls @marketfeed channel every 30 seconds
   - Posts new messages to backend `/api/telegram/ingest`

2. **Backend API** (Railway)
   - Receives and stores messages in PostgreSQL
   - Provides admin endpoints for message retrieval
   - Maintains 1000 message limit per channel

3. **Admin Panel** (Vercel)
   - Fetches messages from backend API
   - Displays in real-time with auto-refresh
   - Admin authentication required

## Database Schema

### TelegramChannel Table
```prisma
model TelegramChannel {
  id              String            @id @default(cuid())
  channelId       BigInt            @unique  // Telegram's numeric ID
  username        String            @unique  // @marketfeed
  title           String                     // Channel display name
  enabled         Boolean           @default(true)
  lastFetchAt     DateTime?
  errorCount      Int               @default(0)
  lastError       String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  messages        TelegramMessage[]

  @@index([enabled])
  @@map("telegram_channels")
}
```

### TelegramMessage Table
```prisma
model TelegramMessage {
  id              String          @id @default(cuid())
  channelId       String
  messageId       BigInt                    // Telegram's message ID
  text            String?         @db.Text  // Message content
  date            DateTime                  // Message timestamp
  senderName      String?                   // From user/channel name
  views           Int?                      // View count
  forwards        Int?                      // Forward count
  hasMedia        Boolean         @default(false)
  mediaType       String?                   // photo, video, document, etc.
  createdAt       DateTime        @default(now())
  channel         TelegramChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@unique([channelId, messageId])  // Dedupe by channel + message ID
  @@index([date(sort: Desc)])
  @@index([channelId])
  @@index([createdAt(sort: Desc)])
  @@map("telegram_messages")
}
```

## API Contracts

### Ingest Endpoint (Digital Ocean -> Backend)

**POST /api/telegram/ingest**

Headers:
```
X-API-Key: {VOLSPIKE_API_KEY}
Content-Type: application/json
```

Request Body:
```json
{
  "channel": {
    "id": -1001234567890,
    "username": "marketfeed",
    "title": "Market Feed"
  },
  "messages": [
    {
      "id": 12345,
      "text": "BTC breaking out above 100k!",
      "date": "2025-12-04T10:30:00Z",
      "sender_name": "Market Feed",
      "views": 5000,
      "forwards": 100,
      "has_media": false,
      "media_type": null
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "inserted": 1,
  "duplicates": 0
}
```

### Admin Endpoints

**GET /api/admin/telegram/messages**

Query Parameters:
- `channelId` (optional): Filter by channel
- `limit` (default: 50, max: 200): Number of messages
- `page` (default: 1): Pagination
- `before` (optional): Messages before this date

Response:
```json
{
  "messages": [
    {
      "id": "cuid...",
      "messageId": 12345,
      "text": "BTC breaking out!",
      "date": "2025-12-04T10:30:00Z",
      "senderName": "Market Feed",
      "views": 5000,
      "forwards": 100,
      "hasMedia": false,
      "channel": {
        "username": "marketfeed",
        "title": "Market Feed"
      }
    }
  ],
  "total": 1000,
  "page": 1,
  "totalPages": 20
}
```

**GET /api/admin/telegram/channels**

Response:
```json
{
  "channels": [
    {
      "id": "cuid...",
      "channelId": -1001234567890,
      "username": "marketfeed",
      "title": "Market Feed",
      "enabled": true,
      "lastFetchAt": "2025-12-04T10:30:00Z",
      "messageCount": 1000
    }
  ]
}
```

**GET /api/admin/telegram/stats**

Response:
```json
{
  "totalChannels": 1,
  "enabledChannels": 1,
  "totalMessages": 1000,
  "messagesLast24h": 150,
  "lastUpdate": "2025-12-04T10:30:00Z"
}
```

## UI/UX Design

### Admin Page Layout (/admin/telegram)

```
+-------------------------------------------------------+
| Telegram Channel Monitor                    [Refresh] |
+-------------------------------------------------------+
| Stats Cards:                                          |
| [Channels: 1] [Messages: 1000] [Last 24h: 150] [Last] |
+-------------------------------------------------------+
| Channel: @marketfeed                                  |
| Last Updated: 2 minutes ago                           |
+-------------------------------------------------------+
| Messages:                                             |
| +---------------------------------------------------+ |
| | 10:30 AM  BTC breaking out above 100k!            | |
| | Market Feed | 5k views | 100 forwards             | |
| +---------------------------------------------------+ |
| | 10:25 AM  ETH showing strength...                 | |
| | Market Feed | 3k views | 50 forwards              | |
| +---------------------------------------------------+ |
| | ... more messages ...                             | |
+-------------------------------------------------------+
| [Load More]                                           |
+-------------------------------------------------------+
```

### Component Hierarchy

```
/admin/telegram/page.tsx (Server Component)
  └── TelegramMonitorClient.tsx (Client Component)
        ├── Stats Cards (4x)
        ├── Channel Info Section
        └── Messages List
              └── MessageCard (repeated)
```

## Pyrogram Script Design

### File: telegram_channel_poller.py

```python
# Location: Digital Ocean /home/trader/volume-spike-bot/

# Key Components:
# 1. Pyrogram client with session persistence
# 2. Channel message fetching loop
# 3. Backend API posting
# 4. State management (last message ID)
# 5. Error handling and reconnection

# State File: .telegram_poller_state.json
{
  "last_message_ids": {
    "marketfeed": 12345
  },
  "last_fetch": "2025-12-04T10:30:00Z"
}
```

### Systemd Service

```ini
[Unit]
Description=VolSpike Telegram Channel Poller
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python telegram_channel_poller.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Security Considerations

1. **API Authentication**
   - Ingest endpoint protected by VOLSPIKE_API_KEY
   - Admin endpoints require ADMIN role via session

2. **Telegram Credentials**
   - API ID and Hash stored in .volspike.env
   - Session file permissions restricted (chmod 600)

3. **Data Sanitization**
   - Message text sanitized before display (XSS prevention)
   - No HTML rendering of message content

4. **Rate Limiting**
   - Ingest endpoint: 100 requests/minute
   - Admin endpoints: Standard admin rate limits

## Performance Considerations

1. **Polling Efficiency**
   - Only fetch messages newer than last known ID
   - Batch insert messages (up to 100 per request)

2. **Database Optimization**
   - Indexes on date, channelId, createdAt
   - Cleanup job to maintain 1000 message limit

3. **Frontend Performance**
   - Pagination with 50 messages per page
   - Auto-refresh every 30 seconds
   - Optimistic UI updates

## Technology Choices

| Component | Choice | Justification |
|-----------|--------|---------------|
| Telegram Library | Pyrogram | Faster than Telethon, async, modern API |
| Message Storage | PostgreSQL | Consistent with existing stack |
| Polling Interval | 30 seconds | Balance between freshness and rate limits |
| Message Limit | 1000 | Sufficient history without bloating DB |
