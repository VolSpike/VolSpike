'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
    Bell,
    User,
    Settings,
    LogOut,
    Shield,
    Moon,
    Sun,
    Monitor
} from 'lucide-react'
import { useTheme } from 'next-themes'

export function AdminHeader() {
    const { data: session } = useSession()
    const { theme, setTheme } = useTheme()
    const [notifications] = useState([
        { id: 1, message: 'New user registered', time: '2 minutes ago' },
        { id: 2, message: 'Subscription payment failed', time: '5 minutes ago' },
        { id: 3, message: 'System backup completed', time: '1 hour ago' },
    ])

    const handleSignOut = () => {
        // This would be handled by the signOut function from next-auth
        window.location.href = '/api/auth/signout'
    }

    const handleThemeChange = () => {
        if (theme === 'light') {
            setTheme('dark')
        } else if (theme === 'dark') {
            setTheme('system')
        } else {
            setTheme('light')
        }
    }

    const getThemeIcon = () => {
        switch (theme) {
            case 'light':
                return <Sun className="h-4 w-4" />
            case 'dark':
                return <Moon className="h-4 w-4" />
            default:
                return <Monitor className="h-4 w-4" />
        }
    }

    const getThemeLabel = () => {
        switch (theme) {
            case 'light':
                return 'Light'
            case 'dark':
                return 'Dark'
            default:
                return 'System'
        }
    }

    return (
        <header className="sticky top-0 z-30 w-full border-b bg-white dark:bg-gray-900">
            <div className="flex h-16 items-center justify-between px-6">
                {/* Left side - could add breadcrumbs here */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <span className="text-lg font-semibold">Admin Panel</span>
                    </div>
                </div>

                {/* Right side - notifications and user menu */}
                <div className="flex items-center space-x-4">
                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative">
                                <Bell className="h-4 w-4" />
                                {notifications.length > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                                    >
                                        {notifications.length}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {notifications.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No new notifications
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3">
                                        <div className="font-medium">{notification.message}</div>
                                        <div className="text-xs text-muted-foreground">{notification.time}</div>
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Theme toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleThemeChange}
                        title={`Switch to ${theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'} theme`}
                    >
                        {getThemeIcon()}
                    </Button>

                    {/* Logout Button - Prominent */}
                    <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                    >
                        <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="hidden md:inline text-red-600 dark:text-red-400 font-medium">Sign Out</span>
                    </Button>

                    {/* User menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center space-x-2">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
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
