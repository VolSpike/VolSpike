// Replace the price cell (<td>) rendering in market-table.tsx with this:

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
                // This is the KEY CHANGE - storing digit count instead of index
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
            // FIXED: Use lastDigits for stable persistence
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
        if (suffix) { // FIXED: Only apply class if suffix exists
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