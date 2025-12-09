'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
    CommandDialog, 
    CommandEmpty, 
    CommandGroup, 
    CommandInput, 
    CommandItem, 
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import { 
    Home, 
    TrendingUp, 
    Bell, 
    Settings, 
    CreditCard, 
    LogOut,
    Search,
    Zap,
    Star,
    FileText,
    BarChart3,
} from 'lucide-react'
import { signOut } from 'next-auth/react'

interface CommandPaletteProps {
    userTier?: 'free' | 'pro' | 'elite'
    onCreateAlert?: () => void
}

export function CommandPalette({ userTier = 'free', onCreateAlert }: CommandPaletteProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    // Keyboard shortcut: ⌘K or Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const runCommand = useCallback((command: () => void) => {
        setOpen(false)
        command()
    }, [])

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                
                <CommandGroup heading="Navigation">
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/dashboard'))}
                    >
                        <Home className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/watchlist'))}
                    >
                        <Star className="mr-2 h-4 w-4" />
                        <span>Watchlist</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/settings/alerts'))}
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Alerts</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/settings'))}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </CommandItem>
                    {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
                        <CommandItem
                            onSelect={() => runCommand(() => router.push('/settings/billing'))}
                        >
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>Billing & Subscription</span>
                        </CommandItem>
                    )}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Actions">
                    <CommandItem
                        onSelect={() => runCommand(() => {
                            if (onCreateAlert) {
                                onCreateAlert()
                            }
                        })}
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Create Alert</span>
                    </CommandItem>
                    {userTier === 'free' && (
                        <CommandItem
                            onSelect={() => runCommand(() => router.push('/pricing'))}
                        >
                            <Zap className="mr-2 h-4 w-4 text-brand-500" />
                            <span>Upgrade to Pro</span>
                        </CommandItem>
                    )}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Resources">
                    <CommandItem
                        onSelect={() => runCommand(() => window.open('https://www.binance.com/activity/referral-entry/CPA?ref=CPA_0090FDRWPL&utm_source=volspike', '_blank'))}
                    >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Binance Futures</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/docs'))}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Documentation</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Account">
                    <CommandItem
                        onSelect={() => runCommand(() => signOut({ callbackUrl: '/' }))}
                        className="text-danger-600 dark:text-danger-400"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}

