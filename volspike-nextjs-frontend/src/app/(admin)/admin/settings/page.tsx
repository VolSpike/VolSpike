import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { SettingsForm } from '@/components/admin/settings/settings-form'
import { SecuritySettings } from '@/components/admin/settings/security-settings'
import { TwoFactorSettings } from '@/components/admin/settings/two-factor-settings'
import { adminAPI } from '@/lib/admin/api-client'

export const metadata: Metadata = {
    title: 'Settings - Admin',
    description: 'Admin settings and configuration',
}

export default async function SettingsPage() {
    const session = await auth()

    // Check if user is admin
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth')
    }

    // Set access token for API client
    adminAPI.setAccessToken(session.accessToken || null)

    try {
        // Fetch settings data
        const settingsData = await adminAPI.getAdminSettings()

        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Admin Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Configure system settings and security options
                        </p>
                    </div>

                    <div className="grid gap-6">
                        {/* General Settings */}
                        <SettingsForm settings={settingsData.settings} />

                        {/* Security Settings */}
                        <SecuritySettings />

                        {/* 2FA Settings */}
                        <TwoFactorSettings user={settingsData.user} />
                    </div>
                </div>
            </AdminLayout>
        )
    } catch (error) {
        console.error('Error fetching settings:', error)
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Admin Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Configure system settings and security options
                        </p>
                    </div>
                    <div className="rounded-xl border border-red-200/50 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center backdrop-blur-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error loading settings</h3>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            We couldn&apos;t load the settings. Please refresh the page to try again.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        )
    }
}
