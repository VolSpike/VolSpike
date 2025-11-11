/**
 * Avatar utility functions for consistent avatar generation
 * across different authentication methods (Google OAuth, email/password, wallet)
 */

/**
 * Generate deterministic initials from email ONLY
 * STRICT: Always use email for consistency - ignore displayName completely
 * Returns 'U' if no valid email is provided
 * 
 * IMPORTANT: This ensures consistent initials across all auth methods
 */
export function generateInitials(email: string | null, displayName: string | null): string {
    // STRICT: Only use email - ignore displayName to prevent inconsistencies
    if (email) {
        const normalizedEmail = email.toLowerCase().trim()
        const parts = normalizedEmail.split('@')
        if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
            // Use first char of username + first char of domain
            // e.g., "colin.paran@gmail.com" -> "CG"
            const username = parts[0]
            const domain = parts[1]
            const initials = (username[0] + domain[0]).toUpperCase()
            
            // Debug logging in development
            if (process.env.NODE_ENV === 'development') {
                console.log('[Avatar] Generated initials from email:', { email: normalizedEmail, initials })
            }
            
            return initials
        } else {
            // Invalid email format - use first 2 chars as fallback
            const initials = normalizedEmail.slice(0, 2).toUpperCase()
            if (process.env.NODE_ENV === 'development') {
                console.log('[Avatar] Generated initials from email (fallback):', { email: normalizedEmail, initials })
            }
            return initials
        }
    }
    
    // STRICT: Return 'U' if no email - do NOT use displayName
    // This prevents inconsistencies when email is temporarily unavailable
    if (process.env.NODE_ENV === 'development') {
        console.warn('[Avatar] No email provided for initials generation, returning "U"', { email, displayName })
    }
    return 'U'
}

/**
 * Generate a deterministic color based on user identifier (email or user ID)
 * This ensures the same user always gets the same color, regardless of auth method
 */
export function getAvatarColor(identifier: string | null): {
    bg: string
    gradientFrom: string
    gradientVia: string
    gradientTo: string
    gradientFromBright: string
    gradientViaBright: string
    gradientToBright: string
} {
    if (!identifier) {
        // Default fallback color
        return {
            bg: 'bg-brand-500',
            gradientFrom: 'from-brand-400/30',
            gradientVia: 'via-brand-500/40',
            gradientTo: 'to-brand-600/30',
            gradientFromBright: 'from-brand-400/40',
            gradientViaBright: 'via-brand-500/50',
            gradientToBright: 'to-brand-600/40',
        }
    }
    
    // Generate a hash from the identifier
    let hash = 0
    for (let i = 0; i < identifier.length; i++) {
        hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash // Convert to 32-bit integer
    }
    
    // Use hash to select from a curated palette of colors
    // These colors are chosen to be visually distinct and accessible
    const colors = [
        // Green variations (brand)
        { bg: 'bg-brand-500', gradientFrom: 'from-brand-400/30', gradientVia: 'via-brand-500/40', gradientTo: 'to-brand-600/30', gradientFromBright: 'from-brand-400/40', gradientViaBright: 'via-brand-500/50', gradientToBright: 'to-brand-600/40' },
        // Blue variations
        { bg: 'bg-blue-500', gradientFrom: 'from-blue-400/30', gradientVia: 'via-blue-500/40', gradientTo: 'to-blue-600/30', gradientFromBright: 'from-blue-400/40', gradientViaBright: 'via-blue-500/50', gradientToBright: 'to-blue-600/40' },
        // Purple variations
        { bg: 'bg-purple-500', gradientFrom: 'from-purple-400/30', gradientVia: 'via-purple-500/40', gradientTo: 'to-purple-600/30', gradientFromBright: 'from-purple-400/40', gradientViaBright: 'via-purple-500/50', gradientToBright: 'to-purple-600/40' },
        // Orange variations
        { bg: 'bg-orange-500', gradientFrom: 'from-orange-400/30', gradientVia: 'via-orange-500/40', gradientTo: 'to-orange-600/30', gradientFromBright: 'from-orange-400/40', gradientViaBright: 'via-orange-500/50', gradientToBright: 'to-orange-600/40' },
        // Pink variations
        { bg: 'bg-pink-500', gradientFrom: 'from-pink-400/30', gradientVia: 'via-pink-500/40', gradientTo: 'to-pink-600/30', gradientFromBright: 'from-pink-400/40', gradientViaBright: 'via-pink-500/50', gradientToBright: 'to-pink-600/40' },
        // Teal variations
        { bg: 'bg-teal-500', gradientFrom: 'from-teal-400/30', gradientVia: 'via-teal-500/40', gradientTo: 'to-teal-600/30', gradientFromBright: 'from-teal-400/40', gradientViaBright: 'via-teal-500/50', gradientToBright: 'to-teal-600/40' },
        // Indigo variations
        { bg: 'bg-indigo-500', gradientFrom: 'from-indigo-400/30', gradientVia: 'via-indigo-500/40', gradientTo: 'to-indigo-600/30', gradientFromBright: 'from-indigo-400/40', gradientViaBright: 'via-indigo-500/50', gradientToBright: 'to-indigo-600/40' },
        // Red variations
        { bg: 'bg-red-500', gradientFrom: 'from-red-400/30', gradientVia: 'via-red-500/40', gradientTo: 'to-red-600/30', gradientFromBright: 'from-red-400/40', gradientViaBright: 'via-red-500/50', gradientToBright: 'to-red-600/40' },
    ]
    
    const index = Math.abs(hash) % colors.length
    return colors[index]
}

