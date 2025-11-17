'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { Bell, Zap, Star, Sparkles, Menu, X, Home, LayoutDashboard, Tag, Settings, LogOut } from 'lucide-react'
import { UserMenu } from '@/components/user-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { signOut } from 'next-auth/react'
import { useEnforceSingleIdentity } from '@/hooks/use-enforce-single-identity'

export function Header({ hideWalletConnect = false }: { hideWalletConnect?: boolean }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const tier = session?.user?.tier || 'free'
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Ensure only one active identity at a time
    useEnforceSingleIdentity()

    // Hide global site header on admin routes - admin has its own chrome
    if (pathname?.startsWith('/admin')) {
        return null
    }

    return (
        <header className="sticky top-0 z-[100] w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm transition-all duration-200">
            <div className="container flex h-16 items-center justify-between gap-3">
                {/* Logo with subtle hover effect */}
                <Link
                    href="/"
                    className="flex items-center gap-3 min-w-0 group transition-opacity hover:opacity-80"
                >
                    <div className="relative">
                        <Image
                            src="/volspike-logo.svg"
                            alt="VolSpike logo"
                            width={36}
                            height={36}
                            priority
                            className="h-9 w-9 transition-transform duration-200 group-hover:scale-105"
                        />
                    </div>
                    <span className="truncate text-xl font-bold tracking-tight sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
                        VolSpike
                    </span>
                </Link>

                {/* Navigation Links */}
                <nav className="hidden md:flex items-center gap-1 ml-8">
                    <Link
                        href="/pricing"
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative ${pathname === '/pricing'
                            ? 'text-brand-600 dark:text-brand-400 bg-brand-500/10 font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        {pathname === '/pricing' && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />
                        )}
                        Pricing
                    </Link>
                    <Link
                        href="/dashboard"
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative ${(pathname === '/dashboard' || pathname === '/')
                            ? 'text-brand-600 dark:text-brand-400 bg-brand-500/10 font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        {(pathname === '/dashboard' || pathname === '/') && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />
                        )}
                        Dashboard
                    </Link>
                    <Link
                        href="/donate"
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative ${pathname === '/donate'
                            ? 'text-purple-400 bg-purple-500/10 font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        aria-label="Donate to VolSpike"
                    >
                        {pathname === '/donate' && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-500 rounded-full" />
                        )}
                        Donate
                    </Link>
                </nav>

                {/* Right side actions */}
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    {/* Mobile Menu - visible only on mobile/tablet */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden h-9 w-9 rounded-full"
                                aria-label="Open menu"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    <Image
                                        src="/volspike-logo.svg"
                                        alt="VolSpike"
                                        width={28}
                                        height={28}
                                    />
                                    <span className="text-lg">VolSpike</span>
                                </SheetTitle>
                            </SheetHeader>

                            {/* Navigation Links */}
                            <nav className="mt-8 flex flex-col gap-1">
                                <Link
                                    href="/"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/'
                                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <Home className="h-4 w-4" />
                                    Home
                                </Link>

                                <Link
                                    href="/dashboard"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/dashboard'
                                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <LayoutDashboard className="h-4 w-4" />
                                    Dashboard
                                </Link>

                                <Link
                                    href="/pricing"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/pricing'
                                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <Tag className="h-4 w-4" />
                                    Pricing
                                </Link>

                                <Link
                                    href="/donate"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/donate'
                                        ? 'bg-purple-500/10 text-purple-400 font-semibold'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Donate
                                </Link>

                                <Separator className="my-4" />

                                {session ? (
                                    <>
                                        {/* Tier Badge */}
                                        <div className="px-3 py-2 mb-2">
                                            <div
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg
                                                    ${tier === 'free'
                                                        ? 'bg-muted/70 border border-border text-muted-foreground'
                                                        : tier === 'pro'
                                                            ? 'bg-sec-500/20 border border-sec-500/40 text-sec-700 dark:text-sec-400'
                                                            : 'bg-elite-500/20 border border-elite-500/40 text-elite-700 dark:text-elite-400'
                                                    }`}
                                            >
                                                {tier === 'free' && <Zap className="h-4 w-4" />}
                                                {tier === 'pro' && <Star className="h-4 w-4" />}
                                                {tier === 'elite' && <Sparkles className="h-4 w-4" />}
                                                <span className="text-sm font-medium capitalize">
                                                    {tier} Tier
                                                </span>
                                            </div>
                                        </div>

                                        <Link
                                            href="/settings"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                                        >
                                            <Settings className="h-4 w-4" />
                                            Settings
                                        </Link>

                                        <button
                                            onClick={() => {
                                                setMobileMenuOpen(false)
                                                signOut()
                                            }}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors text-left w-full"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Sign Out
                                        </button>

                                        {/* Upgrade CTA for free tier */}
                                        {tier === 'free' && (
                                            <>
                                                <Separator className="my-4" />
                                                <Button
                                                    onClick={() => {
                                                        setMobileMenuOpen(false)
                                                        router.push('/pricing')
                                                    }}
                                                    className="w-full bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-lg"
                                                >
                                                    <Sparkles className="h-4 w-4 mr-2" />
                                                    Upgrade to Pro
                                                </Button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={() => {
                                                setMobileMenuOpen(false)
                                                signIn()
                                            }}
                                            className="w-full bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white"
                                        >
                                            Sign In
                                        </Button>
                                    </>
                                )}
                            </nav>
                        </SheetContent>
                    </Sheet>

                    <ThemeToggle />

                    {status === 'loading' ? (
                        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                    ) : session ? (
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Tier Pill - Clickable */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/settings')}
                                className={`hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full transition-all
                                    ${tier === 'free'
                                        ? 'bg-muted/70 border border-border text-muted-foreground'
                                        : tier === 'pro'
                                            ? 'bg-sec-500/20 border border-sec-500/40 text-sec-700 dark:text-sec-400'
                                            : 'bg-elite-500/20 border border-elite-500/40 text-elite-700 dark:text-elite-400'
                                    }`}
                            >
                                {tier === 'free' && <Zap className="h-3.5 w-3.5" />}
                                {tier === 'pro' && <Star className="h-3.5 w-3.5" />}
                                {tier === 'elite' && <Sparkles className="h-3.5 w-3.5" />}
                                <span className="text-xs font-medium capitalize">
                                    {tier} Tier
                                </span>
                            </Button>

                            {/* Notification Bell - Shell for future implementation */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hidden md:flex h-9 w-9 rounded-full relative hover:bg-accent transition-all duration-150"
                                aria-label="Notifications"
                            >
                                <Bell className="h-4 w-4" />
                                {/* Badge for unread count - hidden by default */}
                                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger-500 opacity-0" />
                            </Button>

                            {/* Wallet connect belongs in auth/Linked Accounts surfaces, not the top header */}

                            {/* User Menu */}
                            <UserMenu />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {/* Wallet connection is part of auth flow; hide on public pages */}
                            {pathname?.startsWith('/auth') && !hideWalletConnect && <ConnectButton />}
                            <Button
                                onClick={() => router.push('/auth?tab=signup')}
                                className="bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-md shadow-brand-500/20 ring-1 ring-brand-500/20 transition-all duration-200"
                            >
                                Start Free
                            </Button>
                            <Link href="/auth?tab=signin" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground ml-1">
                                Sign in
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
