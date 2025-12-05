/**
 * Device ID management for session tracking.
 *
 * Device IDs are used to identify unique browser instances for session management.
 * They are NOT used for authentication (session ID in JWT is authoritative).
 *
 * Storage: localStorage (persists across browser sessions)
 * Format: UUID v4
 */

const DEVICE_ID_KEY = 'volspike-device-id'

/**
 * Get or create a device ID.
 * Creates a new UUID if one doesn't exist in localStorage.
 * Returns null if running on server (SSR).
 */
export function getOrCreateDeviceId(): string | null {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY)

        if (!deviceId) {
            deviceId = crypto.randomUUID()
            localStorage.setItem(DEVICE_ID_KEY, deviceId)
        }

        return deviceId
    } catch (error) {
        // localStorage might be blocked (private browsing, etc.)
        // Fall back to session-based ID
        console.warn('Failed to access localStorage for device ID:', error)
        return crypto.randomUUID()
    }
}

/**
 * Get the current device ID without creating a new one.
 * Returns null if no device ID exists or running on server.
 */
export function getDeviceId(): string | null {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        return localStorage.getItem(DEVICE_ID_KEY)
    } catch {
        return null
    }
}

/**
 * Clear the device ID from localStorage.
 * Called on explicit logout to allow fresh session on next login.
 */
export function clearDeviceId(): void {
    if (typeof window === 'undefined') {
        return
    }

    try {
        localStorage.removeItem(DEVICE_ID_KEY)
    } catch {
        // Ignore errors
    }
}

/**
 * Regenerate the device ID.
 * Useful if user wants to "forget" this device.
 */
export function regenerateDeviceId(): string | null {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        const newDeviceId = crypto.randomUUID()
        localStorage.setItem(DEVICE_ID_KEY, newDeviceId)
        return newDeviceId
    } catch {
        return crypto.randomUUID()
    }
}
