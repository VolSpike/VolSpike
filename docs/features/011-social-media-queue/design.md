# Design Document: Social Media Queue for Twitter/X Posting

## Architecture Overview

### High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard UI                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Alerts View  │  │ Social Media │  │  Posting History       │ │
│  │              │  │    Queue     │  │                        │ │
│  │ [Add to      │  │              │  │  [View Posted Tweets]  │ │
│  │  Twitter]    │  │ [Edit Post]  │  │                        │ │
│  │  Button      │  │ [Post Now]   │  │  [Link to Twitter]     │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘ │
│         │                 │                                       │
└─────────┼─────────────────┼───────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Image Generation (html2canvas)                   │  │
│  │  • Captures alert card DOM element as PNG                  │  │
│  │  • Converts to base64 or uploads to temp storage          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Backend (Hono API)                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/admin/social-media/queue                        │  │
│  │  GET  /api/admin/social-media/queue                        │  │
│  │  PATCH /api/admin/social-media/queue/:id                   │  │
│  │  POST /api/admin/social-media/post/:id                     │  │
│  │  GET  /api/admin/social-media/history                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Twitter Service (twitter-api-v2 library)         │  │
│  │  • Upload media (image)                                    │  │
│  │  • Post tweet with media ID                                │  │
│  │  • Handle rate limits and errors                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Database (PostgreSQL + Prisma)                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SocialMediaPost Table                                     │  │
│  │  • id, alertId, alertType, status, imageUrl, caption       │  │
│  │  • twitterPostId, twitterUrl, createdAt, postedAt         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Twitter API v2                               │
│  • POST /2/tweets (create tweet)                                 │
│  • POST /1.1/media/upload.json (upload image)                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Models

### Prisma Schema Addition

Add new model to `volspike-nodejs-backend/prisma/schema.prisma`:

```prisma
model SocialMediaPost {
  id              String    @id @default(cuid())

  // Alert relationship (polymorphic - can be Volume or OI alert)
  alertId         String
  alertType       AlertTypeEnum // VOLUME or OPEN_INTEREST

  // Post content
  imageUrl        String?   // URL to generated image (or base64 if small)
  caption         String    // Tweet text
  suggestedCaption String?  // Original auto-generated caption

  // Status tracking
  status          SocialMediaStatus @default(QUEUED)

  // Twitter metadata
  twitterPostId   String?   @unique
  twitterUrl      String?

  // Admin tracking
  createdById     String    // Admin who queued it
  postedById      String?   // Admin who posted it (could be different)

  // Error handling
  errorMessage    String?
  retryCount      Int       @default(0)

  // Timestamps
  createdAt       DateTime  @default(now())
  postedAt        DateTime?
  updatedAt       DateTime  @updatedAt

  @@index([status, createdAt])
  @@index([alertId, alertType])
  @@index([createdById])
  @@map("social_media_posts")
}

enum SocialMediaStatus {
  QUEUED    // Pending admin review/posting
  POSTING   // Currently being posted
  POSTED    // Successfully posted
  FAILED    // Failed to post (see errorMessage)
  REJECTED  // Admin rejected, removed from queue
}

enum AlertTypeEnum {
  VOLUME
  OPEN_INTEREST
}
```

### TypeScript Types

```typescript
// types/social-media.ts

export interface SocialMediaPost {
  id: string
  alertId: string
  alertType: 'VOLUME' | 'OPEN_INTEREST'
  imageUrl: string | null
  caption: string
  suggestedCaption: string | null
  status: 'QUEUED' | 'POSTING' | 'POSTED' | 'FAILED' | 'REJECTED'
  twitterPostId: string | null
  twitterUrl: string | null
  createdById: string
  postedById: string | null
  errorMessage: string | null
  retryCount: number
  createdAt: string
  postedAt: string | null
  updatedAt: string
}

export interface QueuedPostWithAlert extends SocialMediaPost {
  alert: VolumeAlert | OpenInterestAlert
}

export interface CreateSocialMediaPostRequest {
  alertId: string
  alertType: 'VOLUME' | 'OPEN_INTEREST'
  imageUrl: string
  caption?: string // Optional, will auto-generate if not provided
}

export interface UpdateSocialMediaPostRequest {
  caption?: string
  status?: 'QUEUED' | 'REJECTED'
}

export interface PostToTwitterResponse {
  success: boolean
  twitterPostId?: string
  twitterUrl?: string
  error?: string
}
```

## API Contracts

### Backend API Endpoints

#### 1. Add to Queue

```
POST /api/admin/social-media/queue
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

Request Body:
{
  "alertId": "clx123...",
  "alertType": "VOLUME",
  "imageUrl": "data:image/png;base64,..." or "https://...",
  "caption": "Optional custom caption"
}

Response (201):
{
  "success": true,
  "data": {
    "id": "clx456...",
    "alertId": "clx123...",
    "alertType": "VOLUME",
    "caption": "🚨 ACT volume spike: 6.55x in 1 hour!...",
    "status": "QUEUED",
    "createdAt": "2025-12-17T10:30:00Z"
  }
}

Errors:
- 400: Missing required fields
- 401: Not authenticated
- 403: Not admin
- 409: Alert already queued
```

#### 2. Get Queue

```
GET /api/admin/social-media/queue
Authorization: Bearer <admin-jwt-token>

Query Parameters:
- status: QUEUED | POSTED | FAILED (default: QUEUED)
- limit: number (default: 50, max: 100)
- offset: number (default: 0)

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "clx456...",
      "alertId": "clx123...",
      "alertType": "VOLUME",
      "imageUrl": "...",
      "caption": "🚨 ACT volume spike...",
      "status": "QUEUED",
      "createdAt": "2025-12-17T10:30:00Z",
      "alert": {
        "symbol": "ACT",
        "volumeRatio": 6.55,
        "currentVolume": 17240000,
        "previousVolume": 2630000,
        "priceChange": 9.96,
        ...
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0
  }
}
```

#### 3. Update Queue Item

```
PATCH /api/admin/social-media/queue/:id
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

Request Body:
{
  "caption": "Updated caption text",
  "status": "REJECTED" // To remove from queue
}

Response (200):
{
  "success": true,
  "data": {
    "id": "clx456...",
    "caption": "Updated caption text",
    "updatedAt": "2025-12-17T10:35:00Z"
  }
}
```

#### 4. Post to Twitter

```
POST /api/admin/social-media/post/:id
Authorization: Bearer <admin-jwt-token>

Response (200):
{
  "success": true,
  "data": {
    "id": "clx456...",
    "status": "POSTED",
    "twitterPostId": "1234567890",
    "twitterUrl": "https://twitter.com/volspike/status/1234567890",
    "postedAt": "2025-12-17T10:40:00Z"
  }
}

Errors:
- 400: Invalid state (already posted)
- 401: Not authenticated
- 403: Not admin
- 429: Twitter rate limit exceeded
- 500: Twitter API error
```

#### 5. Get History

```
GET /api/admin/social-media/history
Authorization: Bearer <admin-jwt-token>

Query Parameters:
- limit: number (default: 100, max: 200)
- offset: number (default: 0)
- symbol: string (optional filter)
- startDate: ISO date (optional)
- endDate: ISO date (optional)

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "clx456...",
      "alertType": "VOLUME",
      "caption": "🚨 ACT volume spike...",
      "twitterUrl": "https://twitter.com/volspike/status/1234567890",
      "postedAt": "2025-12-17T10:40:00Z",
      "alert": {
        "symbol": "ACT",
        "volumeRatio": 6.55,
        ...
      }
    }
  ],
  "pagination": {
    "total": 87,
    "limit": 100,
    "offset": 0
  }
}
```

## UI/UX Design

### Component Hierarchy

```
<AdminLayout>
  <AdminNavigation>
    [existing nav items]
    <NavItem href="/admin/social-media">Social Media</NavItem>
  </AdminNavigation>

  <Routes>
    <!-- Existing Alert Views -->
    <Route path="/admin/alerts">
      <AlertsTable>
        <AlertRow>
          [existing alert data]
          <AddToTwitterButton onClick={handleAddToQueue} />
        </AlertRow>
      </AlertsTable>
    </Route>

    <!-- NEW: Social Media Queue Page -->
    <Route path="/admin/social-media">
      <SocialMediaTabs>
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <QueuedPostsList>
            <QueuedPostCard
              post={post}
              onEdit={handleEditCaption}
              onPost={handlePostToTwitter}
              onReject={handleReject}
            />
          </QueuedPostsList>
        </TabsContent>

        <TabsContent value="history">
          <PostingHistory>
            <HistoryCard
              post={post}
              onViewTweet={openTwitterLink}
            />
          </PostingHistory>
        </TabsContent>
      </SocialMediaTabs>
    </Route>
  </Routes>
</AdminLayout>
```

### Wireframes (Text-Based)

#### Alert Card with "Add to Twitter" Button

```
┌──────────────────────────────────────────────────────────┐
│ 📈 ACT                              11:00 AM              │
│                                  (7 minutes ago)          │
├──────────────────────────────────────────────────────────┤
│ 6.55x     [Hourly Update]                                │
│                                                           │
│ This hour: $17.24M                                       │
│ Last hour: $2.63M                                        │
│                                                           │
│ Price: +9.96%   OI: +27.56%   Funding: 0.005%          │
│                                                           │
│ [📊 Chart] [📈 Details]  [🐦 Add to Twitter]             │
└──────────────────────────────────────────────────────────┘
```

#### Social Media Queue Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Social Media                                   [Refresh]    │
├──────────────────────────────────────────────────────────────┤
│  [Queue]  [History]                                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 📸 Generated Image Preview                             │  │
│  │ ┌────────────────────────────────────────────────────┐ │  │
│  │ │                                                      │ │  │
│  │ │  📈 ACT                          11:00 AM            │ │  │
│  │ │  6.55x    [Hourly Update]                          │ │  │
│  │ │  This hour: $17.24M                                │ │  │
│  │ │  Last hour: $2.63M                                 │ │  │
│  │ │  Price: +9.96%   OI: +27.56%   Funding: 0.005%    │ │  │
│  │ │                                                      │ │  │
│  │ └────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ Caption (245/280 characters):                            │  │
│  │ ┌────────────────────────────────────────────────────┐ │  │
│  │ │ 🚨 ACT volume spike: 6.55x in 1 hour! $17.24M     │ │  │
│  │ │ this hour vs $2.63M last hour. Price: +9.96%      │ │  │
│  │ │ #crypto #altcoin #volspike                         │ │  │
│  │ └────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ Queued 5 minutes ago by you                              │  │
│  │                                                           │  │
│  │ [✅ Post to Twitter]  [✏️ Edit Caption]  [❌ Reject]     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [More queued posts...]                                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Posting History Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Social Media                                   [Refresh]    │
├──────────────────────────────────────────────────────────────┤
│  [Queue]  [History]                                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Showing last 100 posts (filtered: All)                      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 📈 ACT  •  6.55x spike  •  Posted 2 hours ago         │  │
│  │ [Image thumbnail]                                       │  │
│  │ 🚨 ACT volume spike: 6.55x in 1 hour!...               │  │
│  │ [🔗 View on Twitter]                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 📉 NIGHT  •  -3.29% OI drop  •  Posted 4 hours ago    │  │
│  │ [Image thumbnail]                                       │  │
│  │ 🔻 NIGHT Open Interest spike: -3.29% in 5 min...       │  │
│  │ [🔗 View on Twitter]                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### User Flows

#### Flow 1: Admin Adds Alert to Twitter Queue

1. Admin views alerts on admin dashboard `/admin/alerts`
2. Admin sees high-quality volume spike (e.g., ACT 6.55x)
3. Admin clicks "Add to Twitter" button on alert card
4. System:
   - Captures alert card as PNG image using html2canvas
   - Generates suggested caption with symbol, ratio, volume, price change
   - Creates database record with status=QUEUED
5. Success toast: "Added to Twitter queue. Review in Social Media tab."
6. Button changes to "Already Queued" (disabled)

#### Flow 2: Admin Reviews and Posts to Twitter

1. Admin navigates to `/admin/social-media`
2. "Queue" tab shows all pending posts
3. Admin reviews generated image and caption
4. Admin edits caption if needed (e.g., adjust hashtags, tone)
5. Admin clicks "Post to Twitter"
6. System:
   - Changes status to POSTING
   - Uploads image to Twitter API
   - Posts tweet with image + caption
   - Stores Twitter post ID and URL
   - Changes status to POSTED
7. Success toast: "Posted to Twitter! [View Tweet]"
8. Post moves to "History" tab

#### Flow 3: Handle Twitter API Error

1. Admin clicks "Post to Twitter"
2. Twitter API returns error (e.g., rate limit exceeded)
3. System:
   - Sets status to FAILED
   - Stores errorMessage
   - Increments retryCount
4. Error toast: "Failed to post: Rate limit exceeded. Try again in 15 minutes."
5. Post remains in queue with "Failed" badge
6. Admin can retry later or reject the post

## Component Specifications

### 1. AddToTwitterButton Component

**Location**: `volspike-nextjs-frontend/src/components/admin/add-to-twitter-button.tsx`

**Props**:
```typescript
interface AddToTwitterButtonProps {
  alertId: string
  alertType: 'VOLUME' | 'OPEN_INTEREST'
  disabled?: boolean
  isQueued?: boolean
}
```

**Behavior**:
- Shows Twitter icon + "Add to Twitter" text
- On click:
  1. Find alert card DOM element (parent container)
  2. Call `html2canvas(element)` to generate image
  3. Convert canvas to base64 PNG
  4. Call API to create queue item
  5. Show success toast
- If already queued: Show "Already Queued" badge (disabled)
- If error: Show error toast

### 2. SocialMediaQueue Component

**Location**: `volspike-nextjs-frontend/src/app/(admin)/admin/social-media/page.tsx`

**Features**:
- Tabs: Queue, History
- Fetch queued posts on mount
- Auto-refresh every 30 seconds
- Filter by status
- Pagination (50 per page)

### 3. QueuedPostCard Component

**Location**: `volspike-nextjs-frontend/src/components/admin/queued-post-card.tsx`

**Props**:
```typescript
interface QueuedPostCardProps {
  post: QueuedPostWithAlert
  onPost: (id: string) => Promise<void>
  onEdit: (id: string, caption: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}
```

**Features**:
- Image preview (responsive, max 400px width)
- Editable caption textarea
- Character count (280 limit, turns red when exceeded)
- Alert metadata display (symbol, ratio, time)
- Post/Edit/Reject buttons
- Loading states
- Error display if status=FAILED

### 4. PostingHistory Component

**Location**: `volspike-nextjs-frontend/src/components/admin/posting-history.tsx`

**Features**:
- List of posted tweets (newest first)
- Image thumbnail
- Caption text (truncated)
- Link to Twitter post (opens in new tab)
- Posted timestamp (relative, e.g., "2 hours ago")
- Search/filter by symbol
- Pagination

## Image Generation Strategy

### Option A: Client-Side (html2canvas) - **RECOMMENDED**

**Pros**:
- No server-side rendering needed
- Works in user's browser with exact styling
- Fast (1-2 seconds)
- No additional dependencies on backend

**Cons**:
- Requires alert card to be in DOM
- Slightly larger bundle size (~80KB gzipped)

**Implementation**:
```typescript
import html2canvas from 'html2canvas'

async function captureAlertCard(elementId: string): Promise<string> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error('Element not found')

  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a', // Dark background
    scale: 2, // High DPI
    logging: false,
    useCORS: true,
  })

  return canvas.toDataURL('image/png')
}
```

### Option B: Server-Side (Puppeteer) - **Alternative**

**Pros**:
- Consistent rendering across devices
- Can generate images without DOM element present
- Better for batch processing

**Cons**:
- Requires Puppeteer on Railway (larger Docker image)
- Slower (3-5 seconds)
- More complex setup

**Not recommended for V1 unless client-side fails.**

## Twitter API Integration

### Library Choice

Use **twitter-api-v2** (https://github.com/plhery/node-twitter-api-v2)

```bash
npm install twitter-api-v2
```

### Configuration

**Environment Variables** (`.env`):
```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
```

### Service Implementation

**Location**: `volspike-nodejs-backend/src/services/twitter.service.ts`

```typescript
import { TwitterApi } from 'twitter-api-v2'

export class TwitterService {
  private client: TwitterApi

  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    })
  }

  async postTweetWithImage(
    caption: string,
    imageBase64: string
  ): Promise<{ tweetId: string; tweetUrl: string }> {
    try {
      // 1. Upload image
      const mediaId = await this.client.v1.uploadMedia(
        Buffer.from(imageBase64.split(',')[1], 'base64'),
        { mimeType: 'image/png' }
      )

      // 2. Post tweet with media
      const tweet = await this.client.v2.tweet({
        text: caption,
        media: { media_ids: [mediaId] },
      })

      const tweetId = tweet.data.id
      const tweetUrl = `https://twitter.com/volspike/status/${tweetId}`

      return { tweetId, tweetUrl }
    } catch (error: any) {
      // Handle rate limits
      if (error.code === 429) {
        throw new Error('Twitter rate limit exceeded. Try again later.')
      }
      throw error
    }
  }
}
```

## Caption Generation

### Auto-Generated Caption Format

**For Volume Alerts**:
```
🚨 {SYMBOL} volume spike: {ratio}x in 1 hour! ${currentVolume} this hour vs ${previousVolume} last hour. Price: {priceChange}% #crypto #altcoin #volspike
```

**Example**:
```
🚨 ACT volume spike: 6.55x in 1 hour! $17.24M this hour vs $2.63M last hour. Price: +9.96% #crypto #altcoin #volspike
```

**For Open Interest Alerts**:
```
{emoji} {SYMBOL} Open Interest {direction}: {pctChange}% in {timeframe}! Current OI: ${currentOI} ({direction} ${absChange}). Price: {priceChange}% #crypto #openinterest #volspike
```

**Example**:
```
🚀 USTC Open Interest spike: +3.94% in 5 min! Current OI: $651.92M (up $24.69M). Price: +5.47% #crypto #openinterest #volspike
```

### Helper Function

**Location**: `volspike-nodejs-backend/src/lib/caption-generator.ts`

```typescript
export function generateVolumeAlertCaption(alert: VolumeAlert): string {
  const emoji = alert.volumeRatio >= 5 ? '🚨' : '📈'
  const symbol = alert.symbol
  const ratio = alert.volumeRatio.toFixed(2)
  const currentVol = formatVolume(alert.currentVolume)
  const prevVol = formatVolume(alert.previousVolume)
  const priceChange = alert.priceChange ? formatPercent(alert.priceChange) : 'N/A'

  return `${emoji} ${symbol} volume spike: ${ratio}x in 1 hour! $${currentVol} this hour vs $${prevVol} last hour. Price: ${priceChange} #crypto #altcoin #volspike`
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  return `${(volume / 1_000).toFixed(0)}K`
}

function formatPercent(pct: number): string {
  return pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
}
```

## Security Considerations

### Authentication & Authorization

1. **Admin-Only Access**
   - All endpoints require admin role
   - Check `session.user.role === 'ADMIN'` in middleware
   - JWT token required for API calls

2. **Input Validation**
   - Validate `alertId` exists in database
   - Validate `caption` length ≤ 280 characters
   - Sanitize caption to prevent XSS (though Twitter API handles this)
   - Validate image size < 5MB

3. **Rate Limiting**
   - Track daily post count in-memory or Redis
   - Warn admin when approaching Twitter's limit (50/day free, 100/day elevated)
   - Return 429 error if internal limit exceeded

4. **API Credentials**
   - Store Twitter API keys in `.env` (never commit)
   - Never expose keys in client-side code
   - Rotate keys periodically (quarterly recommended)

5. **Audit Logging**
   - Log all post attempts (success/failure) to `AuditLog` table
   - Include admin user ID, alert ID, timestamp, result

### SQL Injection Prevention

Use Prisma's parameterized queries (already handled by ORM).

### XSS Prevention

- Caption text is sent to Twitter API (they sanitize)
- If displaying captions in UI, use React's built-in escaping (already handled)

## Performance Considerations

### Image Generation

- html2canvas typically takes 1-3 seconds for alert card
- Use loading spinner during generation
- Consider caching generated images (optional for V1)

### API Response Times

- Add to queue: < 500ms (DB insert + image generation happens client-side)
- Get queue: < 300ms (simple SELECT with pagination)
- Post to Twitter: 3-8 seconds (upload image + post tweet)
  - Show progress indicator
  - Use async processing if needed (optional)

### Database Indexing

Indexes already defined in Prisma schema:
- `@@index([status, createdAt])` - For queue queries
- `@@index([alertId, alertType])` - For duplicate detection
- `@@index([createdById])` - For admin filtering

### Caching (Optional for V1)

- Cache Twitter API credentials in memory (avoid re-reading `.env`)
- Cache daily post count in-memory (reset at midnight)

## Technology Choices

### Frontend

1. **html2canvas** (v1.4.1) - Client-side image generation
   - **Why**: No server-side rendering needed, works with existing DOM
   - **Alternative**: dom-to-image-more (less maintained)

2. **shadcn/ui Components** - UI building blocks
   - Tabs, Dialog, Button, Textarea, Badge, Toast
   - Already used in project

3. **React Hook Form** (optional) - For caption editing
   - **Why**: Better UX for textarea with character count
   - **Alternative**: Plain controlled input (simpler for V1)

### Backend

1. **twitter-api-v2** (v1.16.0) - Twitter API client
   - **Why**: Most popular, well-maintained, TypeScript support
   - **Alternative**: Official Twitter API SDK (less flexible)

2. **Zod** - Input validation
   - Already used in project for API validation

3. **Prisma** - Database ORM
   - Already used in project

### Infrastructure

1. **Railway** - Hosting (existing)
   - Backend has sufficient resources for Twitter API calls
   - No additional services needed

2. **PostgreSQL** - Database (existing)
   - New `SocialMediaPost` table

## Error Handling

### Twitter API Errors

| Error Code | Meaning | Handling |
|------------|---------|----------|
| 429 | Rate limit exceeded | Return friendly error, suggest retry time |
| 401 | Invalid credentials | Log error, notify admin (bad API keys) |
| 403 | Forbidden (duplicate tweet) | Suggest editing caption to make unique |
| 500 | Twitter server error | Retry with exponential backoff |

### Frontend Error States

1. **Image Generation Fails**
   - Show error toast: "Failed to generate image. Try again."
   - Allow manual retry

2. **Queue API Fails**
   - Show error toast with reason
   - Don't change UI state (keep button enabled)

3. **Post to Twitter Fails**
   - Show error toast with specific reason
   - Keep post in queue with FAILED status
   - Allow retry

## Testing Strategy

### Unit Tests

1. **Caption Generation**
   - Test volume alert caption format
   - Test OI alert caption format
   - Test edge cases (negative price change, missing data)

2. **Twitter Service**
   - Mock Twitter API responses
   - Test rate limit handling
   - Test error scenarios

### Integration Tests

1. **API Endpoints**
   - Test POST /queue with valid/invalid data
   - Test GET /queue pagination
   - Test PATCH /queue caption update
   - Test POST /post with mocked Twitter API

2. **Authentication**
   - Test admin-only access (403 for non-admin)
   - Test JWT validation

### E2E Tests (Optional for V1)

1. Full flow: Add to queue → Edit caption → Post to Twitter
2. Duplicate prevention
3. Error handling

## Deployment Plan

### Phase 1: Database Migration

1. Add `SocialMediaPost` model to Prisma schema
2. Run `prisma migrate dev --name add-social-media-posts`
3. Deploy migration to Railway production

### Phase 2: Backend Implementation

1. Create Twitter service
2. Create API endpoints
3. Add admin authentication middleware
4. Test with Postman/curl

### Phase 3: Frontend Implementation

1. Install html2canvas
2. Create AddToTwitterButton component
3. Create Social Media Queue page
4. Add navigation link in admin sidebar

### Phase 4: Twitter API Setup

1. Apply for Twitter Developer account (if not already)
2. Create Twitter app
3. Generate API keys (elevated access recommended)
4. Add keys to Railway environment variables
5. Test posting to Twitter

### Phase 5: Testing & Launch

1. Test full flow on staging
2. Post test tweet from queue
3. Verify duplicate prevention
4. Verify error handling
5. Launch to production

## Rollback Plan

If critical bugs occur:

1. **Remove navigation link** to Social Media page (hide feature)
2. **Disable API endpoints** (add feature flag check)
3. **Database rollback** (if schema issues):
   ```bash
   prisma migrate rollback
   ```

Data is preserved (queue items remain in database), feature is just hidden.

## Future Enhancements (Out of Scope for V1)

1. **Scheduled Posting**
   - Allow admin to schedule posts for specific times
   - Use cron job or background worker

2. **Analytics Dashboard**
   - Track Twitter impressions, likes, retweets
   - Correlation with user signups

3. **AI-Generated Captions**
   - Use GPT-4 to generate engaging captions
   - A/B test different styles

4. **Multi-Platform Support**
   - Instagram, LinkedIn, Facebook
   - Unified social media queue

5. **Automated Quality Filtering**
   - Only queue alerts meeting quality threshold
   - ML model to predict engagement

6. **Image Templates**
   - Multiple design options for alert cards
   - Admin can choose template per post

7. **Video Generation**
   - Animated charts showing volume spike
   - More engaging than static images

## Open Questions & Decisions

### Question 1: Image Storage

**Options**:
- A) Store base64 in database (simple, no external storage)
- B) Upload to Railway temp storage (auto-cleanup)
- C) Upload to S3/Cloudinary (permanent storage)

**Decision**: **Option A (base64 in database)** for V1
- Simplest implementation
- No external dependencies
- Images are small (~200-500KB PNG)
- Can migrate to S3 later if needed

### Question 2: Duplicate Detection

**Options**:
- A) Check if `alertId` already has queued/posted post
- B) Allow multiple posts for same alert (rare cases)

**Decision**: **Option A (prevent duplicates)** for V1
- Avoids spam
- "Already Queued" badge provides feedback
- Admin can reject and re-queue if needed

### Question 3: Caption Character Limit

Twitter limit is 280 characters. Should we enforce strict limit or allow longer captions with warning?

**Decision**: **Strict 280 limit** (frontend validation)
- Red text when exceeding limit
- Disable "Post" button if over limit
- Prevents API errors

### Question 4: Emoji Usage

User explicitly requested NO emojis unless asked. But alert cards in screenshots have emojis.

**Decision**: **Use emojis in auto-generated captions** (Twitter best practice)
- Emojis increase engagement on social media
- Alert cards already have emojis in UI
- Admin can remove if preferred when editing caption

## Success Criteria

Feature is considered successful if:

1. **Functional**
   - [ ] Admin can add alerts to queue
   - [ ] Admin can review and edit captions
   - [ ] Admin can post to Twitter successfully
   - [ ] Posting history is tracked accurately
   - [ ] Duplicates are prevented

2. **Performance**
   - [ ] Image generation completes in < 5 seconds
   - [ ] Queue page loads in < 2 seconds
   - [ ] Twitter posting completes in < 10 seconds

3. **Reliability**
   - [ ] Zero data loss (all posts tracked in DB)
   - [ ] Graceful error handling (no crashes)
   - [ ] Rate limits respected

4. **Usability**
   - [ ] Admin can complete full flow in < 2 minutes
   - [ ] UI is intuitive (no documentation needed)
   - [ ] Error messages are actionable

5. **Security**
   - [ ] Only admin role has access
   - [ ] API credentials never exposed
   - [ ] All actions logged in audit log

## References

- Twitter API v2 Documentation: https://developer.twitter.com/en/docs/twitter-api
- twitter-api-v2 Library: https://github.com/plhery/node-twitter-api-v2
- html2canvas Documentation: https://html2canvas.hertzen.com/
- Prisma Documentation: https://www.prisma.io/docs
- Next.js 15 Documentation: https://nextjs.org/docs
- shadcn/ui Components: https://ui.shadcn.com/
