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
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
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
    FileText,
    Key,
    Sparkles,
    Shield,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

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
                className="w-[280px] p-0 backdrop-blur-lg bg-popover/95 border-border/50 shadow-lg-dark dark:shadow-lg-dark animate-scale-in rounded-xl"
            >
                {/* User Info Section with Glassmorphism */}
                <DropdownMenuLabel className="p-4 border-b border-border/50 bg-gradient-to-br from-brand-500/5 to-sec-500/5">
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-3">
                            {/* Avatar with glow */}
                            <div className={`h-10 w-10 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFromBright} ${avatarColors.gradientViaBright} ${avatarColors.gradientToBright} shadow-brand`}>
                                <div className={`h-full w-full rounded-full overflow-hidden flex items-center justify-center ${avatarColors.bg} text-white`}>
                                    {showAvatarImage ? (
                                        <div className="relative h-full w-full">
                                            <Image
                                                src={identity.image as string}
                                                alt={identity.displayName}
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                                referrerPolicy="no-referrer"
                                                onError={() => setImageError(true)}
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold leading-none select-none font-mono">
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
                                            <p className="text-sm font-semibold truncate text-foreground">{primary}</p>
                                            {secondary ? (
                                                <p className="text-xs text-muted-foreground truncate">{secondary}</p>
                                            ) : null}
                                        </>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Tier Badge with icon */}
                        <div className="flex items-center justify-between">
                            <Badge
                                variant="default"
                                className={`text-xs font-semibold px-2.5 py-1 transition-all duration-150 ${tier === 'pro'
                                        ? 'bg-sec-600 dark:bg-sec-500 text-white border-0 shadow-sec'
                                        : tier === 'elite'
                                            ? 'bg-elite-600 dark:bg-elite-500 text-white border-0 shadow-sm'
                                            : 'bg-gray-600 dark:bg-gray-500 text-white border-0'
                                    }`}
                            >
                                {tier === 'free' && <Zap className="h-3 w-3 mr-1 inline" />}
                                {tier === 'pro' && <Star className="h-3 w-3 mr-1 inline" />}
                                {tier === 'elite' && <Sparkles className="h-3 w-3 mr-1 inline" />}
                                {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
                            </Badge>
                            {identity.role === 'ADMIN' && (
                                <Badge variant="outline" className="text-xs border-danger-500/50 text-danger-600 dark:text-danger-400 dark:border-danger-400/50">
                                    Admin
                                </Badge>
                            )}
                        </div>

                        {/* Wallet address if available */}
                        {identity.address && (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50">
                                <Wallet className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-mono text-muted-foreground font-mono-tabular">
                                    {(identity.walletProvider === 'solana' ? 'SOL' : 'ETH')} · {identity.address.slice(0, 6)}...{identity.address.slice(-4)}
                                </span>
                            </div>
                        )}
                    </div>
                </DropdownMenuLabel>

                {/* Quick Actions Section */}
                <div className="py-1">
                    <DropdownMenuItem
                        onClick={() => {
                            router.push('/settings')
                            setIsOpen(false)
                        }}
                        className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                    >
                        <Settings className="h-4 w-4 mr-2.5 text-muted-foreground" />
                        <span className="flex-1">Settings</span>
                    </DropdownMenuItem>

                    {/* Admin Panel - Only visible to admins */}
                    {identity.role === 'ADMIN' && (
                        <>
                            <DropdownMenuSeparator className="my-1 mx-2" />
                            <DropdownMenuItem
                                onClick={() => {
                                    router.push('/admin')
                                    setIsOpen(false)
                                }}
                                className="mx-2 my-0.5 rounded-lg transition-all duration-150 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 dark:border-blue-400/20 focus:bg-blue-500/20 dark:focus:bg-blue-500/20 group"
                            >
                                <Shield className="h-4 w-4 mr-2.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-150" />
                                <span className="flex-1 font-semibold text-blue-700 dark:text-blue-300">Admin Panel</span>
                                <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400 dark:border-blue-400/30">
                                    ADMIN
                                </Badge>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 mx-2" />
                        </>
                    )}

                    {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
                        <DropdownMenuItem
                            onClick={() => {
                                router.push('/settings/billing')
                                setIsOpen(false)
                            }}
                            className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                        >
                            <CreditCard className="h-4 w-4 mr-2.5 text-muted-foreground" />
                            <span className="flex-1">Billing & Subscription</span>
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                        onClick={() => {
                            router.push('/alerts')
                            setIsOpen(false)
                        }}
                        className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                    >
                        <Bell className="h-4 w-4 mr-2.5 text-muted-foreground" />
                        <span className="flex-1">Email Alerts</span>
                    </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="my-1" />

                {/* Copy Actions */}
                <div className="py-1">
                    {identity.email && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.email!, 'Email')}
                            className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                        >
                            <Copy className="h-4 w-4 mr-2.5 text-muted-foreground" />
                            <span className="flex-1">Copy email</span>
                        </DropdownMenuItem>
                    )}
                    {identity.address && (
                        <DropdownMenuItem
                            onClick={() => handleCopy(identity.address!, 'Address')}
                            className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                        >
                            <Wallet className="h-4 w-4 mr-2.5 text-muted-foreground" />
                            <span className="flex-1">Copy address</span>
                        </DropdownMenuItem>
                    )}
                </div>

                {/* Upgrade CTA for Free Tier */}
                {tier === 'free' && (
                    <>
                        <DropdownMenuSeparator className="my-1" />
                        <div className="p-2">
                            <Button
                                onClick={() => {
                                    router.push('/pricing')
                                    setIsOpen(false)
                                }}
                                size="sm"
                                className="w-full bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-brand transition-all duration-200"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Upgrade to Pro
                            </Button>
                        </div>
                    </>
                )}

                <DropdownMenuSeparator className="my-1" />

                {/* Sign Out */}
                <div className="p-2">
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
                        className="rounded-lg text-danger-600 dark:text-danger-400 focus:text-danger-600 dark:focus:text-danger-400 focus:bg-danger-500/10 transition-all duration-150"
                    >
                        <LogOut className="h-4 w-4 mr-2.5" />
                        <span className="flex-1 font-medium">Sign Out</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
