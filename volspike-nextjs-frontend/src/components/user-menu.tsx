'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useUserIdentity } from '@/hooks/use-user-identity'
import { generateInitials, getAvatarColor, isLikelyGoogleLetterTile } from '@/lib/avatar-utils'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Settings,
    LogOut,
    Copy,
    CreditCard,
    Wallet,
    Bell,
    Star,
    Zap,
    Sparkles,
    Shield,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

export function UserMenu() {
    const router = useRouter()
    const { data: session } = useSession()
    const identity = useUserIdentity()
    const [isOpen, setIsOpen] = useState(false)
    const [imageError, setImageError] = useState(false)
    const [debugAvatar, setDebugAvatar] = useState(false)
    const [avatarMode, setAvatarMode] = useState<'auto' | 'image' | 'initials'>('auto')
    const { disconnect } = useDisconnect()

    // Reset image error when image changes
    useEffect(() => {
        setImageError(false)
    }, [identity.image])

    // Enable debug logs when ?debug=true or localStorage.debugAvatar === '1'
    useEffect(() => {
        try {
            const hasQuery = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true'
            const ls = typeof window !== 'undefined' ? window.localStorage?.getItem('debugAvatar') === '1' : false
            setDebugAvatar(Boolean(hasQuery || ls))
        } catch (e) {
            // ignore
        }
    }, [])

    // Read avatar mode preference: 'auto' (default), 'image', or 'initials'
    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                const lsMode = (window.localStorage?.getItem('vs_avatar_mode') || 'auto') as any
                if (lsMode === 'image' || lsMode === 'initials' || lsMode === 'auto') {
                    setAvatarMode(lsMode)
                }
            }
        } catch (_) { }
    }, [])

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success(`${label} copied`)
        } catch (err) {
            toast.error('Failed to copy')
        }
    }

    // Generate consistent initials and colors based on user identifier
    // CRITICAL: Always use email (normalized) as primary identifier for consistency
    // Normalize email to lowercase to ensure same hash regardless of case
    // Fallback to session email if identity.email is not available (race condition protection)
    const emailFromIdentity = identity.email
    const emailFromSession = session?.user?.email
    const normalizedEmail = (emailFromIdentity || emailFromSession)?.toLowerCase().trim() || null
    const userIdentifier = normalizedEmail || (session?.user as any)?.walletAddress || session?.user?.id || null

    // Always use email for initials - ignore displayName to ensure consistency
    // If email is not available, fallback to a safe default
    const initials = normalizedEmail
        ? generateInitials(normalizedEmail, null)
        : generateInitials(null, null, identity.address)

    // Use normalized email for color generation to ensure consistency
    // If no email, use user ID as fallback
    const avatarColors = getAvatarColor(normalizedEmail || userIdentifier)

    // Decide whether to show the OAuth image or our initials
    const isGoogleTile = isLikelyGoogleLetterTile(identity.image || undefined)
    // Allow overriding tile filtering; default to NOT filtering to avoid false negatives
    const envFilterTiles = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AVATAR_FILTER_GOOGLE_TILES === 'true'
    let hideTiles = false
    try {
        if (typeof window !== 'undefined') {
            hideTiles = window.localStorage?.getItem('vs_avatar_hide_tiles') === '1'
        }
    } catch (_) { }
    const shouldFilterTiles = envFilterTiles || hideTiles
    // Show image whenever available, unless explicitly filtered and detected as a tile
    const showAvatarImage = Boolean(
        identity.image &&
        !imageError &&
        (avatarMode === 'image' || avatarMode === 'auto') &&
        (!shouldFilterTiles || !isGoogleTile)
    )

    // Debug: trace avatar inputs/outputs (development only)
    if (debugAvatar || process.env.NODE_ENV === 'development') {
        // Keep this concise but informative
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Avatar render:', {
            identityEmail: identity.email,
            sessionEmail: session?.user?.email,
            normalizedEmail,
            initials,
            avatarBg: avatarColors.bg,
            imageUrl: identity.image,
            imageError,
            avatarMode,
            isGoogleTile,
            showAvatarImage,
        })
    }

    if (identity.isLoading) {
        return (
            <Button variant="outline" size="sm" disabled className="h-9 w-9 rounded-full p-0">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </Button>
        )
    }

    const tier = identity.tier || 'free'
    const itemClass =
        'group relative mx-1 my-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 bg-white/85 text-slate-900 hover:bg-white dark:bg-white/5 dark:text-white hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/8 shadow-[0_10px_30px_rgba(15,23,42,0.18)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.28)] focus:bg-white dark:focus:bg-white/10 focus:outline-none'
    const iconClass =
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 group-hover:bg-slate-50 group-hover:text-slate-800 transition-all duration-150 dark:bg-white/5 dark:text-muted-foreground/90 dark:ring-white/5 dark:group-hover:bg-white/10 dark:group-hover:text-white'

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 rounded-full p-0 flex items-center justify-center hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all duration-150"
                    aria-label="User menu"
                >
                    <div
                        className={`h-9 w-9 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFrom} ${avatarColors.gradientVia} ${avatarColors.gradientTo} animate-pulse-glow`}
                        data-vs-avatar=""
                        data-normalized-email={normalizedEmail || ''}
                        data-initials={initials}
                        data-avatar-bg={avatarColors.bg}
                        data-image-url={identity.image || ''}
                        data-avatar-mode={avatarMode}
                        data-is-google-tile={String(isGoogleTile)}
                        data-show-image={String(showAvatarImage)}
                        title={normalizedEmail ? `Avatar: ${initials} (${normalizedEmail})` : `Avatar: ${initials}`}
                    >
                        <div className={`h-full w-full rounded-full overflow-hidden flex items-center justify-center ${avatarColors.bg} text-white shadow-brand`}>
                            {showAvatarImage ? (
                                <div className="relative h-full w-full">
                                    <Image
                                        src={identity.image as string}
                                        alt={identity.displayName}
                                        fill
                                        sizes="36px"
                                        className="object-cover"
                                        referrerPolicy="no-referrer"
                                        priority
                                        onError={() => setImageError(true)}
                                    />
                                </div>
                            ) : (
                                <span className="text-[11px] font-bold leading-none select-none font-mono">
                                    {initials}
                                </span>
                            )}
                        </div>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={12}
                alignOffset={-4}
                collisionPadding={16}
                className="relative w-[320px] max-h-[min(80vh,560px)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.25)] ring-1 ring-white/40 backdrop-blur-xl animate-scale-in dark:border-white/8 dark:bg-[#0c121f]/95 dark:text-white dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:ring-white/8"
            >
                <div className="relative">
                    <div className="pointer-events-none absolute inset-x-0 -top-10 h-28 bg-gradient-to-b from-brand-500/20 via-brand-500/5 to-transparent blur-2xl opacity-70" />
                    {/* User Info Section with refreshed styling */}
                    <DropdownMenuLabel className="relative p-4 pb-3 border-b border-slate-200/70 bg-white/90 text-slate-900 backdrop-blur-xl dark:border-white/5 dark:bg-[#0f172a]/70 dark:text-white">
                        <div className="flex flex-col space-y-3">
                            <div className="flex items-center gap-3">
                                <div className={`h-11 w-11 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFromBright} ${avatarColors.gradientViaBright} ${avatarColors.gradientToBright} shadow-[0_0_0_4px_rgba(19,255,141,0.15)]`}>
                                    <div className={`h-full w-full rounded-full overflow-hidden flex items-center justify-center ${avatarColors.bg} text-white`}>
                                        {showAvatarImage ? (
                                            <div className="relative h-full w-full">
                                                <Image
                                                    src={identity.image as string}
                                                    alt={identity.displayName}
                                                    fill
                                                    sizes="44px"
                                                    className="object-cover"
                                                    referrerPolicy="no-referrer"
                                                    onError={() => setImageError(true)}
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-[13px] font-bold leading-none select-none font-mono">
                                                {initials}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    {(() => {
                                        const cuidLike = (s: string) => /^c[a-z0-9]{20,}$/i.test(s)
                                        const shortAddr = identity.address ? `${identity.address.slice(0, 6)}...${identity.address.slice(-4)}` : null
                                        const primaryCandidate = shortAddr || identity.email || identity.displayName || 'User'
                                        const primary = cuidLike(primaryCandidate) ? (shortAddr || identity.email || 'User') : primaryCandidate
                                        const secondary = identity.email && identity.email !== primary ? identity.email : null
                                        return (
                                            <>
                                                <p className="text-sm font-semibold truncate text-slate-900 dark:text-white/95">{primary}</p>
                                                {secondary ? (
                                                    <p className="text-xs text-slate-500 truncate dark:text-white/60">{secondary}</p>
                                                ) : null}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>

                            {/* Tier Badge with icon */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="default"
                                    className={`text-[11px] font-semibold px-3 py-1 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] border-0 ${tier === 'pro'
                                            ? 'bg-sec-600 dark:bg-sec-500 text-white'
                                            : tier === 'elite'
                                                ? 'bg-elite-600 dark:bg-elite-500 text-white'
                                                : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-white'
                                        }`}
                                >
                                    {tier === 'free' && <Zap className="h-3 w-3 mr-1 inline" />}
                                    {tier === 'pro' && <Star className="h-3 w-3 mr-1 inline" />}
                                    {tier === 'elite' && <Sparkles className="h-3 w-3 mr-1 inline" />}
                                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
                                </Badge>
                                {identity.role === 'ADMIN' && (
                                    <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-[11px] text-blue-700 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-100">
                                        Admin
                                    </Badge>
                                )}
                            </div>

                            {/* Wallet address if available */}
                            {identity.address && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100/80 border border-slate-200/80 shadow-inner text-slate-700 dark:bg-white/5 dark:border-white/5 dark:text-white/70">
                                    <Wallet className="h-3.5 w-3.5 text-slate-500 dark:text-white/70" />
                                    <span className="text-[11px] font-mono text-slate-700 font-mono-tabular dark:text-white/70">
                                        {(identity.walletProvider === 'solana' ? 'SOL' : 'ETH')} · {identity.address.slice(0, 6)}...{identity.address.slice(-4)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DropdownMenuLabel>
                </div>

                {/* Quick Actions Section */}
                <div className="px-2.5 py-2">
                    <DropdownMenuItem
                        onClick={() => {
                            router.push('/settings')
                            setIsOpen(false)
                        }}
                        className={itemClass}
                    >
                        <span className={iconClass}>
                            <Settings className="h-4 w-4" />
                        </span>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Settings</p>
                            <p className="text-[11px] text-slate-500 dark:text-white/60">Profile, preferences</p>
                        </div>
                    </DropdownMenuItem>

                    {/* Admin Panel - Only visible to admins */}
                    {identity.role === 'ADMIN' && (
                        <>
                            <DropdownMenuSeparator className="my-2 mx-2 border-slate-200/70 dark:border-white/5" />
                            <DropdownMenuItem
                                onClick={() => {
                                    router.push('/admin')
                                    setIsOpen(false)
                                }}
                                className="group relative mx-1 my-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-purple-500/15 hover:from-blue-500/30 hover:to-purple-500/25 border border-blue-400/30 shadow-[0_12px_36px_rgba(37,99,235,0.25)] focus:outline-none"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 group-hover:ring-blue-200 transition-all duration-150 dark:bg-white/10 dark:text-blue-100 dark:ring-white/10 dark:group-hover:ring-white/20">
                                    <Shield className="h-4 w-4" />
                                </span>
                                <span className="flex-1 font-semibold text-blue-700 dark:text-blue-50">Admin Panel</span>
                                <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px] border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-500/30 dark:text-blue-50 dark:bg-blue-500/20">
                                    ADMIN
                                </Badge>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-2 mx-2 border-slate-200/70 dark:border-white/5" />
                        </>
                    )}

                    {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
                        <DropdownMenuItem
                            onClick={() => {
                            router.push('/settings/billing')
                            setIsOpen(false)
                        }}
                        className={itemClass}
                    >
                        <span className={iconClass}>
                            <CreditCard className="h-4 w-4" />
                        </span>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Billing & Subscription</p>
                            <p className="text-[11px] text-slate-500 dark:text-white/60">Plans, invoices, payment methods</p>
                        </div>
                    </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                        onClick={() => {
                            router.push('/alerts')
                            setIsOpen(false)
                        }}
                        className={itemClass}
                    >
                        <span className={iconClass}>
                            <Bell className="h-4 w-4" />
                        </span>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Email Alerts</p>
                            <p className="text-[11px] text-slate-500 dark:text-white/60">Manage triggers & delivery</p>
                        </div>
                    </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="my-2 border-slate-200/70 dark:border-white/5" />

                {/* Copy Actions */}
                <div className="px-2.5 py-2">
                    {identity.email && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.email!, 'Email')}
                            className={`${itemClass} bg-slate-100/80 dark:bg-white/10`}
                        >
                            <span className={iconClass}>
                                <Copy className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Copy email</p>
                                <p className="text-[11px] text-slate-500 dark:text-white/60">Use for support or invoices</p>
                            </div>
                        </DropdownMenuItem>
                    )}
                    {identity.address && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.address!, 'Address')}
                            className={`${itemClass} bg-slate-100/80 dark:bg-white/10`}
                        >
                            <span className={iconClass}>
                                <Wallet className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Copy address</p>
                                <p className="text-[11px] text-slate-500 dark:text-white/60">Wallet on file</p>
                            </div>
                        </DropdownMenuItem>
                    )}
                </div>

                {/* Upgrade CTA for Free Tier */}
                {tier === 'free' && (
                    <>
                        <DropdownMenuSeparator className="my-2 border-slate-200/70 dark:border-white/5" />
                        <div className="px-3 pb-3">
                            <Button
                                onClick={() => {
                                    router.push('/pricing')
                                    setIsOpen(false)
                                }}
                                size="sm"
                                className="w-full bg-gradient-to-r from-brand-500 via-emerald-500 to-sec-600 hover:from-brand-600 hover:via-emerald-600 hover:to-sec-700 text-white shadow-[0_18px_40px_rgba(16,185,129,0.35)] transition-all duration-200 h-11 rounded-xl text-base font-semibold"
                            >
                                <Sparkles className="h-4 w-4 mr-2 drop-shadow-sm" />
                                Upgrade to Pro
                            </Button>
                        </div>
                    </>
                )}

                <DropdownMenuSeparator className="my-2 border-slate-200/70 dark:border-white/5" />

                {/* Sign Out */}
                <div className="px-2.5 pb-2">
                    <DropdownMenuItem
                        onClick={() => {
                            try { disconnect() } catch (_) { }
                            try {
                                const anyWindow: any = typeof window !== 'undefined' ? window : null
                                anyWindow?.solana?.isConnected && anyWindow?.solana?.disconnect?.()
                            } catch (_) { }
                            try {
                                if (typeof window !== 'undefined') {
                                    window.localStorage.removeItem('vs_normalized_email')
                                    window.localStorage.removeItem('vs_avatar_mode')
                                    window.localStorage.removeItem('debugAvatar')
                                }
                            } catch (_) { }
                            signOut({ callbackUrl: '/' })
                        }}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold text-danger-400 transition-all duration-150 hover:bg-danger-500/10 focus:bg-danger-500/15"
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-500/10 text-danger-400 ring-1 ring-danger-500/25 group-hover:bg-danger-500/15">
                            <LogOut className="h-4 w-4" />
                        </span>
                        <span className="flex-1">Sign Out</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
