# Telegram Channel Monitor - Design

## Status: IMPLEMENTED (December 2025)

## Architecture Overview

```
+-------------------+     +------------------+     +------------------+
|   Digital Ocean   |     |  Railway Backend |     |  Vercel Frontend |
|   (Pyrogram)      |---->|  (Hono API)      |<----|  (Next.js Admin) |
+-------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        |
   @marketfeed             PostgreSQL                Admin Panel
   @WatcherGuru            (Neon DB)                /admin/telegram
   (Telegram)
```

### Data Flow

1. **Pyrogram Poller** (Digital Ocean)
   - Connects to Telegram using user session (not bot)
   - Polls multiple channels every 30 seconds:
     - `@marketfeed` (category: macro) - macro market news
     - `@WatcherGuru` (category: crypto) - crypto-specific news
   - Posts new messages to backend `/api/telegram/ingest` with category
   - Tracks last seen message ID per channel to fetch only new messages

2. **Backend API** (Railway)
   - Receives and stores messages in PostgreSQL
   - Auto-cleanup keeps only last 1000 messages per channel
   - Provides admin endpoints for message retrieval
   - BigInt to string conversion for JSON serialization

3. **Admin Panel** (Vercel)
   - Fetches messages from backend API
   - Displays in real-time with 30-second auto-refresh
   - Admin authentication required
   - Channel management (enable/disable/delete)

## File Structure

```
volspike-nodejs-backend/
├── prisma/
│   └── schema.prisma              # TelegramChannel + TelegramMessage models
├── src/
│   ├── routes/
│   │   ├── telegram.ts            # Public ingest + health endpoints
│   │   └── admin/
│   │       └── telegram.ts        # Admin CRUD endpoints
│   └── services/
│       └── telegram.ts            # TelegramService class

volspike-nextjs-frontend/
└── src/app/(admin)/admin/telegram/
    ├── page.tsx                   # Server component with auth
    └── telegram-monitor-client.tsx # Client component with UI

Digital Ocean/
├── telegram_channel_poller.py     # Pyrogram polling script
└── telegram-channel-poller.service # systemd service file
```

## Database Schema

### TelegramChannel Table
```prisma
model TelegramChannel {
  id              String            @id @default(cuid())
  channelId       BigInt            @unique  // Telegram's numeric ID
  username        String            @unique  // @marketfeed (without @)
  title           String                     // Channel display name
  category        String            @default("general")  // macro, crypto, general
  enabled         Boolean           @default(true)
  lastFetchAt     DateTime?
  errorCount      Int               @default(0)
  lastError       String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  messages        TelegramMessage[]

  @@index([enabled])
  @@index([category])
  @@map("telegram_channels")
}
```

### Channel Categories
| Category | Color | Description |
|----------|-------|-------------|
| `macro` | Amber | Macro market news (e.g., @marketfeed) |
| `crypto` | Purple | Crypto-specific news (e.g., @WatcherGuru) |
| `general` | Slate | Default/other channels |

### TelegramMessage Table
```prisma
model TelegramMessage {
  id              String          @id @default(cuid())
  channelId       String
  messageId       BigInt                    // Telegram's message ID
  text            String?         @db.Text  // Message content (can be null for media-only)
  date            DateTime                  // Message timestamp from Telegram
  senderName      String?                   // From user/channel name
  views           Int?                      // View count
  forwards        Int?                      // Forward count
  hasMedia        Boolean         @default(false)
  mediaType       String?                   // photo, video, document, audio, voice, sticker, animation
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

### Public Endpoints (for Digital Ocean Poller)

#### POST /api/telegram/ingest
Receives messages from the Pyrogram poller.

**Headers:**
```
X-API-Key: {ALERT_INGEST_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "channel": {
    "id": -1001234567890,
    "username": "marketfeed",
    "title": "Market Feed",
    "category": "macro"
  },
  "messages": [
    {
      "id": 12345,
      "text": "BTC breaking out above 100k!",
      "date": "2025-12-04T10:30:00+00:00",
      "sender_name": "Market Feed",
      "views": 5000,
      "forwards": 100,
      "has_media": false,
      "media_type": null
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "inserted": 1,
  "duplicates": 0,
  "errors": 0
}
```

**Note:** Date format uses Python's `isoformat()` which produces `+00:00` suffix. The backend accepts any valid ISO 8601 date string via `Date.parse()`.

#### GET /api/telegram/health
Health check for the poller to verify backend connectivity.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T10:30:00.000Z"
}
```

### Admin Endpoints (require ADMIN role)

#### GET /api/admin/telegram/channels
List all monitored channels with message counts.

**Response:**
```json
{
  "channels": [
    {
      "id": "cuid...",
      "channelId": "1234567890",
      "username": "marketfeed",
      "title": "Market Feed",
      "category": "macro",
      "enabled": true,
      "lastFetchAt": "2025-12-04T10:30:00.000Z",
      "errorCount": 0,
      "lastError": null,
      "_count": {
        "messages": 100
      }
    }
  ]
}
```

#### GET /api/admin/telegram/messages
List messages with pagination.

**Query Parameters:**
- `channelId` (optional): Filter by channel internal ID
- `channelUsername` (optional): Filter by channel username
- `limit` (default: 50): Number of messages per page
- `page` (default: 1): Page number
- `before` (optional): Messages before this ISO date

**Response:**
```json
{
  "messages": [
    {
      "id": "cuid...",
      "messageId": "12345",
      "text": "BTC breaking out!",
      "date": "2025-12-04T10:30:00.000Z",
      "senderName": "Market Feed",
      "views": 5000,
      "forwards": 100,
      "hasMedia": false,
      "mediaType": null,
      "channel": {
        "id": "cuid...",
        "channelId": "1234567890",
        "username": "marketfeed",
        "title": "Market Feed",
        "category": "macro"
      }
    }
  ],
  "total": 100
}
```

#### GET /api/admin/telegram/stats
Get statistics for the admin dashboard.

**Response:**
```json
{
  "stats": {
    "totalChannels": 1,
    "enabledChannels": 1,
    "totalMessages": 100,
    "messagesLast24h": 50,
    "lastUpdate": "2025-12-04T10:30:00.000Z"
  }
}
```

#### PATCH /api/admin/telegram/channels/:id
Toggle channel enabled status.

**Request Body:**
```json
{
  "enabled": false
}
```

**Response:**
```json
{
  "channel": {
    "id": "cuid...",
    "enabled": false,
    ...
  }
}
```

#### DELETE /api/admin/telegram/channels/:id
Delete a channel and all its messages.

**Response:**
```json
{
  "success": true,
  "message": "Deleted channel @marketfeed and 100 messages"
}
```

## Pyrogram Script Design

### Configuration Constants
```python
SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / '.telegram_poller_state.json'
SESSION_NAME = 'volspike_telegram'
POLL_INTERVAL = 30  # seconds
MAX_MESSAGES_PER_FETCH = 100
BATCH_SIZE = 50  # Messages per API request

# Channel category mapping
CHANNEL_CATEGORIES = {
    'marketfeed': 'macro',
    'watcherguru': 'crypto',
}
```

### State Management
The script maintains state in `.telegram_poller_state.json`:
```json
{
  "last_message_ids": {
    "marketfeed": 842576,
    "WatcherGuru": 123456
  },
  "last_fetch": "2025-12-04T10:30:00+00:00"
}
```

This ensures:
- Only new messages are fetched after restart
- No duplicate processing
- Efficient API usage

### Key Components

1. **TelegramPoller class**
   - `load_state()` / `save_state()` - Persist last message IDs
   - `start()` / `stop()` - Manage Pyrogram client lifecycle
   - `fetch_channel_messages()` - Get new messages from channel
   - `extract_message_data()` - Convert Pyrogram message to dict
   - `send_to_backend()` - POST messages to Railway API
   - `poll_once()` / `run()` - Main polling loop

2. **Signal Handling**
   - SIGTERM/SIGINT trigger graceful shutdown
   - Completes current poll cycle before exit
   - Saves state before termination

3. **Error Handling**
   - FloodWait: Sleep for required duration
   - ChannelPrivate: Log and skip
   - UsernameNotOccupied: Log and skip
   - Network errors: Log and retry next cycle

### Systemd Service

**File:** `/etc/systemd/system/telegram-channel-poller.service`
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
TimeoutStopSec=30
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

## Security Considerations

1. **API Authentication**
   - Ingest endpoint protected by `ALERT_INGEST_API_KEY` (same as volume alerts)
   - Admin endpoints require ADMIN role via NextAuth session

2. **Telegram Credentials**
   - API ID and Hash stored in `/home/trader/.volspike.env`
   - Session file owned by trader user with restricted permissions
   - Never committed to git

3. **Data Handling**
   - BigInt IDs converted to strings for JSON (prevents precision loss)
   - Message text displayed as-is (no HTML rendering = XSS safe)
   - No sensitive user data stored

## Auto-Cleanup Implementation

Cleanup runs automatically after every successful message ingestion:

```typescript
// In TelegramService.ingestMessages()
await this.cleanupOldMessages(1000)
```

The cleanup logic:
1. Count total messages per channel
2. If count > 1000, find the date of the 1000th newest message
3. Delete all messages older than that date
4. Log cleanup results

This ensures the database never grows unbounded while keeping recent history.

## Technology Choices

| Component | Choice | Justification |
|-----------|--------|---------------|
| Telegram Library | Pyrogram 2.0 | Faster than Telethon, async, modern API, user session support |
| Message Storage | PostgreSQL | Consistent with existing stack, BigInt support |
| Polling Interval | 30 seconds | Balance between freshness and Telegram rate limits |
| Message Limit | 1000/channel | Sufficient history without bloating DB |
| Batch Size | 50 messages | Efficient API calls, prevents timeout |
| Session Storage | SQLite file | Pyrogram default, persists auth across restarts |
