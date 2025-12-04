'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { listenForPasswordChange } from '@/lib/password-change-broadcast'

/**
 * Listens for password change broadcasts and signs out the user
 * This ensures all tabs/windows are logged out when password is changed
 */
export function PasswordChangeListener() {
    const { data: session } = useSession()
    const router = useRouter()

    useEffect(() => {
        // Only listen if user is logged in
        if (!session?.user) {
            return
        }

        const cleanup = listenForPasswordChange(() => {
            console.log('[PasswordChange] Password changed detected - signing out')
            
            // Sign out and redirect to auth page
            signOut({ 
                callbackUrl: '/auth',
                redirect: true 
            }).catch((error) => {
                console.error('[PasswordChange] Error signing out:', error)
                // Fallback: force redirect
                router.push('/auth')
            })
        })

        return cleanup
    }, [session, router])

    return null // This component doesn't render anything
}

