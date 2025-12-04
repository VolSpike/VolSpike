/**
 * BroadcastChannel utility for notifying other tabs/windows when password changes
 * This ensures all logged-in sessions are invalidated when password is reset/changed
 */

const CHANNEL_NAME = 'volspike-password-change'

export function broadcastPasswordChange() {
    if (typeof window === 'undefined') return // Server-side check
    
    try {
        const channel = new BroadcastChannel(CHANNEL_NAME)
        channel.postMessage({ type: 'PASSWORD_CHANGED', timestamp: Date.now() })
        channel.close()
    } catch (error) {
        console.warn('[PasswordChange] BroadcastChannel not supported:', error)
        // Fallback to localStorage event for older browsers
        if (typeof Storage !== 'undefined') {
            localStorage.setItem('volspike:password-changed', Date.now().toString())
            localStorage.removeItem('volspike:password-changed')
        }
    }
}

export function listenForPasswordChange(callback: () => void) {
    if (typeof window === 'undefined') return // Server-side check
    
    try {
        const channel = new BroadcastChannel(CHANNEL_NAME)
        channel.onmessage = (event) => {
            if (event.data?.type === 'PASSWORD_CHANGED') {
                callback()
            }
        }
        
        // Fallback to localStorage event listener
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'volspike:password-changed') {
                callback()
            }
        }
        window.addEventListener('storage', handleStorageChange)
        
        // Cleanup function
        return () => {
            channel.close()
            window.removeEventListener('storage', handleStorageChange)
        }
    } catch (error) {
        console.warn('[PasswordChange] BroadcastChannel not supported:', error)
    }
}

