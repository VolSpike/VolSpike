'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
    User,
    Settings,
    LogOut,
    Shield
} from 'lucide-react'

export function AdminHeader() {
    const { data: session } = useSession()
    const pathname = usePathname()

    const handleSignOut = () => {
        signOut({ callbackUrl: '/' })
    }

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

    return (
        <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
                {/* Left side - brand + section context */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 via-elite-500/10 to-sec-500/20 text-brand-600 dark:text-brand-300 shadow-inner ring-1 ring-brand-500/30">
                            <Shield className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold leading-tight">
                                VolSpike Admin
                            </span>
                            <span className="text-xs text-muted-foreground leading-tight">
                                {getSectionLabel()}
                            </span>
                        </div>
                    </div>
                    <Separator orientation="vertical" className="hidden h-6 md:inline-flex" />
                    <p className="hidden text-xs text-muted-foreground md:inline">
                        Monitor users, subscriptions, security and system health.
                    </p>
                </div>

                {/* Right side - theme and user menu */}
                <div className="flex items-center space-x-2 md:space-x-4">
                    {/* Theme toggle */}
                    <ThemeToggle />

                    {/* Logout Button - Prominent */}
                    <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 border-border/70 text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden md:inline font-medium">Sign Out</span>
                    </Button>

                    {/* User menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center space-x-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-elite-500 to-sec-500">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <div className="hidden md:block text-left">
                                    <div className="text-sm font-medium">{session?.user?.email}</div>
                                    <div className="text-xs text-muted-foreground">Administrator</div>
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <User className="h-4 w-4 mr-2" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Settings className="h-4 w-4 mr-2" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                                <LogOut className="h-4 w-4 mr-2" />
                                Sign Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
