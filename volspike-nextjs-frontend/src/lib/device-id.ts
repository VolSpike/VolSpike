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
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2 // 2 years

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null

    const parts = document.cookie.split(';')
    for (const part of parts) {
        const [rawKey, ...rawValue] = part.trim().split('=')
        if (rawKey === name) {
            return decodeURIComponent(rawValue.join('=') || '')
        }
    }
    return null
}

function getCookieDomainAttr(): string | null {
    if (typeof window === 'undefined') return null
    const hostname = window.location.hostname
    // Share device id across volspike subdomains in production.
    if (hostname === 'volspike.com' || hostname.endsWith('.volspike.com')) {
        return 'Domain=.volspike.com'
    }
    // No explicit domain for localhost/dev hosts.
    return null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    const secure = window.location.protocol === 'https:'
    const cookieParts = [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        `Max-Age=${maxAgeSeconds}`,
        'SameSite=Lax',
    ]

    const domain = getCookieDomainAttr()
    if (domain) cookieParts.push(domain)
    if (secure) cookieParts.push('Secure')

    document.cookie = cookieParts.join('; ')
}

function clearCookie(name: string): void {
    if (typeof document === 'undefined') return

    // Clear for current host.
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`

    // Clear for shared production domain (if applicable).
    const domain = getCookieDomainAttr()
    if (domain) {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; ${domain}`
    }
}

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
        // Prefer cookie so the ID is shared across tabs and (optionally) subdomains.
        let deviceId = readCookie(DEVICE_ID_KEY)

        // Fall back to localStorage if cookie is missing.
        if (!deviceId) {
            deviceId = localStorage.getItem(DEVICE_ID_KEY)
        }

        if (!deviceId) {
            deviceId = crypto.randomUUID()
            try {
                localStorage.setItem(DEVICE_ID_KEY, deviceId)
            } catch {
                // Ignore storage errors; cookie may still be available.
            }
        }

        // Ensure cookie + localStorage are synced for future reads.
        try {
            if (readCookie(DEVICE_ID_KEY) !== deviceId) {
                writeCookie(DEVICE_ID_KEY, deviceId, DEVICE_ID_COOKIE_MAX_AGE_SECONDS)
            }
        } catch {
            // Ignore cookie write issues.
        }
        try {
            if (localStorage.getItem(DEVICE_ID_KEY) !== deviceId) {
                localStorage.setItem(DEVICE_ID_KEY, deviceId)
            }
        } catch {
            // Ignore storage issues.
        }

        return deviceId
    } catch (error) {
        // localStorage might be blocked (private browsing, etc.)
        // Fall back to cookie-first ID, then session-based ID.
        console.warn('Failed to access localStorage for device ID:', error)
        const existing = readCookie(DEVICE_ID_KEY)
        if (existing) return existing

        const newId = crypto.randomUUID()
        try {
            writeCookie(DEVICE_ID_KEY, newId, DEVICE_ID_COOKIE_MAX_AGE_SECONDS)
        } catch {
            // Ignore cookie errors.
        }
        return newId
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
        return readCookie(DEVICE_ID_KEY) || localStorage.getItem(DEVICE_ID_KEY)
    } catch {
        return readCookie(DEVICE_ID_KEY)
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

    try {
        clearCookie(DEVICE_ID_KEY)
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
        try {
            localStorage.setItem(DEVICE_ID_KEY, newDeviceId)
        } catch {
            // Ignore storage errors.
        }
        try {
            writeCookie(DEVICE_ID_KEY, newDeviceId, DEVICE_ID_COOKIE_MAX_AGE_SECONDS)
        } catch {
            // Ignore cookie errors.
        }
        return newDeviceId
    } catch {
        const newDeviceId = crypto.randomUUID()
        try {
            writeCookie(DEVICE_ID_KEY, newDeviceId, DEVICE_ID_COOKIE_MAX_AGE_SECONDS)
        } catch {
            // Ignore cookie errors.
        }
        return newDeviceId
    }
}
