'use client'

import { useUserDeletionListener } from '@/hooks/use-user-deletion-listener'
import { AccountDeletedModal } from './account-deleted-modal'

/**
 * Component that listens for user deletion events via WebSocket
 * and displays a beautiful modal before logging out
 */
export function UserDeletionHandler() {
  const { deletionEvent, clearDeletionEvent } = useUserDeletionListener()

  if (!deletionEvent) {
    return null
  }

  return (
    <AccountDeletedModal 
      event={deletionEvent} 
      onClose={clearDeletionEvent}
    />
  )
}

