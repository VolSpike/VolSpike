# Price Color Persistence Fix for VolSpike

## Problem Summary

The price color persistence feature briefly flashes correctly but then reverts to neutral when:
1. No new price updates arrive for a while
2. Price formatting changes (e.g., 999.99 → 1,000.12 adds a comma)
3. The component remounts (tab switches, layout changes)

## Root Causes

### 1. **Index Out of Bounds**
When storing `suffixIndex` as the position where strings differ, this index can become invalid when the formatted string length changes due to:
- Thousand separators appearing/disappearing
- Decimal precision changes
- The index equaling `formatted.length`, resulting in empty suffix

### 2. **Component Remounting**
The `useRef` values are lost when:
- User switches tabs (mobile)
- Layout changes trigger remounts
- The dashboard re-renders

### 3. **Formatting Instability**
Using `Intl.NumberFormat` with `useGrouping: true` creates unstable string lengths that break the stored index mapping.

## Recommended Solution

### Option 1: Store "Last N Digits" Instead of Index (RECOMMENDED)

Instead of storing the exact character index where the change occurred, store how many digits from the end should remain colored. This approach is resilient to formatting changes.

**Implementation:**

```typescript
// In market-table.tsx, replace the price cell rendering logic:

<td className={`p-3 text-right font-mono-tabular text-sm transition-colors duration-150${cellHoverBg}`}>
    {(() => {
        const formatted = formatPriceNoSymbol(item.price)
        if (!FLASH_ENABLED) {
            prevPriceRef.current.set(item.symbol, item.price)
            return formatted
        }
        
        const now = Date.now()
        const prev = prevPriceRef.current.get(item.symbol)
        let wholeClass = ''
        let prefix = formatted
        let suffix = ''
        
        if (typeof prev === 'number' && prev !== item.price) {
            const lastFlashTs = lastFlashTsRef.current.get(item.symbol) || 0
            if (now - lastFlashTs > MIN_INTERVAL_MS) {
                const dir: 'up' | 'down' = item.price > prev ? 'up' : 'down'
                
                // Find where strings differ
                const prevFormatted = formatPriceNoSymbol(prev)
                const minLen = Math.min(prevFormatted.length, formatted.length)
                let idx = 0
                while (idx < minLen && prevFormatted[idx] === formatted[idx]) idx++
                
                // Calculate how many digits from the end changed
                const digitsChanged = Math.max(1, formatted.length - idx)
                
                flashRef.current.set(item.symbol, {
                    dir,
                    wholeUntil: now + WHOLE_MS,
                    suffixUntil: now + SUFFIX_MS,
                    suffixIndex: idx,
                })
                
                lastFlashTsRef.current.set(item.symbol, now)
                lastDirRef.current.set(item.symbol, dir)
                
                // Store last N digits to color (capped at 3 for stability)
                persistentRef.current.set(item.symbol, {
                    dir,
                    lastDigits: Math.min(digitsChanged, 3)
                })
            }
        }
        
        prevPriceRef.current.set(item.symbol, item.price)
        
        const flash = flashRef.current.get(item.symbol)
        const persistent = persistentRef.current.get(item.symbol)
        const lastDir = lastDirRef.current.get(item.symbol)
        
        if (flash && now < flash.suffixUntil) {
            // Active animation
            wholeClass = now < flash.wholeUntil 
                ? (flash.dir === 'up' ? 'price-text-flash-up' : 'price-text-flash-down') 
                : ''
            const idx = Math.min(Math.max(flash.suffixIndex, 0), formatted.length - 1)
            prefix = formatted.slice(0, idx)
            suffix = formatted.slice(idx)
        } else if (persistent?.lastDigits) {
            // Persistent color using lastDigits
            const digitsToColor = Math.min(persistent.lastDigits, formatted.length)
            const idx = Math.max(0, formatted.length - digitsToColor)
            prefix = formatted.slice(0, idx)
            suffix = formatted.slice(idx)
        } else if (lastDir) {
            // Fallback: color last digit
            const idx = Math.max(0, formatted.length - 1)
            prefix = formatted.slice(0, idx)
            suffix = formatted.slice(idx)
        }
        
        let suffixClass = ''
        if (suffix) { // Only apply if suffix exists
            if (flash && now < flash.suffixUntil) {
                suffixClass = flash.dir === 'up' ? 'price-suffix-up' : 'price-suffix-down'
            } else if (persistent?.lastDigits) {
                suffixClass = persistent.dir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
            } else if (lastDir) {
                suffixClass = lastDir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
            }
        }
        
        return (
            <span className={`inline-block ${wholeClass}`}>
                <span>{prefix}</span>
                {suffix && <span className={suffixClass}>{suffix}</span>}
            </span>
        )
    })()}
</td>
```

### Option 2: Fixed Formatting (More Stable)

Standardize price formatting to prevent string length changes:

```typescript
const formatPriceNoSymbol = (price: number) => {
    // Fixed decimals based on price magnitude
    const decimals = price >= 1 ? 2 : 6;
    
    // No grouping separators to keep string stable
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: false, // No commas!
    }).format(price)
}
```

### Option 3: Persist State Across Remounts

Store the last direction in a more persistent location:

```typescript
// Add at component level
const [priceDirections, setPriceDirections] = useState<Map<string, 'up' | 'down'>>(new Map())

// Or use localStorage for true persistence
useEffect(() => {
    const stored = localStorage.getItem('volspike:priceDirections')
    if (stored) {
        const parsed = JSON.parse(stored)
        persistentRef.current = new Map(Object.entries(parsed))
    }
}, [])

// Update on price change
useEffect(() => {
    if (persistentRef.current.size > 0) {
        const obj = Object.fromEntries(persistentRef.current)
        localStorage.setItem('volspike:priceDirections', JSON.stringify(obj))
    }
}, [data]) // When data updates
```

## Environment Variables

Ensure `NEXT_PUBLIC_PRICE_FLASH` is set correctly:

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add: `NEXT_PUBLIC_PRICE_FLASH=true`
3. Ensure it's set for Production
4. Redeploy to apply changes

## Testing Checklist

After implementing the fix, test these scenarios:

- [ ] Price changes persist color after animation ends
- [ ] Color persists when price crosses 1000 (comma appears)
- [ ] Color persists when switching tabs (mobile)
- [ ] Color persists during window resize
- [ ] Multiple rapid price changes work correctly
- [ ] Different decimal precision prices work

## Quick Debug

Add this temporary debug code to verify the fix:

```typescript
// Add after suffix calculation
if (item.symbol === 'BTCUSDT' && process.env.NODE_ENV === 'development') {
    console.log('Price render debug:', {
        formatted,
        persistent: persistentRef.current.get(item.symbol),
        lastDir: lastDirRef.current.get(item.symbol),
        suffix,
        suffixClass
    })
}
```

## Recommended Approach

I recommend **Option 1** (storing last N digits) because it:
- Is resilient to all formatting changes
- Maintains the visual intent (showing what changed)
- Doesn't require changing the formatting logic
- Works across remounts with minimal changes

The key insight is that storing "color the last 2 digits" is much more stable than storing "color starting from character index 5" when the string format can change.