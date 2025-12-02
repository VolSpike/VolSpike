import { useEffect, useRef } from 'react'

/**
 * Hook to periodically detect new assets from Market Data
 * Sends symbols from Market Data to backend for new asset detection
 * Runs automatically in the background without user intervention
 */
export function useAssetDetection(marketData: Array<{ symbol: string }> | undefined) {
    const lastDetectionRef = useRef<number>(0)
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const initialTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isDetectingRef = useRef<boolean>(false)
    const initializedRef = useRef<boolean>(false)
    const marketDataRef = useRef<Array<{ symbol: string }> | undefined>(marketData)

    // Detection interval: Check every 5 minutes (new assets don't appear that frequently)
    const DETECTION_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

    // Update ref when marketData changes (without triggering effect)
    useEffect(() => {
        marketDataRef.current = marketData
    }, [marketData])

    // Initialize detection once when market data becomes available
    useEffect(() => {
        // Only initialize once (check before checking market data)
        if (initializedRef.current) {
            return
        }

        // Wait for market data to be available
        if (!marketData || marketData.length === 0) {
            return // Don't log here - market data might not be ready yet
        }

        console.log('[AssetDetection] ✅ Initializing detection (one-time setup)', {
            marketDataLength: marketData.length,
        })

        // Mark as initialized BEFORE setting up timers (prevents re-initialization)
        initializedRef.current = true

        const detectNewAssets = async () => {
            // Prevent concurrent detection calls
            if (isDetectingRef.current) {
                console.log('[AssetDetection] ⏭️ Detection already in progress, skipping')
                return
            }

            const now = Date.now()
            // Skip if we just checked recently
            if (now - lastDetectionRef.current < DETECTION_INTERVAL_MS) {
                const timeSinceLastCheck = Math.round((now - lastDetectionRef.current) / 1000)
                console.log(`[AssetDetection] ⏭️ Skipping (checked ${timeSinceLastCheck}s ago, need ${DETECTION_INTERVAL_MS / 1000}s)`)
                return
            }

            // Get current market data from ref (always up-to-date)
            const currentMarketData = marketDataRef.current
            if (!currentMarketData || currentMarketData.length === 0) {
                console.warn('[AssetDetection] ⚠️ No market data available for detection')
                return
            }

            isDetectingRef.current = true
            lastDetectionRef.current = now

            try {
                // Extract unique symbols from Market Data
                const symbols = currentMarketData.map((item) => item.symbol).filter(Boolean)

                console.log('[AssetDetection] 🔍 Checking for new assets...', {
                    marketDataLength: currentMarketData.length,
                    symbolsCount: symbols.length,
                    sampleSymbols: symbols.slice(0, 10),
                    hasRLS: symbols.some(s => s.includes('RLS')),
                })

                if (symbols.length === 0) {
                    console.warn('[AssetDetection] ⚠️ No symbols found in market data')
                    isDetectingRef.current = false
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
                    isDetectingRef.current = false
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
        console.log('[AssetDetection] ⏰ Setting up initial detection timer (10s delay)')
        const timeoutId = setTimeout(() => {
            console.log('[AssetDetection] ⏰ Initial detection timer fired - calling detectNewAssets')
            try {
                detectNewAssets()
            } catch (error) {
                console.error('[AssetDetection] ❌ Error in initial detection timer:', error)
            }
        }, 10000) // Wait 10 seconds after component mount
        initialTimeoutRef.current = timeoutId
        console.log('[AssetDetection] ✅ Initial timer set with ID:', timeoutId)

        // Set up periodic detection
        console.log('[AssetDetection] ⏰ Setting up periodic detection timer (5min interval)')
        const intervalId = setInterval(() => {
            console.log('[AssetDetection] ⏰ Periodic detection timer fired - calling detectNewAssets')
            try {
                detectNewAssets()
            } catch (error) {
                console.error('[AssetDetection] ❌ Error in periodic detection timer:', error)
            }
        }, DETECTION_INTERVAL_MS)
        detectionIntervalRef.current = intervalId
        console.log('[AssetDetection] ✅ Periodic timer set with ID:', intervalId)

        return () => {
            // Only cleanup timers, don't reset initializedRef
            // This prevents re-initialization when marketData reference changes
            console.log('[AssetDetection] 🧹 Cleanup function called', {
                hasInitialTimeout: !!initialTimeoutRef.current,
                hasInterval: !!detectionIntervalRef.current,
            })
            if (initialTimeoutRef.current) {
                console.log('[AssetDetection] 🧹 Clearing initial timeout:', initialTimeoutRef.current)
                clearTimeout(initialTimeoutRef.current)
                initialTimeoutRef.current = null
            }
            if (detectionIntervalRef.current) {
                console.log('[AssetDetection] 🧹 Clearing periodic interval:', detectionIntervalRef.current)
                clearInterval(detectionIntervalRef.current)
                detectionIntervalRef.current = null
            }
            // DON'T reset initializedRef here - we want to initialize only once
        }
    }, [marketData]) // Re-run when marketData becomes available (but initializedRef prevents multiple setups)
}

