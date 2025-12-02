import { useEffect, useRef } from 'react'

/**
 * Hook to periodically detect new assets from Market Data
 * Sends symbols from Market Data to backend for new asset detection
 * Runs automatically in the background without user intervention
 */
export function useAssetDetection(marketData: Array<{ symbol: string }> | undefined) {
    const lastDetectionRef = useRef<number>(0)
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isDetectingRef = useRef<boolean>(false)

    // Detection interval: Check every 5 minutes (new assets don't appear that frequently)
    const DETECTION_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

    useEffect(() => {
        console.log('[AssetDetection] Hook effect triggered', {
            hasMarketData: !!marketData,
            marketDataLength: marketData?.length || 0,
            marketDataType: typeof marketData,
        })
        
        if (!marketData || marketData.length === 0) {
            console.warn('[AssetDetection] ⚠️ No market data available, skipping detection')
            return
        }

        const detectNewAssets = async () => {
            // Prevent concurrent detection calls
            if (isDetectingRef.current) {
                return
            }

            const now = Date.now()
            // Skip if we just checked recently
            if (now - lastDetectionRef.current < DETECTION_INTERVAL_MS) {
                return
            }

            isDetectingRef.current = true
            lastDetectionRef.current = now

            try {
                // Extract unique symbols from Market Data
                const symbols = marketData.map((item) => item.symbol).filter(Boolean)

                console.log('[AssetDetection] 🔍 Checking for new assets...', {
                    marketDataLength: marketData.length,
                    symbolsCount: symbols.length,
                    sampleSymbols: symbols.slice(0, 10),
                    hasRLS: symbols.some(s => s.includes('RLS')),
                })

                if (symbols.length === 0) {
                    console.warn('[AssetDetection] ⚠️ No symbols found in market data')
                    return
                }

                // Call backend detection endpoint (public endpoint, no auth required)
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                console.log('[AssetDetection] 📡 Calling detection endpoint:', `${apiBase}/api/assets/detect-new`)
                
                const response = await fetch(`${apiBase}/api/assets/detect-new`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ symbols }),
                })

                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText)
                    console.error('[AssetDetection] ❌ Failed to detect new assets:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText,
                    })
                    return
                }

                const result = await response.json()
                console.log('[AssetDetection] 📥 Detection response:', result)

                if (result.success && result.created > 0) {
                    console.log(`[AssetDetection] ✅ Detected ${result.created} new assets:`, result.newSymbols)
                    // Note: Enrichment happens automatically in the backend
                } else if (result.success && result.created === 0) {
                    console.log('[AssetDetection] ℹ️ No new assets detected (all assets already exist)')
                }
            } catch (error) {
                // Log errors more prominently for debugging
                console.error('[AssetDetection] ❌ Error detecting new assets:', error)
            } finally {
                isDetectingRef.current = false
            }
        }

        // Initial detection after a short delay (let Market Data stabilize)
        console.log('[AssetDetection] Setting up detection timers (initial: 10s, periodic: 5min)')
        const initialTimeout = setTimeout(() => {
            console.log('[AssetDetection] ⏰ Initial detection timer fired (10s delay)')
            detectNewAssets()
        }, 10000) // Wait 10 seconds after component mount

        // Set up periodic detection
        detectionIntervalRef.current = setInterval(() => {
            console.log('[AssetDetection] ⏰ Periodic detection timer fired (5min interval)')
            detectNewAssets()
        }, DETECTION_INTERVAL_MS)

        return () => {
            clearTimeout(initialTimeout)
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current)
            }
        }
    }, [marketData])
}

