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
import { MoreHorizontal, UserPlus, FileDown, FileUp } from 'lucide-react'
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
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={handleExportUsers}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Export Users
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setImportOpen(true)}>
                            <FileUp className="h-4 w-4 mr-2" />
                            Import Users
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>System</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push('/admin/audit')}>
                            View Audit Logs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/admin/metrics')}>
                            View Metrics
                        </DropdownMenuItem>
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
