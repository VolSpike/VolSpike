'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

type MeDebugState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'loaded'
      httpStatus: number
      ok: boolean
      latencyMs: number
      backendUser?: {
        id?: string
        email?: string
        tier?: string
        status?: string
      }
      rawError?: string
    }
  | { status: 'error'; message: string }

export function AuthDebugPanel() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const debugEnabled =
    searchParams?.get('debugAuth') === 'true' ||
    searchParams?.get('debug_auth') === 'true' ||
    searchParams?.get('debug') === 'true'

  const [meState, setMeState] = useState<MeDebugState>({ status: 'idle' })

  useEffect(() => {
    if (!debugEnabled || status !== 'authenticated' || !session?.user?.id) {
      setMeState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }))
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        setMeState({ status: 'loading' })
        const start = performance.now()

        // Use same-origin proxy route for consistency with SessionValidator
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            'X-Auth-Source': 'auth-debug-panel',
          },
          credentials: 'include',
          cache: 'no-store',
        })

        const latencyMs = Math.round(performance.now() - start)
        const json = await response.json().catch(() => null)
        if (cancelled) return

        const backendUser = json?.user
          ? {
              id: json.user.id,
              email: json.user.email,
              tier: json.user.tier,
              status: json.user.status,
            }
          : undefined

        setMeState({
          status: 'loaded',
          httpStatus: response.status,
          ok: response.ok,
          latencyMs,
          backendUser,
          rawError: json?.error,
        })
      } catch (error: any) {
        if (cancelled) return
        setMeState({
          status: 'error',
          message: error?.message || 'Failed to reach backend',
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [debugEnabled, status, session?.user?.id, session])

  if (!debugEnabled || status === 'loading') {
    return null
  }

  const user = session?.user

  const badge = (() => {
    if (!user) return null
    if (!meState || meState.status === 'idle') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Activity className="h-3 w-3" />
          session-only
        </span>
      )
    }
    if (meState.status === 'loaded' && meState.ok && meState.backendUser) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          backend-confirmed
        </span>
      )
    }
    if (meState.status === 'loaded' && !meState.ok) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          backend-{meState.httpStatus}
        </span>
      )
    }
    if (meState.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
          <ShieldAlert className="h-3 w-3" />
          backend-error
        </span>
      )
    }
    return null
  })()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-end px-4 sm:bottom-6 sm:px-6">
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-slate-950/90 shadow-xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Auth Debug
            </span>
          </div>
          {badge}
        </div>

        <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Session snapshot
            </p>
            {user ? (
              <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-border/60">
                <p className="truncate text-xs font-medium text-slate-50">
                  {user.email ?? 'anonymous'}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                    id: <span className="font-mono text-[10px]">{user.id}</span>
                  </span>
                  <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                    tier:{' '}
                    <span className="font-semibold text-emerald-300">{user.tier}</span>
                  </span>
                  <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                    role:{' '}
                    <span className="font-medium">{(user as any).role ?? 'USER'}</span>
                  </span>
                  {user.status && (
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                      status:{' '}
                      <span className="font-medium capitalize">{user.status}</span>
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-950/60 p-3 text-xs text-muted-foreground">
                No active session
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Backend /me
            </p>
            <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-border/60">
              {meState.status === 'idle' && (
                <p className="text-xs text-muted-foreground">
                  Waiting for first heartbeat...
                </p>
              )}
              {meState.status === 'loading' && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3 w-3 animate-spin text-emerald-300" />
                  Checking backend session...
                </p>
              )}
              {meState.status === 'loaded' && (
                <div className="space-y-1">
                  <p className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      HTTP{' '}
                      <span className="font-mono font-semibold">{meState.httpStatus}</span>{' '}
                      ·{' '}
                      <span
                        className={
                          meState.ok ? 'text-emerald-300 font-medium' : 'text-amber-300'
                        }
                      >
                        {meState.ok ? 'ok' : 'error'}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/80">
                      {meState.latencyMs} ms
                    </span>
                  </p>
                  {meState.backendUser ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {meState.backendUser.email}{' '}
                      <span className="text-xs text-slate-400">
                        ({meState.backendUser.tier} / {meState.backendUser.status})
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      No user payload returned.
                    </p>
                  )}
                  {meState.rawError && (
                    <p className="mt-1 text-[10px] text-red-300/80">
                      {meState.rawError}
                    </p>
                  )}
                </div>
              )}
              {meState.status === 'error' && (
                <p className="text-[11px] text-red-300/90">
                  {meState.message || 'Unknown error'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 px-4 py-2">
          <p className="text-[10px] text-muted-foreground/80">
            Visible only with <span className="font-mono">?debugAuth=true</span>. Use this
            panel to verify that deleted or banned users are being invalidated correctly in
            production.
          </p>
        </div>
      </div>
    </div>
  )
}
