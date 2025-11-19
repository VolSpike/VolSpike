'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSocket } from './use-socket'

export interface UserDeletionEvent {
  userId: string
  reason: 'deleted' | 'banned' | 'suspended'
  timestamp: string
  message: string
}

export function useUserDeletionListener() {
  const { socket, isConnected } = useSocket()
  const { data: session } = useSession()
  const router = useRouter()
  const [deletionEvent, setDeletionEvent] = useState<UserDeletionEvent | null>(null)

  useEffect(() => {
    if (!socket || !isConnected || !session?.user?.id) {
      return
    }

    console.log('[UserDeletionListener] Setting up deletion listener for user', session.user.id)

    const handleUserDeletion = async (event: UserDeletionEvent) => {
      console.error('[UserDeletionListener] ⚠️ User deletion event received:', event)
      
      // Verify this event is for the current user
      if (event.userId !== session.user.id) {
        console.warn('[UserDeletionListener] Deletion event for different user, ignoring')
        return
      }

      // Set deletion event to trigger modal display
      setDeletionEvent(event)

      // Force immediate logout after a brief delay to show the modal
      setTimeout(async () => {
        console.error('[UserDeletionListener] Forcing logout due to account deletion')
        await signOut({ 
          redirect: true, 
          callbackUrl: '/auth?reason=' + encodeURIComponent(event.reason)
        })
      }, 2000) // 2 second delay to show modal
    }

    socket.on('user-deleted', handleUserDeletion)

    return () => {
      socket.off('user-deleted', handleUserDeletion)
    }
  }, [socket, isConnected, session?.user?.id, router])

  return { deletionEvent, clearDeletionEvent: () => setDeletionEvent(null) }
}

