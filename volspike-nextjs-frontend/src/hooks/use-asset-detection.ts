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
            return
        }

        // Mark as initialized BEFORE setting up timers (prevents re-initialization)
        initializedRef.current = true

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

            // Get current market data from ref (always up-to-date)
            const currentMarketData = marketDataRef.current
            if (!currentMarketData || currentMarketData.length === 0) {
                return
            }

            isDetectingRef.current = true
            lastDetectionRef.current = now

            try {
                // Extract unique symbols from Market Data
                const symbols = currentMarketData.map((item) => item.symbol).filter(Boolean)

                if (symbols.length === 0) {
                    isDetectingRef.current = false
                    return
                }

                // Call backend detection endpoint (public endpoint, no auth required)
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                
                const response = await fetch(`${apiBase}/api/assets/detect-new`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ symbols }),
                })

                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText)
                    console.error('[AssetDetection] Failed to detect new assets:', response.status, errorText)
                    isDetectingRef.current = false
                    return
                }

                const result = await response.json()

                if (result.success && result.created > 0) {
                    // CRITICAL: Invalidate manifest cache so new assets appear immediately
                    // This ensures incomplete assets show up instantly in the slide-out card
                    try {
                        const { invalidateManifestCache } = await import('@/lib/asset-manifest')
                        invalidateManifestCache()
                    } catch (error) {
                        console.warn('[AssetDetection] Failed to invalidate manifest cache:', error)
                    }
                }
            } catch (error) {
                console.error('[AssetDetection] Error detecting new assets:', error)
            } finally {
                isDetectingRef.current = false
            }
        }

        // Initial detection after a short delay (let Market Data stabilize)
        const timeoutId = setTimeout(() => {
            detectNewAssets()
        }, 10000) // Wait 10 seconds after component mount
        initialTimeoutRef.current = timeoutId

        // Set up periodic detection
        const intervalId = setInterval(() => {
            detectNewAssets()
        }, DETECTION_INTERVAL_MS)
        detectionIntervalRef.current = intervalId

        return () => {
            // Only cleanup timers if we're actually re-initializing (shouldn't happen due to initializedRef check)
            // But if cleanup runs, don't clear timers if we're already initialized - they should keep running
            if (initializedRef.current) {
                // Already initialized, don't cleanup - timers should keep running
                return
            }
            
            // Only cleanup if we're not initialized (shouldn't happen, but safety check)
            if (initialTimeoutRef.current) {
                clearTimeout(initialTimeoutRef.current)
                initialTimeoutRef.current = null
            }
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current)
                detectionIntervalRef.current = null
            }
        }
    }, [marketData]) // Re-run when marketData becomes available (but initializedRef prevents multiple setups)
}

