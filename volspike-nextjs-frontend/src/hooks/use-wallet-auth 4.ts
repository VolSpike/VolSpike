'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { signIn, useSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface UseWalletAuthResult {
  isConnecting: boolean
  isSigning: boolean
  isAuthenticating: boolean
  error: string | null
  signInWithWallet: () => Promise<void>
}

export function useWalletAuth(): UseWalletAuthResult {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { data: session } = useSession()
  const router = useRouter()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithWallet = async () => {
    try {
      setError(null)

      // Step 1: Check wallet connected
      if (!isConnected || !address || !chainId) {
        throw new Error('Please connect your wallet first')
      }

      console.log('[useWalletAuth] Starting sign-in, address:', address, 'chainId:', chainId)

      setIsConnecting(true)

      // Step 2: Get nonce from backend
      const nonceRes = await fetch(`${API_URL}/api/auth/siwe/nonce`, { credentials: 'include' })
      
      if (!nonceRes.ok) {
        const errorText = await nonceRes.text()
        console.error('[useWalletAuth] Nonce request failed:', errorText)
        throw new Error('Failed to get authentication nonce')
      }
      
      const { nonce } = await nonceRes.json()
      console.log('[useWalletAuth] Got nonce:', nonce)

      setIsConnecting(false)
      setIsSigning(true)

      // Step 3: Get server-prepared SIWE message (best practice - avoids client-side constructor issues)
      console.log('[useWalletAuth] Requesting server-prepared SIWE message...')
      
      const prepRes = await fetch(`${API_URL}/api/auth/siwe/prepare?address=${address}&chainId=${chainId}&nonce=${nonce}`, { credentials: 'include' })
      
      if (!prepRes.ok) {
        const errorData = await prepRes.json()
        throw new Error(errorData.error || 'Failed to prepare SIWE message')
      }
      
      const { message: messageToSign } = await prepRes.json()
      console.log('[useWalletAuth] Got server-prepared SIWE message')

      // Step 4: Sign message with wallet
      console.log('[useWalletAuth] Requesting signature from wallet...')
      const signature = await signMessageAsync({
        message: messageToSign,
      })
      console.log('[useWalletAuth] Got signature:', signature)

      setIsSigning(false)
      setIsAuthenticating(true)

      // Step 5: Verify signature and get token
      // If user is logged in, send Authorization header to link wallet to existing account
      const headers: HeadersInit = { 
        'Content-Type': 'application/json',
      }
      
      // If user has an active session, include Authorization header to link wallet
      if (session?.user?.id) {
        headers['Authorization'] = `Bearer ${session.user.id}`
        console.log('[useWalletAuth] User logged in, will link wallet to existing account')
      }
      
      const verifyRes = await fetch(`${API_URL}/api/auth/siwe/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: messageToSign, signature }),
        credentials: 'include',
      })

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json()
        throw new Error(errorData.error || 'Authentication failed')
      }

      const { ok, token, user } = await verifyRes.json()
      console.log('[useWalletAuth] Verify response:', { ok: !!ok, hasToken: !!token, user })
      if (!ok || !token) {
        throw new Error('SIWE verify missing token')
      }

      // Step 6: Create NextAuth session
      const signInResult = await signIn('siwe', {
        redirect: false,
        token,
        walletAddress: user.walletAddress,
      })
      console.log('[useWalletAuth] signIn result:', signInResult)

      // Check session immediately
      try {
        // Wait a tick to allow cookie write
        await new Promise(r => setTimeout(r, 200))
        console.log('[useWalletAuth] document.cookie snapshot:', typeof document !== 'undefined' ? document.cookie : 'no-doc')
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        const sessionJson = await sessionRes.json().catch(() => null)
        console.log('[useWalletAuth] Session after signIn:', sessionJson)
      } catch (e) {
        console.warn('[useWalletAuth] Could not fetch session:', e)
      }

      // Step 7: Redirect to dashboard
      if ((signInResult as any)?.ok) {
        router.push('/dashboard')
      } else {
        throw new Error((signInResult as any)?.error || 'NextAuth signIn failed')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to authenticate with wallet'
      setError(errorMessage)
      console.error('[useWalletAuth] Error:', err)
    } finally {
      setIsConnecting(false)
      setIsSigning(false)
      setIsAuthenticating(false)
    }
  }

  return {
    isConnecting,
    isSigning,
    isAuthenticating,
    error,
    signInWithWallet,
  }
}
