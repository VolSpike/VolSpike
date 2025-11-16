'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    LayoutDashboard,
    Users,
    CreditCard,
    FileText,
    BarChart3,
    Settings,
    Menu,
    X,
    Shield,
    User
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Separator } from '@/components/ui/separator'

const navigation = [
    {
        name: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
    },
    {
        name: 'Users',
        href: '/admin/users',
        icon: Users,
    },
    {
        name: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: CreditCard,
    },
    {
        name: 'Payments',
        href: '/admin/payments',
        icon: CreditCard,
    },
    {
        name: 'Audit Logs',
        href: '/admin/audit',
        icon: FileText,
    },
    {
        name: 'Metrics',
        href: '/admin/metrics',
        icon: BarChart3,
    },
    {
        name: 'Settings',
        href: '/admin/settings',
        icon: Settings,
    },
]

export function AdminSidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Mobile menu button */}
            <div className="fixed top-4 left-4 z-50 lg:hidden">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle admin navigation"
                >
                    {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
            </div>

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:relative lg:inset-0 lg:shadow-none",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-4 border-b border-border/60">
                        <div className="flex items-center space-x-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 via-elite-500/10 to-sec-500/20 text-brand-600 dark:text-brand-300 shadow-inner ring-1 ring-brand-500/30">
                                <Shield className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold tracking-tight">
                                    VolSpike Admin
                                </span>
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Control Center
                                </span>
                            </div>
                        </div>
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            Admin
                        </span>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 px-4 py-5">
                        <nav className="space-y-4 text-sm">
                            <div>
                                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Overview
                                </p>
                                {navigation.slice(0, 1).map((item) => {
                                    const isActive = pathname === item.href
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors border border-transparent",
                                                isActive
                                                    ? "bg-gradient-to-r from-brand-500/15 via-brand-500/10 to-transparent text-foreground border-brand-500/30 shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                            aria-current={isActive ? 'page' : undefined}
                                        >
                                            <item.icon className="h-4 w-4" aria-hidden="true" />
                                            <span>{item.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>

                            <Separator className="my-1" />

                            <div>
                                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Users & Billing
                                </p>
                                {navigation.slice(1, 4).map((item) => {
                                    const isActive = pathname === item.href
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors border border-transparent",
                                                isActive
                                                    ? "bg-gradient-to-r from-brand-500/15 via-sec-500/10 to-transparent text-foreground border-brand-500/30 shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                            aria-current={isActive ? 'page' : undefined}
                                        >
                                            <item.icon className="h-4 w-4" aria-hidden="true" />
                                            <span>{item.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>

                            <Separator className="my-1" />

                            <div>
                                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Monitoring &amp; Settings
                                </p>
                                {navigation.slice(4).map((item) => {
                                    const isActive = pathname === item.href
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors border border-transparent",
                                                isActive
                                                    ? "bg-gradient-to-r from-elite-500/15 via-brand-500/10 to-transparent text-foreground border-elite-500/30 shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                            aria-current={isActive ? 'page' : undefined}
                                        >
                                            <item.icon className="h-4 w-4" aria-hidden="true" />
                                            <span>{item.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </nav>
                    </ScrollArea>

                    {/* User info summary - kept for mobile context, hidden on desktop where header already shows account */}
                    <div className="border-t border-border/60 p-4 lg:hidden">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/10 via-elite-500/10 to-sec-500/10">
                                    <User className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {session?.user?.email}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    Administrator
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* System status - functional health check */}
                    <SystemStatusIndicator />
                </div>
            </div>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    )
}
