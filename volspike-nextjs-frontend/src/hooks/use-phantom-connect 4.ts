"use client"

import { useEffect, useRef, useState } from 'react'
import { isThirdPartyIOSBrowser, isIOS } from '@/lib/phantom-deeplink'

type StartRes = { ok?: boolean; state?: string; connectUrl?: string; connectDeepLink?: string; error?: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend'

export function usePhantomConnect() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connectUrlRef = useRef<string | null>(null)
  const connectDeepLinkRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`${API_URL}/api/auth/phantom/dl/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        const j = (await r.json()) as StartRes
        if (!r.ok || (!j.ok && j.ok !== undefined)) throw new Error(j.error || 'Failed to start Phantom connect')
        if (cancelled) return
        connectUrlRef.current = j.connectUrl || null
        connectDeepLinkRef.current = j.connectDeepLink || (j.connectUrl ? j.connectUrl.replace('https://phantom.app/ul/', 'phantom://ul/') : null)
        setReady(true)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Connect prefetch failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const clickToConnect = () => {
    const universal = connectUrlRef.current
    const deep = connectDeepLinkRef.current || (universal ? universal.replace('https://phantom.app/ul/', 'phantom://ul/') : null)
    // For CONNECT: always prefer the universal link on iOS (Safari and third‑party)
    const target = isIOS() ? (universal ?? deep) : (universal ?? deep)
    if (!target) return
    try {
      window.location.assign(target)
    } catch {
      window.location.href = target
    }
  }

  return { ready, error, clickToConnect }
}
