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
        if (!marketData || marketData.length === 0) {
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

                if (symbols.length === 0) {
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
                    console.warn('[AssetDetection] Failed to detect new assets:', response.status, errorText)
                    return
                }

                const result = await response.json()

                if (result.success && result.created > 0) {
                    console.log(`[AssetDetection] ✅ Detected ${result.created} new assets:`, result.newSymbols)
                    // Note: Enrichment happens automatically in the backend
                }
            } catch (error) {
                // Silently fail - this is a background process, don't disrupt user experience
                console.debug('[AssetDetection] Error detecting new assets:', error)
            } finally {
                isDetectingRef.current = false
            }
        }

        // Initial detection after a short delay (let Market Data stabilize)
        const initialTimeout = setTimeout(() => {
            detectNewAssets()
        }, 10000) // Wait 10 seconds after component mount

        // Set up periodic detection
        detectionIntervalRef.current = setInterval(() => {
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

