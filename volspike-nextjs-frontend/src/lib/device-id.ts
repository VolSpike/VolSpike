/**
 * Device ID management for session tracking.
 *
 * Goal: allow multiple tabs/windows on the same physical device, while still
 * enforcing a "single device at a time" policy server-side.
 *
 * Important nuance:
 * - localStorage/cookies are per-browser-profile. If a user opens a second
 *   profile/incognito window, storage isn't shared and a random UUID would look
 *   like a "new device".
 * - To make "device" mean "this machine" (best-effort), we derive a stable,
 *   non-secret fingerprint ID from coarse hardware/OS signals and persist it.
 *
 * This is not a strong anti-fraud mechanism on its own (clients can spoof it),
 * but it significantly improves UX for legitimate multi-window usage.
 */

const DEVICE_ID_KEY = 'volspike-device-id'
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2 // 2 years

function detectOsFamily(userAgent: string): string {
    const ua = userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
    if (/Android/i.test(ua)) return 'android'
    if (/Macintosh|Mac OS X/i.test(ua)) return 'mac'
    if (/Windows/i.test(ua)) return 'windows'
    if (/Linux/i.test(ua)) return 'linux'
    return 'unknown'
}

function fnv1a32Hex(input: string, seed: number): string {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(input)
    let hash = (0x811c9dc5 ^ seed) >>> 0
    for (let i = 0; i < bytes.length; i += 1) {
        hash ^= bytes[i]
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
}

function computeFingerprintDeviceId(): string | null {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof screen === 'undefined') {
        return null
    }

    try {
        const ua = navigator.userAgent || ''
        const os = detectOsFamily(ua)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        const hw = String((navigator as any).hardwareConcurrency || 0)
        const mem = String((navigator as any).deviceMemory || 0)
        const touch = String((navigator as any).maxTouchPoints || 0)
        // Normalize orientation to reduce churn.
        const w = Math.max(screen.width || 0, screen.height || 0)
        const h = Math.min(screen.width || 0, screen.height || 0)
        const dpr = String(window.devicePixelRatio || 1)

        // Intentionally avoid full userAgent to keep this stable across browsers on the same device.
        const fingerprint = [os, tz, hw, mem, touch, `${w}x${h}`, dpr].join('|')
        // Compose a 128-bit-ish id from 4 independent 32-bit hashes.
        const h1 = fnv1a32Hex(fingerprint, 0)
        const h2 = fnv1a32Hex(fingerprint, 1)
        const h3 = fnv1a32Hex(`v2|${fingerprint}`, 2)
        const h4 = fnv1a32Hex(`v2|${fingerprint}`, 3)
        return `fp_${h1}${h2}${h3}${h4}` // 3 + 32 hex chars
    } catch {
        return null
    }
}

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
        // Best-effort: stable device id across tabs/windows and across browser profiles.
        // Use fingerprint as the canonical ID, but keep cookie/localStorage for quick reads.
        const fingerprintId = computeFingerprintDeviceId()
        let deviceId = fingerprintId || readCookie(DEVICE_ID_KEY) || localStorage.getItem(DEVICE_ID_KEY)

        // Legacy/edge case: if we only have a random UUID from older versions,
        // migrate to the fingerprint ID when available so "same machine" stays consistent.
        if (fingerprintId && deviceId !== fingerprintId) {
            deviceId = fingerprintId
        }

        if (!deviceId) {
            deviceId = crypto.randomUUID()
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
        const existing = computeFingerprintDeviceId() || readCookie(DEVICE_ID_KEY)
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
        return computeFingerprintDeviceId() || readCookie(DEVICE_ID_KEY) || localStorage.getItem(DEVICE_ID_KEY)
    } catch {
        return computeFingerprintDeviceId() || readCookie(DEVICE_ID_KEY)
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
