'use client'

import { useTierChangeListener } from '@/hooks/use-tier-change-listener'

/**
 * Global component that listens for tier changes via WebSocket
 * Automatically refreshes session when tier changes
 * Should be placed inside SessionProvider
 */
export function TierChangeListener() {
    useTierChangeListener()
    return null // This component doesn't render anything
}

