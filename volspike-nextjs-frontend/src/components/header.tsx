'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { Bell, Zap, Star, Sparkles } from 'lucide-react'
import { UserMenu } from '@/components/user-menu'

export function Header() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const tier = session?.user?.tier || 'free'

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm transition-all duration-200">
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
                        className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-150"
                    >
                        Pricing
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-150"
                    >
                        Dashboard
                    </Link>
                </nav>

                {/* Right side actions */}
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
                                className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted/50 hover:bg-muted transition-all duration-150"
                            >
                                {tier === 'free' && <Zap className="h-3.5 w-3.5 text-muted-foreground" />}
                                {tier === 'pro' && <Star className="h-3.5 w-3.5 text-sec-600 dark:text-sec-400" />}
                                {tier === 'elite' && <Sparkles className="h-3.5 w-3.5 text-elite-600 dark:text-elite-400" />}
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

                            {/* User Menu */}
                            <UserMenu />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <ConnectButton />
                            <Button 
                                onClick={() => signIn()}
                                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all duration-200"
                            >
                                Sign In
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
