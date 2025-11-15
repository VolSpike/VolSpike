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
    LogOut,
    User
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

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

    const handleSignOut = () => {
        signOut({ callbackUrl: '/' })
    }

    return (
        <>
            {/* Mobile menu button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
            </div>

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-center h-16 px-4 border-b">
                        <div className="flex items-center space-x-2">
                            <Shield className="h-8 w-8 text-blue-600" />
                            <span className="text-xl font-bold">Admin Panel</span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 px-4 py-6">
                        <nav className="space-y-2">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.name}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </ScrollArea>

                    {/* User info and logout */}
                    <div className="p-4 border-t">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-blue-600" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {session?.user?.email}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    Administrator
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSignOut}
                            className="w-full justify-start"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
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
