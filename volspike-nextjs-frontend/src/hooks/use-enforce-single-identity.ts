'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAccount, useDisconnect } from 'wagmi'

/**
 * Ensures only one active identity at a time.
 * - If session.authMethod !== 'evm', disconnect wagmi EVM wallet.
 * - If session.authMethod !== 'solana', attempt to disconnect Phantom/Solana.
 */
export function useEnforceSingleIdentity() {
  const { data: session, status } = useSession()
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (status !== 'authenticated') return
    const method = (session as any)?.authMethod || null

    // Disconnect EVM wallet unless the session itself was created via EVM
    if (method !== 'evm' && isConnected) {
      try { disconnect() } catch (_) {}
    }

    // Best-effort Solana disconnect
    if (method !== 'solana') {
      try {
        const anyWindow: any = typeof window !== 'undefined' ? window : null
        anyWindow?.solana?.isConnected && anyWindow?.solana?.disconnect?.()
      } catch (_) {}
    }
  }, [status, session, isConnected, disconnect])
}

