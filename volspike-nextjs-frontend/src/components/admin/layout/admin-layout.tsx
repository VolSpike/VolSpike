import React from 'react'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'
import { BackgroundPattern } from '@/components/ui/background-pattern'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="relative min-h-screen bg-background flex flex-col">
            <BackgroundPattern />
            <div className="relative z-10 flex flex-1 min-h-0">
                {/* Sidebar column - sticky on desktop, fixed overlay on mobile */}
                <div className="hidden lg:block lg:sticky lg:top-0 lg:self-start lg:h-screen">
                    <AdminSidebar />
                </div>
                
                {/* Mobile sidebar - fixed overlay */}
                <div className="lg:hidden">
                    <AdminSidebar />
                </div>

                {/* Content column - flex-1 to fill remaining space */}
                <div className="flex flex-col flex-1 min-w-0 bg-background/95 lg:border-l lg:border-border/60">
                    <AdminHeader />
                    <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
                        <div className="w-full max-w-7xl mx-auto space-y-6">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
