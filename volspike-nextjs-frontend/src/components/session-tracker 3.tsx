'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { trackRegistration, trackLogin, setUserProperties } from '@/lib/analytics'

/**
 * Session Tracker Component
 * 
 * Tracks authentication events (OAuth, Wallet) that happen server-side
 * by watching for session changes and detecting new logins/registrations.
 */
export function SessionTracker() {
  const { data: session, status } = useSession()
  const previousSessionRef = useRef<string | null>(null)
  const trackedSessionsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Wait for session to be loaded
    if (status !== 'authenticated' || !session?.user) {
      return
    }

    const userId = session.user.id || session.user.email || 'unknown'
    const sessionKey = `${userId}-${session.user.email || 'no-email'}`

    // Skip if we've already tracked this session
    if (trackedSessionsRef.current.has(sessionKey)) {
      return
    }

    // Detect if this is a new session (user just logged in)
    const isNewSession = previousSessionRef.current === null || 
                         previousSessionRef.current !== sessionKey

    if (isNewSession) {
      // Determine auth method from session
      const authMethod = (session as any).authMethod || 
                        (session.user.email ? 'email' : 'wallet') ||
                        'unknown'

      // Check if this is likely a new registration vs existing user login
      // We'll track as login by default, but you can enhance this logic
      // by checking user creation date or other indicators
      
      // For OAuth (Google), track as login (registration is tracked server-side)
      if (authMethod === 'google' || authMethod === 'oauth') {
        trackLogin('oauth')
      } 
      // For wallet auth
      else if (authMethod === 'evm' || authMethod === 'wallet' || session.user.walletAddress) {
        trackLogin('wallet')
      }
      // For email/password
      else if (authMethod === 'password' || authMethod === 'email') {
        // Already tracked in signin-form.tsx, but track here as backup
        trackLogin('email')
      }

      // Set user properties for analytics
      if (userId && userId !== 'unknown') {
        setUserProperties(userId, {
          tier: session.user.tier || 'free',
          email: session.user.email || undefined,
        })
      }

      // Mark this session as tracked
      trackedSessionsRef.current.add(sessionKey)
      previousSessionRef.current = sessionKey
    }
  }, [session, status])

  return null
}

