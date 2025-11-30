# Add to Watchlist & Create Alert Buttons - Implementation Guide

**Location:** Asset slideout card (detail drawer) in Market Data table  
**File:** `volspike-nextjs-frontend/src/components/market-table.tsx` (lines 990-1008)

---

## Overview

The asset slideout card (detail drawer) appears when users click on a symbol in the Market Data table. It shows detailed information about the selected cryptocurrency and includes two action buttons:

1. **"Add to Watchlist"** - Save symbols to a personal watchlist
2. **"Create Alert"** - Set up custom price/volume alerts

Both buttons are currently **partially implemented** - the UI exists but the functionality needs to be connected.

---

## 1. Add to Watchlist Button

### What It's Supposed to Do

The "Add to Watchlist" button allows users to save symbols to a personal watchlist for quick access later. Users should be able to:

1. **Select an existing watchlist** or create a new one
2. **Add the symbol** to the selected watchlist
3. **View their watchlists** later (separate feature)
4. **Remove symbols** from watchlists

### Current Implementation Status

#### ✅ Backend (Fully Implemented)

**API Endpoints:**
- `GET /api/watchlist` - Get all user's watchlists
- `POST /api/watchlist` - Create new watchlist
- `GET /api/watchlist/:id` - Get specific watchlist
- `POST /api/watchlist/:id/symbols` - Add symbol to watchlist
- `DELETE /api/watchlist/:id/symbols/:symbol` - Remove symbol from watchlist
- `DELETE /api/watchlist/:id` - Delete watchlist

**File:** `volspike-nodejs-backend/src/routes/watchlist.ts`

**Database Schema:**
```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())
  items     WatchlistItem[]
  user      User     @relation(fields: [userId], references: [id])
}

model WatchlistItem {
  id          String @id @default(cuid())
  watchlistId String
  contractId  String
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id])
  contract    Contract  @relation(fields: [contractId], references: [id])
  @@unique([watchlistId, contractId])
}
```

**How It Works:**
1. User creates a watchlist with a name (e.g., "My Favorites")
2. Symbols are added to watchlists via `WatchlistItem` records
3. Each symbol is linked to a `Contract` record (created if doesn't exist)
4. Users can have multiple watchlists
5. Symbols can be in multiple watchlists

#### ❌ Frontend (Not Implemented)

**Current Code:**
```typescript:455:459:volspike-nextjs-frontend/src/components/market-table.tsx
const handleAddToWatchlist = (e: React.MouseEvent, item: MarketData) => {
    e.stopPropagation()
    // TODO: Implement watchlist functionality
    console.log('Add to watchlist:', formatSymbol(item.symbol))
}
```

**What's Missing:**
1. **Watchlist Selection UI** - Dialog/modal to select existing watchlist or create new
2. **API Integration** - Call to `/api/watchlist/:id/symbols` endpoint
3. **State Management** - Fetch and cache user's watchlists
4. **Success/Error Handling** - Toast notifications for success/failure
5. **Visual Feedback** - Show which watchlists contain the symbol

### How to Implement

#### Step 1: Create Watchlist Selection Component

**File:** `volspike-nextjs-frontend/src/components/watchlist-selector.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

interface Watchlist {
  id: string
  name: string
  items: Array<{ contract: { symbol: string } }>
}

interface WatchlistSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  onSuccess?: () => void
}

export function WatchlistSelector({ open, onOpenChange, symbol, onSuccess }: WatchlistSelectorProps) {
  const { data: session } = useSession()
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [mode, setMode] = useState<'select' | 'create'>('select')

  // Fetch user's watchlists
  useEffect(() => {
    if (!open || !session?.user) return

    const fetchWatchlists = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/watchlist`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setWatchlists(data)
        }
      } catch (error) {
        console.error('Failed to fetch watchlists:', error)
      }
    }

    fetchWatchlists()
  }, [open, session])

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) {
      toast.error('Please enter a watchlist name')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      })

      if (response.ok) {
        const newWatchlist = await response.json()
        setWatchlists([newWatchlist, ...watchlists])
        setSelectedWatchlistId(newWatchlist.id)
        setNewWatchlistName('')
        setMode('select')
        toast.success(`Watchlist "${newWatchlist.name}" created`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create watchlist')
      }
    } catch (error) {
      toast.error('Failed to create watchlist')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistId) {
      toast.error('Please select a watchlist')
      return
    }

    // Check if symbol already in watchlist
    const watchlist = watchlists.find(w => w.id === selectedWatchlistId)
    const alreadyAdded = watchlist?.items.some(item => item.contract.symbol === symbol)

    if (alreadyAdded) {
      toast.error(`${symbol} is already in this watchlist`)
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/watchlist/${selectedWatchlistId}/symbols`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ symbol }),
        }
      )

      if (response.ok) {
        toast.success(`Added ${symbol} to watchlist`)
        onSuccess?.()
        onOpenChange(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add symbol')
      }
    } catch (error) {
      toast.error('Failed to add symbol to watchlist')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {symbol} to Watchlist</DialogTitle>
          <DialogDescription>
            Select an existing watchlist or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'select' ? 'default' : 'outline'}
              onClick={() => setMode('select')}
              className="flex-1"
            >
              Select Existing
            </Button>
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              onClick={() => setMode('create')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>

          {/* Create Mode */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>Watchlist Name</Label>
              <Input
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="e.g., My Favorites"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWatchlist()}
              />
              <Button
                onClick={handleCreateWatchlist}
                disabled={isCreating || !newWatchlistName.trim()}
                className="w-full"
              >
                {isCreating ? 'Creating...' : 'Create Watchlist'}
              </Button>
            </div>
          )}

          {/* Select Mode */}
          {mode === 'select' && (
            <div className="space-y-2">
              {watchlists.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No watchlists yet</p>
                  <p className="text-sm">Create one to get started</p>
                </div>
              ) : (
                <RadioGroup value={selectedWatchlistId || ''} onValueChange={setSelectedWatchlistId}>
                  {watchlists.map((watchlist) => (
                    <div key={watchlist.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                      <RadioGroupItem value={watchlist.id} id={watchlist.id} />
                      <Label htmlFor={watchlist.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{watchlist.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {watchlist.items.length} symbol{watchlist.items.length !== 1 ? 's' : ''}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Add Button */}
          {mode === 'select' && watchlists.length > 0 && (
            <Button
              onClick={handleAddToWatchlist}
              disabled={isAdding || !selectedWatchlistId}
              className="w-full"
            >
              {isAdding ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### Step 2: Update Market Table Component

**File:** `volspike-nextjs-frontend/src/components/market-table.tsx`

```typescript
// Add import
import { WatchlistSelector } from '@/components/watchlist-selector'

// Add state
const [watchlistSelectorOpen, setWatchlistSelectorOpen] = useState(false)
const [selectedSymbolForWatchlist, setSelectedSymbolForWatchlist] = useState<string | null>(null)

// Update handleAddToWatchlist
const handleAddToWatchlist = (e: React.MouseEvent, item: MarketData) => {
    e.stopPropagation()
    setSelectedSymbolForWatchlist(item.symbol)
    setWatchlistSelectorOpen(true)
}

// Add component before closing tag
{watchlistSelectorOpen && selectedSymbolForWatchlist && (
    <WatchlistSelector
        open={watchlistSelectorOpen}
        onOpenChange={setWatchlistSelectorOpen}
        symbol={selectedSymbolForWatchlist}
        onSuccess={() => {
            // Optional: refresh watchlist data if needed
        }}
    />
)}
```

#### Step 3: Register Watchlist Routes

**File:** `volspike-nodejs-backend/src/index.ts`

Ensure watchlist routes are registered:

```typescript
import { watchlistRoutes } from './routes/watchlist'

// In your route registration
app.route('/api/watchlist', watchlistRoutes)
```

---

## 2. Create Alert Button

### What It's Supposed to Do

The "Create Alert" button allows users to set up custom alerts for price movements or volume spikes. Users should be able to:

1. **Select alert type** (price alert, volume spike alert, funding rate alert)
2. **Set thresholds** (e.g., price above $50,000 or volume spike 3x)
3. **Choose delivery method** (in-app, email for Pro/Elite, SMS for Elite)
4. **Receive notifications** when conditions are met

### Current Implementation Status

#### ✅ Frontend UI (Partially Implemented)

**Alert Builder Component:**
- File: `volspike-nextjs-frontend/src/components/alert-builder.tsx`
- Fully functional UI with:
  - Alert type selection (presets)
  - Symbol input (pre-filled from button click)
  - Threshold input
  - Delivery method selection
  - Test button

**Current Flow:**
1. User clicks "Create Alert" button
2. `onCreateAlert` callback is triggered
3. Alert builder sheet opens with symbol pre-filled
4. User fills in alert details
5. **TODO:** API call to create alert (currently just logs to console)

**Code:**
```typescript:100:119:volspike-nextjs-frontend/src/components/alert-builder.tsx
const handleCreate = async () => {
    if (!alertSymbol || !threshold) {
        toast.error('Please fill in all required fields')
        return
    }

    try {
        // TODO: Implement alert creation API call
        console.log('Creating alert:', {
            symbol: alertSymbol,
            preset: selectedPreset,
            threshold,
            delivery: deliveryMethod
        })
        toast.success(`Alert created for ${alertSymbol}!`)
        onOpenChange(false)
    } catch (error) {
        toast.error('Failed to create alert')
    }
}
```

#### ❌ Backend API (Not Implemented)

**What's Missing:**
1. **Alert Creation Endpoint** - `POST /api/alerts`
2. **Alert Storage** - Use existing `Alert` model or create custom alert model
3. **Alert Evaluation Engine** - Check alerts against market data
4. **Alert Triggering** - Send notifications when conditions met

**Existing Database Schema:**
```prisma
model Alert {
  id             String   @id @default(cuid())
  userId         String
  contractId     String
  reason         String // "spike_3x", "volume_min", etc.
  threshold      Float
  triggeredValue Float
  isDelivered    Boolean  @default(false)
  createdAt      DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id])
  contract Contract @relation(fields: [contractId], references: [id])
}
```

**Note:** The existing `Alert` model seems designed for triggered alerts, not custom user-created alerts. You may need to create a new `CustomAlert` model.

### How to Implement

#### Option A: Use Existing Alert Model (Simple)

If you want to reuse the existing `Alert` model, you'll need to:

1. **Create Alert Endpoint**

**File:** `volspike-nodejs-backend/src/routes/alerts.ts`

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { requireUser } from '../lib/hono-extensions'

const alerts = new Hono()

const createAlertSchema = z.object({
  symbol: z.string().min(1),
  reason: z.enum(['spike_3x', 'spike_5x', 'volume_min', 'price_above', 'price_below', 'funding_above', 'funding_below']),
  threshold: z.number().positive(),
  deliveryMethod: z.enum(['in_app', 'email', 'sms']).default('in_app'),
})

alerts.post('/', async (c) => {
  try {
    const user = requireUser(c)
    const body = await c.req.json()
    const { symbol, reason, threshold, deliveryMethod } = createAlertSchema.parse(body)

    // Check tier restrictions
    if (deliveryMethod === 'email' && user.tier !== 'pro' && user.tier !== 'elite') {
      return c.json({ error: 'Email alerts require Pro or Elite tier' }, 403)
    }
    if (deliveryMethod === 'sms' && user.tier !== 'elite') {
      return c.json({ error: 'SMS alerts require Elite tier' }, 403)
    }

    // Get or create contract
    let contract = await prisma.contract.findUnique({
      where: { symbol },
    })

    if (!contract) {
      contract = await prisma.contract.create({
        data: {
          symbol,
          precision: 2,
        },
      })
    }

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        userId: user.id,
        contractId: contract.id,
        reason,
        threshold,
        triggeredValue: 0, // Will be set when triggered
        isDelivered: false,
      },
      include: {
        contract: {
          select: { symbol: true },
        },
      },
    })

    return c.json(alert)
  } catch (error) {
    console.error('Create alert error:', error)
    return c.json({ error: 'Failed to create alert' }, 500)
  }
})

// Get user's alerts
alerts.get('/', async (c) => {
  try {
    const user = requireUser(c)
    const alerts = await prisma.alert.findMany({
      where: { userId: user.id },
      include: {
        contract: {
          select: { symbol: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return c.json(alerts)
  } catch (error) {
    return c.json({ error: 'Failed to fetch alerts' }, 500)
  }
})

// Delete alert
alerts.delete('/:id', async (c) => {
  try {
    const user = requireUser(c)
    const alertId = c.req.param('id')
    
    const deleted = await prisma.alert.deleteMany({
      where: {
        id: alertId,
        userId: user.id,
      },
    })

    if (deleted.count === 0) {
      return c.json({ error: 'Alert not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete alert' }, 500)
  }
})

export { alerts as alertRoutes }
```

#### Option B: Create Custom Alert Model (Recommended)

For more flexibility, create a new `CustomAlert` model:

**File:** `volspike-nodejs-backend/prisma/schema.prisma`

```prisma
model CustomAlert {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol        String   // e.g., "BTCUSDT"
  name          String?  // Optional custom name
  alertType     AlertType // PRICE_ABOVE, PRICE_BELOW, VOLUME_SPIKE, FUNDING_ABOVE, etc.
  threshold     Float
  deliveryMethod String  // "in_app", "email", "sms"
  isActive      Boolean  @default(true)
  lastTriggered DateTime?
  triggerCount  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
  @@index([symbol, isActive])
  @@map("custom_alerts")
}

enum AlertType {
  PRICE_ABOVE
  PRICE_BELOW
  VOLUME_SPIKE_3X
  VOLUME_SPIKE_5X
  VOLUME_SPIKE_10X
  FUNDING_ABOVE
  FUNDING_BELOW
  CHANGE_24H_ABOVE
  CHANGE_24H_BELOW
}
```

#### Step 2: Update Alert Builder Component

**File:** `volspike-nextjs-frontend/src/components/alert-builder.tsx`

```typescript
const handleCreate = async () => {
    if (!alertSymbol || !threshold) {
        toast.error('Please fill in all required fields')
        return
    }

    try {
        // Map preset to alert type
        const alertTypeMap: Record<string, string> = {
            'spike_3x': 'VOLUME_SPIKE_3X',
            'spike_5x': 'VOLUME_SPIKE_5X',
            'spike_10x': 'VOLUME_SPIKE_10X',
            'price_above': 'PRICE_ABOVE',
            'price_below': 'PRICE_BELOW',
            'funding_above': 'FUNDING_ABOVE',
            'funding_below': 'FUNDING_BELOW',
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                symbol: alertSymbol,
                alertType: alertTypeMap[selectedPreset] || 'VOLUME_SPIKE_3X',
                threshold,
                deliveryMethod: deliveryMethod,
            }),
        })

        if (response.ok) {
            toast.success(`Alert created for ${alertSymbol}!`)
            onOpenChange(false)
        } else {
            const error = await response.json()
            toast.error(error.error || 'Failed to create alert')
        }
    } catch (error) {
        toast.error('Failed to create alert')
    }
}
```

#### Step 3: Create Alert Evaluation Engine

**File:** `volspike-nodejs-backend/src/services/alert-evaluator.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import { EmailService } from './email'
// Import SMS service when implemented

export async function evaluateAlerts(
  prisma: PrismaClient,
  symbol: string,
  marketData: {
    price: number
    volume24h: number
    change24h: number
    fundingRate: number
  }
) {
  // Get all active alerts for this symbol
  const alerts = await prisma.customAlert.findMany({
    where: {
      symbol,
      isActive: true,
    },
    include: {
      user: {
        select: { id: true, email: true, tier: true },
      },
    },
  })

  for (const alert of alerts) {
    let triggered = false
    let triggeredValue = 0

    switch (alert.alertType) {
      case 'PRICE_ABOVE':
        triggered = marketData.price >= alert.threshold
        triggeredValue = marketData.price
        break
      case 'PRICE_BELOW':
        triggered = marketData.price <= alert.threshold
        triggeredValue = marketData.price
        break
      case 'VOLUME_SPIKE_3X':
        // This would need historical volume data
        // For now, use volume alerts system
        break
      case 'FUNDING_ABOVE':
        triggered = marketData.fundingRate >= alert.threshold
        triggeredValue = marketData.fundingRate
        break
      case 'FUNDING_BELOW':
        triggered = marketData.fundingRate <= alert.threshold
        triggeredValue = marketData.fundingRate
        break
      // ... other alert types
    }

    if (triggered) {
      // Update alert
      await prisma.customAlert.update({
        where: { id: alert.id },
        data: {
          lastTriggered: new Date(),
          triggerCount: { increment: 1 },
        },
      })

      // Send notifications based on delivery method
      if (alert.deliveryMethod === 'email' && alert.user.email) {
        const emailService = EmailService.getInstance()
        await emailService.sendAlertEmail({
          email: alert.user.email,
          symbol,
          alertType: alert.alertType,
          threshold: alert.threshold,
          triggeredValue,
        })
      }

      // TODO: SMS notifications for Elite tier
      // TODO: In-app notifications via Socket.IO
    }
  }
}
```

#### Step 4: Integrate with Market Data Updates

Call `evaluateAlerts` whenever market data updates:

**File:** `volspike-nodejs-backend/src/services/alert-evaluator.ts`

```typescript
// In your market data update handler
import { evaluateAlerts } from './alert-evaluator'

// After receiving market data update
await evaluateAlerts(prisma, symbol, {
  price: marketData.price,
  volume24h: marketData.volume24h,
  change24h: marketData.change24h,
  fundingRate: marketData.fundingRate,
})
```

---

## Summary

### Add to Watchlist
- **Backend:** ✅ Fully implemented
- **Frontend:** ❌ Needs watchlist selector component and API integration
- **Effort:** 1-2 days

### Create Alert
- **Backend:** ❌ Needs alert creation endpoint and evaluation engine
- **Frontend:** ⚠️ UI exists, needs API integration
- **Effort:** 3-5 days (including alert evaluation engine)

### Next Steps

1. **Implement Watchlist Selector** (Priority: High)
   - Create `watchlist-selector.tsx` component
   - Integrate with market table
   - Test add/remove functionality

2. **Implement Alert Creation** (Priority: Medium)
   - Create alert API endpoints
   - Update alert builder to call API
   - Create alert evaluation engine
   - Integrate with market data updates

3. **Future Enhancements**
   - Watchlist management page
   - Alert management page
   - Alert history/logs
   - Bulk alert operations

---

**Last Updated:** December 2025

