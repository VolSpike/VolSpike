'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useSocket } from './use-socket'

export interface UserDeletionEvent {
  userId: string | number
  reason: 'deleted' | 'banned' | 'suspended'
  timestamp: string
  message: string
}

export function useUserDeletionListener() {
  const { socket } = useSocket()
  const { data: session } = useSession()
  const [deletionEvent, setDeletionEvent] = useState<UserDeletionEvent | null>(null)

  useEffect(() => {
    if (!socket || !session?.user?.id) {
      return
    }

    const currentUserId = String((session.user as any).id)
    console.log('[UserDeletionListener] Setting up deletion listener for user', currentUserId)

    const handleUserDeletion = async (event: UserDeletionEvent) => {
      console.error('[UserDeletionListener] ⚠️ User deletion event received:', event)
      const eventUserId = String(event.userId)
      
      // Verify this event is for the current user
      if (eventUserId !== currentUserId) {
        console.warn('[UserDeletionListener] Deletion event for different user, ignoring', {
          eventUserId,
          currentUserId,
        })
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
  }, [socket, session?.user?.id])

  return { deletionEvent, clearDeletionEvent: () => setDeletionEvent(null) }
}
