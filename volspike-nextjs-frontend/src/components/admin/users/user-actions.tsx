'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export function UserActions() {
    const router = useRouter()
    const [importOpen, setImportOpen] = useState(false)

    const handleExportUsers = async () => {
        try {
            // This would implement actual export functionality
            toast.success('Export functionality coming soon')
        } catch (error) {
            toast.error('Export failed')
        }
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
                                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-150 focus:bg-blue-50 dark:focus:bg-blue-950/30 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                            >
                                <FileDown className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col flex-1">
                                    <span className="font-medium text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">Export Users</span>
                                    <span className="text-xs text-muted-foreground group-hover:text-blue-600/80 dark:group-hover:text-blue-400/80">Download user data as CSV</span>
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
