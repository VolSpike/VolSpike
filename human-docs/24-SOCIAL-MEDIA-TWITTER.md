# Social Media / Twitter Queue Feature

## Overview

The Social Media feature allows admins to queue Volume and Open Interest alerts for posting to Twitter/X. When an admin clicks the X button on an alert card, the system generates a professional-looking image card and adds it to a queue for review before posting.

**Key Components:**
- Twitter card image generation (canvas-based renderer)
- Admin queue management UI
- Twitter API integration for posting
- Persistent checkmark state across page refreshes

---

## Architecture

### Image Generation Flow

```
Admin clicks X button on alert
        ↓
Extract alert data (from prop or DOM)
        ↓
Generate image via Canvas renderer
    (fallback: html2canvas)
        ↓
Send image + alert data to backend API
        ↓
Backend stores in SocialMediaPost table
        ↓
Admin reviews in /admin/social-media
        ↓
Post to Twitter via Twitter API
```

### Why Canvas Renderer Instead of html2canvas

**Problem**: html2canvas has known issues with:
- Flexbox vertical alignment
- Text baseline positioning
- Line-height rendering inconsistencies
- Font metrics accuracy

**Solution**: We implemented a deterministic Canvas 2D renderer that:
- Calculates exact text positioning using `measureText()` with `actualBoundingBoxAscent/Descent`
- Guarantees consistent vertical centering of text in badges
- Renders identical output regardless of browser/environment
- Falls back to html2canvas only if canvas rendering fails

---

## File Inventory

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/twitter-card-canvas.ts` | Canvas-based Twitter card renderer (primary) |
| `src/lib/capture-alert-image.ts` | html2canvas capture utilities (fallback) |
| `src/components/admin/twitter-alert-card.tsx` | DOM-based card component (fallback) |
| `src/components/admin/add-to-twitter-button.tsx` | X button component with capture logic |
| `src/hooks/use-queued-alerts.ts` | Global cache for queued alert state |
| `src/app/(admin)/admin/social-media/page.tsx` | Admin queue page (server component) |
| `src/app/(admin)/admin/social-media/social-media-client.tsx` | Admin queue UI (client component) |

### Type Definitions

| File | Purpose |
|------|---------|
| `src/types/social-media.ts` | TypeScript types for social media features |

---

## Canvas Renderer (`twitter-card-canvas.ts`)

### Overview

The canvas renderer generates Twitter card images directly on a `<canvas>` element, providing pixel-perfect control over text positioning.

### Key Exports

```typescript
// Render a Twitter card and return as data URL
export async function renderTwitterCardDataUrl(options: {
  alert: TwitterAlertInput
  alertType: 'VOLUME' | 'OPEN_INTEREST'
  scale?: number  // Default: 2.5 for crisp text
}): Promise<string>

// Card dimensions
export const TWITTER_CARD_WIDTH = 480
export const TWITTER_CARD_HEIGHT = 270
```

### Card Layout

The card uses a 16:9 aspect ratio (480x270) optimized for Twitter:

```
┌─────────────────────────────────────────────────────┐
│  ↗ SYMBOL                            9:34 PM       │
│                               (less than a min ago) │
│                                                     │
│  [+4.12%] [5 min]                                   │
│                                                     │
│  Current OI: 348.88M                                │
│  5 min ago: 338.58M                                 │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  Price: +1.53%  OI: +3.04%  Funding: 0.005%  volspike.com │
└─────────────────────────────────────────────────────┘
```

### Vertical Text Centering Algorithm

The key innovation is computing exact text baselines for centered positioning:

```typescript
function computeCenteredBaseline(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerY: number
): number {
  const m = ctx.measureText(text)
  // Use font metrics when available (most modern browsers)
  const ascent = m.actualBoundingBoxAscent ?? m.fontBoundingBoxAscent ?? fontSize * 0.8
  const descent = m.actualBoundingBoxDescent ?? m.fontBoundingBoxDescent ?? fontSize * 0.2
  const textHeight = ascent + descent
  // Baseline positioned so text is vertically centered
  return centerY - textHeight / 2 + ascent
}
```

### Color Scheme

| Element | Up/Bullish | Down/Bearish | Neutral |
|---------|------------|--------------|---------|
| Border | `rgba(34, 197, 94, 0.4)` | `rgba(239, 68, 68, 0.4)` | `rgba(100, 116, 139, 0.4)` |
| Badge BG | `rgba(34, 197, 94, 0.15)` | `rgba(239, 68, 68, 0.15)` | `rgba(100, 116, 139, 0.15)` |
| Accent | `#22c55e` | `#ef4444` | `#64748b` |

### Timeframe Badge Colors

| Timeframe | Color | Hex |
|-----------|-------|-----|
| 5 min | Cyan | `rgba(6, 182, 212, 0.85)` |
| 15 min / 30m Update | Violet | `rgba(139, 92, 246, 0.85)` |
| 1 hour / Hourly Update | Amber | `rgba(245, 158, 11, 0.85)` |

### Footer Metrics

For **Volume alerts**, the footer shows:
- Price change (%)
- OI change (%) - extracted from `alert.oiChange`
- Funding rate (%)

For **OI alerts**, the footer shows:
- Price change (%)
- Funding rate (%)

---

## Add To Twitter Button (`add-to-twitter-button.tsx`)

### Props

```typescript
interface AddToTwitterButtonProps {
  alertId: string              // Unique alert ID
  alertType: AlertSourceType   // 'VOLUME' | 'OPEN_INTEREST'
  alertCardId: string          // DOM element ID for fallback capture
  alert?: any                  // Alert data (preferred - avoids DOM parsing)
  disabled?: boolean
  onSuccess?: () => void
}
```

### State Management

The button uses multiple state variables:

```typescript
const [isLoading, setIsLoading] = useState(false)      // Spinner visible
const [isAdded, setIsAdded] = useState(false)          // Checkmark visible
const [isUnqueuing, setIsUnqueuing] = useState(false)  // Unqueue in progress
```

### Image Generation Flow

```typescript
const handleAddToTwitter = async () => {
  // 1. Show spinner
  setIsLoading(true)

  // 2. Get alert data (prefer prop, fallback to DOM parsing)
  let data = alertProp
  if (!data) {
    data = await getAlertDataFromCard(cardElement, alertId, alertType)
  }

  // 3. Generate image (prefer canvas, fallback to html2canvas)
  let imageDataURL: string
  try {
    imageDataURL = await renderTwitterCardDataUrl({ alert: data, alertType })
  } catch (err) {
    imageDataURL = await captureTwitterCard(captureContainerId)
  }

  // 4. Show checkmark immediately (optimistic UI)
  setIsLoading(false)
  setIsAdded(true)
  markAsQueued(alertId)
  toast.success('Added to Twitter queue')

  // 5. Send to backend API
  await adminAPI.addToSocialMediaQueue({ alertId, alertType, imageUrl: imageDataURL })
}
```

### Unqueue Functionality

Clicking the green checkmark allows admins to remove an alert from the queue:

```typescript
const handleUnqueue = async () => {
  const postId = getPostId(alertId)
  await adminAPI.updateSocialMediaPost(postId, { status: 'REJECTED' })
  unmarkAsQueued(alertId)
  setIsAdded(false)
  toast.success('Removed from Twitter queue')
}
```

### Visual States

| State | Icon | Color | Clickable |
|-------|------|-------|-----------|
| Default | X logo | Gray | Yes (add to queue) |
| Loading | Spinner | Gray | No |
| Queued | Checkmark | Green | Yes (hover shows red, click to unqueue) |
| Posted | Checkmark | Green (dimmed) | No |

---

## Queued Alerts Hook (`use-queued-alerts.ts`)

### Purpose

Provides a global cache of queued alert IDs shared across all button instances. This ensures:
- Checkmarks persist across page navigation
- All button instances stay in sync
- Reduced API calls (30-second cache TTL)

### Data Structure

```typescript
// Global module-level cache
let queuedAlerts: Map<string, { postId: string; status: string }> = new Map()
let lastFetchTime = 0
const CACHE_TTL = 30000 // 30 seconds
```

### Exports

```typescript
export function useQueuedAlerts() {
  return {
    isLoaded: boolean,                    // Cache has been populated
    isAlertQueued: (id) => boolean,       // Check if alert is in queue
    getPostId: (id) => string | null,     // Get post ID for unqueue
    canUnqueue: (id) => boolean,          // Can be unqueued (not already posted)
    markAsQueued: (id, postId?) => void,  // Add to cache
    unmarkAsQueued: (id) => void,         // Remove from cache
    invalidateCache: () => void,          // Force refetch
    queuedCount: number,                  // Total queued count
  }
}
```

### Listener Pattern

Components subscribe to cache updates via a listener pattern:

```typescript
// Subscribe to cache updates
useEffect(() => {
  const listener = () => forceUpdate({})
  listeners.add(listener)
  return () => listeners.delete(listener)
}, [])

// Notify all listeners when cache changes
function notifyListeners() {
  listeners.forEach(cb => cb())
}
```

---

## Admin Social Media Page

### Server Component (`page.tsx`)

Handles authentication and wraps client component in AdminLayout:

```typescript
export default async function SocialMediaPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/auth?error=access_denied')
  }

  return (
    <AdminLayout>
      <SocialMediaClient accessToken={session.accessToken} />
    </AdminLayout>
  )
}
```

### Client Component (`social-media-client.tsx`)

Two-tab interface:
1. **Queue Tab** - Posts waiting to be reviewed/posted
2. **History Tab** - Previously posted tweets

### Optimistic UI Updates

When rejecting a post, the card is removed immediately without a full refresh:

```typescript
const handleReject = async () => {
  // Remove from UI immediately
  onOptimisticRemove?.(post.id)

  // Then update backend
  await adminAPI.updateSocialMediaPost(post.id, { status: 'REJECTED' })

  // Refresh in background
  onUpdate()
}
```

### History Count Sync

History is fetched on mount (background) so the tab count is always accurate:

```typescript
useEffect(() => {
  adminAPI.setAccessToken(accessToken)
  fetchQueue()
  fetchHistory(false)  // Background fetch for count
}, [accessToken])
```

---

## html2canvas Fallback (`capture-alert-image.ts`)

### When Used

The html2canvas path is only used when:
1. Canvas renderer throws an error
2. Browser doesn't support required Canvas APIs

### Improvements Made

1. **Font Readiness**: Wait for `document.fonts.ready` before capture
2. **Layout Flush**: Two RAF frames to ensure paint completion
3. **foreignObjectRendering**: Try for better CSS fidelity, fallback if fails
4. **Clone Normalization**: Reposition off-screen elements to (0,0) in cloned DOM
5. **Blank Detection**: Check if canvas is uniform background (capture failed)

```typescript
async function waitForFontsAndLayout(): Promise<void> {
  await document.fonts.ready
  await new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
}
```

### Debug Mode

Enable detailed logging by setting localStorage:

```javascript
localStorage.setItem('debugTwitterCapture', '1')
```

This logs:
- Element bounding boxes
- Computed styles (fontSize, lineHeight, padding)
- Renderer choice (foreignObject vs default)

---

## DOM-Based Card (`twitter-alert-card.tsx`)

### Purpose

React component that renders the Twitter card in DOM for html2canvas capture. Now primarily used as fallback.

### Layout Fixes Applied

Multiple attempts to fix vertical alignment:

1. `display: inline-block` instead of flex
2. `lineHeight` matching `height` for single-line centering
3. `transform: translateY(-1px)` baseline nudge
4. Explicit `px` line-heights instead of unitless values

### Data Attributes

Added for debug logging:

```tsx
<span data-capture="symbol">BTC</span>
<span data-capture="badge-primary">+4.12%</span>
<span data-capture="badge-timeframe">5 min</span>
```

---

## Backend Integration

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/social-media/queue` | Get queued posts |
| GET | `/api/admin/social-media/history` | Get posted tweets |
| POST | `/api/admin/social-media/queue` | Add alert to queue |
| PATCH | `/api/admin/social-media/queue/:id` | Update post (edit caption, reject) |
| POST | `/api/admin/social-media/post/:id` | Post to Twitter |

### Automatic Caption Generation

When the admin does not provide a custom caption, the backend generates one based on the alert type in `volspike-nodejs-backend/src/lib/caption-generator.ts`.

**Shared formatting rules**
- **Ticker formatting**: remove `USDT` suffix and prefix with `$` (e.g. `WCTUSDT` → `$WCT`).
- **Percent storage**: `%` fields are stored as fractions (e.g. `0.0942` means `+9.42%`) and must be multiplied by `100` for display.
- **Length limit**: captions are truncated to 280 chars (with `...` if needed).

**Volume alert caption**
- Symbol source: uses `alert.asset` when available (preferred), otherwise derives from `alert.symbol`.
- Template:
  - `🚨 $SYMBOL volume spike: {ratio}x in 1 hour! ${thisHour} this hour vs ${lastHour} last hour. Price: {pricePct} #crypto #altcoin #volspike`
- `thisHour/lastHour`: formatted as `$8.17M`, `$864K`, etc.

**Open Interest alert caption**
- OI units are **contracts** (not dollars): **no `$`** prefix for `Current OI` or the `(up/down ...)` value.
- Direction:
  - Uses `alert.direction` (`UP` → `up`, `DOWN` → `down`).
  - `absChange` is formatted using the **absolute value** (no leading `-` since `down` already conveys direction).
- Template:
  - `🚨 $SYMBOL Open Interest spike: {oiPct} in {timeframe}! Current OI: {currentOI} ({up/down} {absChange}). Price: {pricePct} #crypto #openinterest #volspike`

### Database Schema

```prisma
model SocialMediaPost {
  id          String   @id @default(cuid())
  alertId     String   // Reference to volume/OI alert
  alertType   String   // 'VOLUME' | 'OPEN_INTEREST'
  imageUrl    String   // Base64 data URL of generated image
  caption     String   // Tweet text
  status      String   // 'QUEUED' | 'POSTED' | 'REJECTED' | 'FAILED'
  twitterUrl  String?  // URL to posted tweet
  postedAt    DateTime?
  errorMessage String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Troubleshooting

### Issue: Text Misaligned in Generated Image

**Symptoms**: Badge text appears at bottom of badge instead of centered

**Solution**: The canvas renderer should handle this. If using fallback:
1. Check if `renderTwitterCardDataUrl` is throwing
2. Enable debug: `localStorage.setItem('debugTwitterCapture', '1')`
3. Check console for renderer choice and layout metrics

### Issue: OI Not Showing on Volume Cards

**Symptoms**: Volume alert Twitter cards show Price and Funding but not OI

**Causes**:
1. `alert.oiChange` not being passed to component
2. DOM parsing fallback not extracting OI

**Solution**: Ensure `alert` prop is passed to `AddToTwitterButton`:

```tsx
<AddToTwitterButton
  alertId={alert.id}
  alertType="VOLUME"
  alertCardId={`volume-alert-${alert.id}`}
  alert={alert}  // Pass full alert object
/>
```

### Issue: "Twitter card container not found"

**Symptoms**: Error toast when clicking X button

**Cause**: The capture container portal wasn't rendered before capture attempted

**Solution**: The current implementation waits 100ms for portal mount. If issue persists:
1. Increase timeout in `handleAddToTwitter`
2. Check if component is unmounting prematurely

### Issue: Checkmarks Disappear on Refresh

**Symptoms**: Green checkmarks revert to X icons after page refresh

**Solution**: The `useQueuedAlerts` hook fetches queue/history on mount. Check:
1. API is returning correct data
2. `isLoaded` state triggers re-render
3. No errors in `fetchQueuedAlerts`

### Issue: Rejecting Post Causes Flash/Reload

**Symptoms**: Whole page flashes when clicking X to reject

**Solution**: Use optimistic removal:

```typescript
// Remove immediately from local state
setQueue(prev => prev.filter(p => p.id !== postId))

// Then update backend
await adminAPI.updateSocialMediaPost(postId, { status: 'REJECTED' })
```

### Issue: History Tab Shows Wrong Count

**Symptoms**: History count stuck at 0 or outdated

**Solution**: Fetch history on mount and after actions:

```typescript
useEffect(() => {
  fetchQueue()
  fetchHistory(false)  // Background fetch
}, [accessToken])
```

---

## Development History

### December 2025 - Initial Implementation

1. Created basic Twitter queue UI
2. Implemented html2canvas image capture
3. Added queue/history tabs

### December 2025 - Alignment Issues

**Problem**: Text in badges and symbol appeared bottom-aligned in captured images

**Attempts**:
1. Flexbox with `alignItems: center` - didn't work in html2canvas
2. `inline-block` with `lineHeight` matching height - partial fix
3. Explicit `px` line-heights - minor improvement
4. `translateY` nudge - hack that wasn't reliable

**Resolution**: Created canvas-based renderer (`twitter-card-canvas.ts`) that computes exact text baselines using font metrics.

### December 2025 - OI Data Missing

**Problem**: Volume alert cards didn't show OI change in footer

**Cause**: Alert data was being extracted from DOM instead of passed directly

**Fix**:
1. Pass `alert` prop to `AddToTwitterButton`
2. Added OI regex extraction in DOM fallback
3. Added `oiChange` field to canvas renderer

### December 2025 - UX Improvements

**Problems**:
1. Rejecting posts caused full page flash
2. History count was stale
3. No "Added to queue" toast

**Fixes**:
1. Optimistic UI removal for reject
2. Fetch history on mount for accurate count
3. Restored success toast after capture

---

## Testing

### Manual Testing Checklist

- [ ] Click X on Volume alert - image generated with correct data
- [ ] Click X on OI alert - image generated with correct data
- [ ] Checkmark appears immediately after click
- [ ] Checkmark persists after page refresh
- [ ] Captions: `$SYMBOL` (no `USDT`), correct % values, and OI units have no `$`
- [ ] Click checkmark to unqueue - reverts to X
- [ ] Badge text centered vertically in image
- [ ] OI shows in Volume alert footer
- [ ] Timeframe badge has correct color (5min=cyan, 15min=violet, 1hr=amber)
- [ ] Reject in admin queue removes card smoothly
- [ ] History count updates after posting/rejecting
- [ ] Post to Twitter works and shows success

### Debug Capture

To debug image generation issues:

```javascript
// In browser console
localStorage.setItem('debugTwitterCapture', '1')

// Then click X button and check console for:
// - [CaptureImage] Twitter card layout debug
// - [CaptureImage] renderer { target, foreignObjectRendering, scale }
```

---

## Future Improvements

1. **Scheduled Posting**: Allow scheduling tweets for specific times
2. **Caption Templates**: Pre-defined caption templates per alert type
3. **Multi-Platform**: Support for other platforms (Telegram, Discord)
4. **Analytics**: Track engagement metrics for posted tweets
5. **Bulk Actions**: Select multiple alerts to queue at once
