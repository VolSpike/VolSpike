'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreHorizontal, UserPlus, FileDown, FileUp, FileText, BarChart3 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { format } from 'date-fns'

export function UserActions() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { data: session } = useSession()
    const [importOpen, setImportOpen] = useState(false)
    const [exporting, setExporting] = useState(false)

    // Set access token for API client
    useEffect(() => {
        if (session?.accessToken) {
            adminAPI.setAccessToken(session.accessToken as string)
        }
    }, [session?.accessToken])

    const handleExportUsers = async () => {
        if (exporting) return
        
        setExporting(true)
        toast.loading('Exporting users...', { id: 'export-users' })
        
        try {
            console.log('[UserActions] Starting export...')
            
            // Get current filter params from URL
            const baseQuery: any = {
                search: searchParams.get('search') || undefined,
                role: searchParams.get('role') || undefined,
                tier: searchParams.get('tier') || undefined,
                status: searchParams.get('status') || undefined,
                sortBy: searchParams.get('sortBy') || 'createdAt',
                sortOrder: searchParams.get('sortOrder') || 'desc',
            }

            console.log('[UserActions] Base query:', baseQuery)
            
            // Fetch first page to get total count
            const firstPageQuery = {
                ...baseQuery,
                limit: 100,
                page: 1,
            }
            
            const firstPageData = await adminAPI.getUsers(firstPageQuery)
            const totalUsers = firstPageData.pagination.total
            const limit = firstPageData.pagination.limit || 100
            
            console.log('[UserActions] Total users to export:', totalUsers)
            
            if (totalUsers === 0) {
                toast.error('No users to export', { id: 'export-users' })
                setExporting(false)
                return
            }

            // Fetch all users in batches
            const allUsers: any[] = [...firstPageData.users]
            const totalPages = Math.ceil(totalUsers / limit)
            
            console.log('[UserActions] Fetching', totalPages, 'pages of users...')
            
            // Fetch remaining pages
            for (let page = 2; page <= totalPages; page++) {
                const pageQuery = {
                    ...baseQuery,
                    limit,
                    page,
                }
                
                const pageData = await adminAPI.getUsers(pageQuery)
                allUsers.push(...pageData.users)
                
                // Update loading toast with progress
                toast.loading(`Exporting users... (${allUsers.length}/${totalUsers})`, { id: 'export-users' })
            }

            console.log('[UserActions] Fetched all users:', {
                count: allUsers.length,
                expected: totalUsers
            })

            // Convert to CSV
            const csv = convertUsersToCSV(allUsers)
            
            // Create download
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            
            const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
            const filename = `users-export-${timestamp}.csv`
            
            link.setAttribute('href', url)
            link.setAttribute('download', filename)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            URL.revokeObjectURL(url)
            
            console.log('[UserActions] Export completed:', {
                filename,
                userCount: allUsers.length
            })
            
            toast.success(`Exported ${allUsers.length} user${allUsers.length === 1 ? '' : 's'}`, { id: 'export-users' })
        } catch (error: any) {
            console.error('[UserActions] Export error:', error)
            toast.error(error?.message || 'Export failed. Please try again.', { id: 'export-users' })
        } finally {
            setExporting(false)
        }
    }

    const convertUsersToCSV = (users: any[]): string => {
        // CSV headers
        const headers = [
            'ID',
            'Email',
            'Wallet Address',
            'Tier',
            'Role',
            'Status',
            'Email Verified',
            'Created At',
            'Last Login',
            'Payment Method',
            'Subscription Expires At'
        ]

        // Convert users to CSV rows
        const rows = users.map(user => {
            const subscriptionExpiresAt = user.subscriptionExpiresAt 
                ? format(new Date(user.subscriptionExpiresAt), 'yyyy-MM-dd HH:mm:ss')
                : ''
            
            return [
                user.id || '',
                user.email || '',
                user.walletAddress || '',
                user.tier || '',
                user.role || '',
                user.status || '',
                user.emailVerified ? 'Yes' : 'No',
                user.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
                user.lastLoginAt ? format(new Date(user.lastLoginAt), 'yyyy-MM-dd HH:mm:ss') : '',
                user.paymentMethod || '',
                subscriptionExpiresAt
            ].map(field => {
                // Escape CSV fields (handle commas, quotes, newlines)
                const stringField = String(field || '')
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return `"${stringField.replace(/"/g, '""')}"`
                }
                return stringField
            })
        })

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n')

        return csvContent
    }

    const handleImportUsers = async () => {
        try {
            // This would implement actual import functionality
            toast.success('Import functionality coming soon')
        } catch (error) {
            toast.error('Import failed')
        }
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
                <Button
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                    onClick={() => router.push('/admin/users/new')}
                >
                    <UserPlus className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">Create User</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2 text-sm sm:text-base">
                            <MoreHorizontal className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-nowrap hidden sm:inline">More Actions</span>
                            <span className="whitespace-nowrap sm:hidden">More</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                        align="end"
                        className="w-56 rounded-xl border-2 border-border/80 bg-background shadow-2xl backdrop-blur-xl p-2 z-[9999] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
                        style={{
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                        }}
                    >
                        <DropdownMenuLabel className="px-3 py-2.5 mb-1 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 bg-muted/30 rounded-t-lg -mx-2 -mt-2 mb-2">
                            Bulk Actions
                        </DropdownMenuLabel>
                        <div className="space-y-0.5">
                            <DropdownMenuItem 
                                onClick={handleExportUsers}
                                disabled={exporting}
                                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-150 focus:bg-blue-50 dark:focus:bg-blue-950/30 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileDown className={`h-4 w-4 mr-3 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform ${exporting ? 'animate-pulse' : ''}`} />
                                <div className="flex flex-col flex-1">
                                    <span className="font-medium text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                        {exporting ? 'Exporting...' : 'Export Users'}
                                    </span>
                                    <span className="text-xs text-muted-foreground group-hover:text-blue-600/80 dark:group-hover:text-blue-400/80">
                                        {exporting ? 'Please wait...' : 'Download user data as CSV'}
                                    </span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => setImportOpen(true)}
                                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-150 focus:bg-purple-50 dark:focus:bg-purple-950/30 group border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                            >
                                <FileUp className="h-4 w-4 mr-3 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col flex-1">
                                    <span className="font-medium text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-300">Import Users</span>
                                    <span className="text-xs text-muted-foreground group-hover:text-purple-600/80 dark:group-hover:text-purple-400/80">Upload CSV to add multiple users</span>
                                </div>
                            </DropdownMenuItem>
                        </div>
                        <DropdownMenuSeparator className="my-1.5" />
                        <DropdownMenuLabel className="px-3 py-2.5 mb-1 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 bg-muted/30 rounded-t-lg -mx-2 mb-2">
                            System
                        </DropdownMenuLabel>
                        <div className="space-y-0.5">
                            <DropdownMenuItem 
                                onClick={() => router.push('/admin/audit')}
                                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-150 focus:bg-indigo-50 dark:focus:bg-indigo-950/30 group border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                            >
                                <FileText className="h-4 w-4 mr-3 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col flex-1">
                                    <span className="font-medium text-foreground group-hover:text-indigo-700 dark:group-hover:text-indigo-300">View Audit Logs</span>
                                    <span className="text-xs text-muted-foreground group-hover:text-indigo-600/80 dark:group-hover:text-indigo-400/80">Review system activity and events</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => router.push('/admin/metrics')}
                                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all duration-150 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 group border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                            >
                                <BarChart3 className="h-4 w-4 mr-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col flex-1">
                                    <span className="font-medium text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">View Metrics</span>
                                    <span className="text-xs text-muted-foreground group-hover:text-emerald-600/80 dark:group-hover:text-emerald-400/80">Analyze performance and analytics</span>
                                </div>
                            </DropdownMenuItem>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Users</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file to import multiple users at once.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="file">CSV File</Label>
                            <Input
                                id="file"
                                type="file"
                                accept=".csv"
                                className="cursor-pointer"
                            />
                        </div>
                        <div className="text-sm text-muted-foreground">
                            <p>CSV format should include: email, tier, role</p>
                            <p>Example: user@example.com,pro,USER</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImportOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleImportUsers}>
                            Import Users
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
