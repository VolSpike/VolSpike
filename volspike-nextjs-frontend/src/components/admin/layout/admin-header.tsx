'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
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
import {
    User,
    Settings,
    LogOut
} from 'lucide-react'

export function AdminHeader() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const router = useRouter()

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

                    {/* User menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center space-x-2 hover:bg-muted/80 transition-colors">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 shadow-sm">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <div className="hidden md:block text-left">
                                    <div className="text-sm font-medium text-foreground">{session?.user?.email}</div>
                                    <div className="text-xs text-muted-foreground">Administrator</div>
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg p-1" usePortal={true}>
                            <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Account
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => router.push('/admin/settings')}
                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-muted/80 transition-colors focus:bg-muted/80"
                            >
                                <Settings className="h-4 w-4 mr-2.5 text-muted-foreground" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-border/60" />
                            <DropdownMenuItem 
                                onClick={handleSignOut} 
                                className="px-3 py-2 cursor-pointer rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:bg-red-50 dark:focus:bg-red-950/20"
                            >
                                <LogOut className="h-4 w-4 mr-2.5 text-red-600 dark:text-red-400" />
                                <span className="text-red-700 dark:text-red-400 font-medium">Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
