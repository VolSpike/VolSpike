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
import { useTheme } from 'next-themes'

export function UserMenu() {
    const router = useRouter()
    const { data: session } = useSession()
    const identity = useUserIdentity()
    const { resolvedTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const [imageError, setImageError] = useState(false)
    const [debugAvatar, setDebugAvatar] = useState(false)
    const [avatarMode, setAvatarMode] = useState<'auto' | 'image' | 'initials'>('auto')
    const [mounted, setMounted] = useState(false)
    const { disconnect } = useDisconnect()

    useEffect(() => setMounted(true), [])

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
    const emailFromIdentity = identity.email
    const emailFromSession = session?.user?.email
    const normalizedEmail = (emailFromIdentity || emailFromSession)?.toLowerCase().trim() || null
    const userIdentifier = normalizedEmail || (session?.user as any)?.walletAddress || session?.user?.id || null

    const initials = normalizedEmail
        ? generateInitials(normalizedEmail, null)
        : generateInitials(null, null, identity.address)

    const avatarColors = getAvatarColor(normalizedEmail || userIdentifier)

    const isGoogleTile = isLikelyGoogleLetterTile(identity.image || undefined)
    const envFilterTiles = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AVATAR_FILTER_GOOGLE_TILES === 'true'
    let hideTiles = false
    try {
        if (typeof window !== 'undefined') {
            hideTiles = window.localStorage?.getItem('vs_avatar_hide_tiles') === '1'
        }
    } catch (_) { }
    const shouldFilterTiles = envFilterTiles || hideTiles
    const showAvatarImage = Boolean(
        identity.image &&
        !imageError &&
        (avatarMode === 'image' || avatarMode === 'auto') &&
        (!shouldFilterTiles || !isGoogleTile)
    )

    if (debugAvatar || process.env.NODE_ENV === 'development') {
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
    const isDarkMode = mounted ? resolvedTheme === 'dark' : true
    const panelClass = `relative w-[320px] max-h-[min(80vh,540px)] overflow-y-auto rounded-2xl border backdrop-blur-xl animate-scale-in ${
        isDarkMode
            ? 'border-white/10 bg-[#050a13]/96 text-white shadow-[0_32px_70px_rgba(0,0,0,0.65)] ring-1 ring-brand-500/20'
            : 'border-slate-200/80 bg-white/95 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.2)] ring-1 ring-white/70'
    }`
    const tileClass = `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
        isDarkMode ? 'border-white/8 bg-white/5 text-white hover:bg-white/10' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
    }`
    const iconClass = `flex h-9 w-9 items-center justify-center rounded-lg ${
        isDarkMode ? 'bg-white/10 text-white ring-1 ring-white/10' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
    }`
    const dividerClass = isDarkMode ? 'border-white/10' : 'border-slate-200/80'

    const quickActions = [
        {
            label: 'Settings',
            sub: 'Profile, preferences',
            icon: Settings,
            href: '/settings',
        },
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
            ? {
                label: 'Billing & Subscription',
                sub: 'Plans, invoices, payment methods',
                icon: CreditCard,
                href: '/settings/billing',
            }
            : null,
        {
            label: 'Email Alerts',
            sub: 'Manage triggers & delivery',
            icon: Bell,
            href: '/alerts',
        },
    ].filter(Boolean) as {
        label: string
        sub: string
        icon: typeof Settings
        href: string
    }[]

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
            <DropdownMenuContent align="end" side="bottom" className={panelClass}>
                <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-brand-500/25 blur-[60px]" />
                <DropdownMenuLabel className={`relative p-4 pb-3 border-b ${isDarkMode ? 'border-white/10 text-white' : 'border-slate-200/80 text-slate-900'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFromBright} ${avatarColors.gradientViaBright} ${avatarColors.gradientToBright} shadow-[0_0_0_4px_rgba(19,255,141,0.18)]`}>
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
                                        <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{primary}</p>
                                        {secondary ? (
                                            <p className={`text-xs truncate ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>{secondary}</p>
                                        ) : null}
                                    </>
                                )
                            })()}
                            <div className="mt-2 flex items-center gap-2">
                                <Badge
                                    variant="default"
                                    className={`text-[11px] font-semibold px-3 py-1 rounded-full border-0 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${tier === 'pro'
                                        ? 'bg-sec-600 text-white'
                                        : tier === 'elite'
                                            ? 'bg-elite-600 text-white'
                                            : isDarkMode
                                                ? 'bg-white/10 text-white'
                                                : 'bg-slate-100 text-slate-800'
                                        }`}
                                >
                                    {tier === 'free' && <Zap className="h-3 w-3 mr-1 inline" />}
                                    {tier === 'pro' && <Star className="h-3 w-3 mr-1 inline" />}
                                    {tier === 'elite' && <Sparkles className="h-3 w-3 mr-1 inline" />}
                                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
                                </Badge>
                                {identity.role === 'ADMIN' && (
                                    <Badge
                                        variant="outline"
                                        className={`rounded-full text-[11px] ${isDarkMode ? 'border-blue-400/60 bg-blue-500/10 text-blue-100' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
                                    >
                                        Admin
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    {identity.address && (
                        <div
                            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-mono font-mono-tabular ${
                                isDarkMode ? 'bg-white/5 text-white/80 ring-1 ring-white/10' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                            }`}
                        >
                            <Wallet className={`h-3.5 w-3.5 ${isDarkMode ? 'text-white/70' : 'text-slate-500'}`} />
                            <span>
                                {(identity.walletProvider === 'solana' ? 'SOL' : 'ETH')} · {identity.address.slice(0, 6)}...{identity.address.slice(-4)}
                            </span>
                        </div>
                    )}
                </DropdownMenuLabel>

                <div className="px-3 py-3 space-y-2">
                    {quickActions.map((item) => (
                        <DropdownMenuItem
                            key={item.label}
                            onClick={() => {
                                router.push(item.href)
                                setIsOpen(false)
                            }}
                            className={tileClass}
                        >
                            <span className={iconClass}>
                                <item.icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">{item.label}</p>
                                <p className={`text-[11px] ${isDarkMode ? 'text-white/70' : 'text-slate-500'}`}>{item.sub}</p>
                            </div>
                        </DropdownMenuItem>
                    ))}

                    {identity.role === 'ADMIN' && (
                        <DropdownMenuItem
                            onClick={() => {
                                router.push('/admin')
                                setIsOpen(false)
                            }}
                            className={`${tileClass} ${
                                isDarkMode
                                    ? 'bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-purple-500/15 border-blue-400/30'
                                    : 'bg-gradient-to-r from-blue-100 via-blue-50 to-purple-50 border-blue-200'
                            }`}
                        >
                            <span className={iconClass}>
                                <Shield className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">Admin Panel</p>
                                <p className={`text-[11px] ${isDarkMode ? 'text-white/70' : 'text-blue-700'}`}>Dashboard & controls</p>
                            </div>
                            <Badge
                                variant="outline"
                                className={`h-5 px-1.5 text-[10px] ${
                                    isDarkMode ? 'border-blue-400/40 text-blue-50 bg-blue-500/20' : 'border-blue-200 text-blue-700 bg-blue-100'
                                }`}
                            >
                                ADMIN
                            </Badge>
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className={`my-2 ${dividerClass}`} />

                    {identity.email && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.email!, 'Email')}
                            className={tileClass}
                        >
                            <span className={iconClass}>
                                <Copy className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">Copy email</p>
                                <p className={`text-[11px] ${isDarkMode ? 'text-white/70' : 'text-slate-500'}`}>Use for support or invoices</p>
                            </div>
                        </DropdownMenuItem>
                    )}
                    {identity.address && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.address!, 'Address')}
                            className={tileClass}
                        >
                            <span className={iconClass}>
                                <Wallet className="h-4 w-4" />
                            </span>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">Copy address</p>
                                <p className={`text-[11px] ${isDarkMode ? 'text-white/70' : 'text-slate-500'}`}>Wallet on file</p>
                            </div>
                        </DropdownMenuItem>
                    )}

                    {tier === 'free' && (
                        <div className="pt-2">
                            <Button
                                onClick={() => {
                                    router.push('/pricing')
                                    setIsOpen(false)
                                }}
                                size="sm"
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-500 via-emerald-500 to-sec-600 text-white shadow-[0_18px_40px_rgba(16,185,129,0.35)] hover:from-brand-600 hover:via-emerald-600 hover:to-sec-700"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Upgrade to Pro
                            </Button>
                        </div>
                    )}

                    <DropdownMenuSeparator className={`my-2 ${dividerClass}`} />

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
                        className="flex items-center gap-3 rounded-xl bg-danger-500/10 px-3 py-2.5 text-base font-semibold text-danger-500 transition hover:bg-danger-500/20 focus:bg-danger-500/20"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-500/20 text-danger-500 ring-1 ring-danger-500/30">
                            <LogOut className="h-4 w-4" />
                        </span>
                        <span className="flex-1">Sign Out</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
