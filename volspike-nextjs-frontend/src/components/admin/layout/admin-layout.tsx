import React from 'react'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'
import { BackgroundPattern } from '@/components/ui/background-pattern'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="relative min-h-screen bg-background">
            <BackgroundPattern />
            <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
                {/* Sidebar column */}
                <AdminSidebar />

                {/* Content column */}
                <div className="flex flex-col bg-background/95 lg:border-l lg:border-border/60">
                    <AdminHeader />
                    <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
                        <div className="w-full max-w-7xl mx-auto space-y-6">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
