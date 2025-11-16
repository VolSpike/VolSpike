'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    User,
    Settings,
    LogOut
} from 'lucide-react'
import { useUserIdentity } from '@/hooks/use-user-identity'
import { generateInitials, getAvatarColor, isLikelyGoogleLetterTile } from '@/lib/avatar-utils'

export function AdminHeader() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const router = useRouter()
    const identity = useUserIdentity()
    const [imageError, setImageError] = useState(false)

    const handleSignOut = () => {
        signOut({ callbackUrl: '/' })
    }

    // Avatar logic - matching UserMenu component
    const emailFromIdentity = identity.email
    const emailFromSession = session?.user?.email
    const normalizedEmail = (emailFromIdentity || emailFromSession)?.toLowerCase().trim() || null
    const userIdentifier = normalizedEmail || (session?.user as any)?.walletAddress || session?.user?.id || null

    // Generate initials from email for consistency
    const initials = normalizedEmail
        ? generateInitials(normalizedEmail, null)
        : generateInitials(null, null, identity.address)

    // Get avatar colors based on user identifier
    const avatarColors = getAvatarColor(normalizedEmail || userIdentifier)

    // Check if Google profile image should be shown
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
        (!shouldFilterTiles || !isGoogleTile)
    )

    const getSectionLabel = () => {
        if (!pathname) return 'Overview'
        if (pathname.startsWith('/admin/users')) return 'Users'
        if (pathname.startsWith('/admin/subscriptions')) return 'Subscriptions'
        if (pathname.startsWith('/admin/payments')) return 'Payments'
        if (pathname.startsWith('/admin/audit')) return 'Audit Logs'
        if (pathname.startsWith('/admin/metrics')) return 'Metrics'
        if (pathname.startsWith('/admin/settings')) return 'Settings'
        return 'Overview'
    }

    const sectionLabel = getSectionLabel()
    const sectionDescriptions: Record<string, string> = {
        'Overview': 'Monitor users, subscriptions, security and system health.',
        'Users': 'Manage user accounts, roles, and subscriptions.',
        'Subscriptions': 'View and manage user subscription plans.',
        'Payments': 'Track payment transactions and revenue.',
        'Audit Logs': 'Review system activity and security events.',
        'Metrics': 'Analyze system performance and user analytics.',
        'Settings': 'Configure platform settings and preferences.',
    }

    return (
        <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-16 items-center justify-between pl-16 pr-4 md:pl-6 md:pr-6 lg:pl-8 lg:pr-8">
                {/* Left side - current page context */}
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-semibold leading-tight text-foreground">
                            {sectionLabel}
                        </h1>
                        <p className="hidden text-xs text-muted-foreground leading-tight md:inline">
                            {sectionDescriptions[sectionLabel] || sectionDescriptions['Overview']}
                        </p>
                    </div>
                </div>

                {/* Right side - theme and user menu */}
                <div className="flex items-center space-x-2 md:space-x-4">
                    {/* Theme toggle */}
                    <ThemeToggle />

                    {/* User menu - Minimal trigger, details in dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-9 w-9 rounded-full p-0 flex items-center justify-center hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all duration-150"
                                aria-label="User menu"
                            >
                                {/* Avatar only - clean and minimal */}
                                <div className={`h-9 w-9 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFrom} ${avatarColors.gradientVia} ${avatarColors.gradientTo} shadow-sm`}>
                                    <div className={`h-full w-full rounded-full overflow-hidden flex items-center justify-center ${avatarColors.bg} text-white`}>
                                        {showAvatarImage ? (
                                            <div className="relative h-full w-full">
                                                <Image
                                                    src={identity.image as string}
                                                    alt={identity.displayName || 'User'}
                                                    fill
                                                    sizes="36px"
                                                    className="object-cover"
                                                    referrerPolicy="no-referrer"
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
                        <DropdownMenuContent align="end" className="w-[280px] p-0 backdrop-blur-lg bg-popover/95 border-border/50 shadow-lg-dark dark:shadow-lg-dark animate-scale-in rounded-xl" usePortal={true}>
                            {/* User Info Section - matching main UserMenu style */}
                            <DropdownMenuLabel className="p-4 border-b border-border/50 bg-gradient-to-br from-brand-500/5 to-sec-500/5">
                                <div className="flex flex-col space-y-3">
                                    <div className="flex items-center gap-3">
                                        {/* Larger avatar in dropdown */}
                                        <div className={`h-10 w-10 rounded-full p-[2px] bg-gradient-to-br ${avatarColors.gradientFromBright} ${avatarColors.gradientViaBright} ${avatarColors.gradientToBright} shadow-sm`}>
                                            <div className={`h-full w-full rounded-full overflow-hidden flex items-center justify-center ${avatarColors.bg} text-white`}>
                                                {showAvatarImage ? (
                                                    <div className="relative h-full w-full">
                                                        <Image
                                                            src={identity.image as string}
                                                            alt={identity.displayName || 'User'}
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
                                            <p className="text-sm font-semibold truncate text-foreground">
                                                {identity.displayName || session?.user?.email || 'Administrator'}
                                            </p>
                                            {session?.user?.email && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {session.user.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Admin Badge */}
                                    <div className="flex items-center">
                                        <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600 dark:text-blue-400 dark:border-blue-400/50">
                                            Administrator
                                        </Badge>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            
                            {/* Menu Items */}
                            <div className="py-1">
                                <DropdownMenuItem
                                    onClick={() => router.push('/admin/settings')}
                                    className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-muted/80 focus:bg-muted"
                                >
                                    <Settings className="h-4 w-4 mr-2.5 text-muted-foreground" />
                                    <span className="flex-1">Settings</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 mx-2" />
                                <DropdownMenuItem 
                                    onClick={handleSignOut} 
                                    className="mx-2 my-0.5 rounded-lg transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20"
                                >
                                    <LogOut className="h-4 w-4 mr-2.5 text-red-600 dark:text-red-400" />
                                    <span className="text-red-700 dark:text-red-400 font-medium">Sign Out</span>
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
