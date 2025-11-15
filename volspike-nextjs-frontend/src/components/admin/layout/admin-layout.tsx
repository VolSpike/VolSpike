import React from 'react'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-950">
            <AdminSidebar />
            <div className="flex flex-col flex-1 lg:ml-64">
                <AdminHeader />
                <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
