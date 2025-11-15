import React from 'react'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'
import { BackgroundPattern } from '@/components/ui/background-pattern'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="relative flex min-h-screen bg-gradient-to-br from-background via-background to-muted/60">
            <BackgroundPattern />
            <AdminSidebar />
            <div className="flex flex-1 flex-col lg:ml-64">
                <AdminHeader />
                <main className="flex-1 pl-3 pr-4 py-6 md:pl-4 md:pr-8 md:py-8">
                    <div className="w-full max-w-7xl space-y-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
