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
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Plus,
    Download,
    Upload,
    MoreHorizontal,
    UserPlus,
    FileDown,
    FileUp
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'

export function UserActions() {
    const router = useRouter()
    const [createUserOpen, setCreateUserOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [createUserData, setCreateUserData] = useState({
        email: '',
        tier: 'free' as const,
        role: 'USER' as const,
        sendInvite: true,
    })

    const handleCreateUser = async () => {
        try {
            await adminAPI.createUser(createUserData)
            toast.success('User created successfully')
            setCreateUserOpen(false)
            setCreateUserData({
                email: '',
                tier: 'free',
                role: 'USER',
                sendInvite: true,
            })
            router.refresh()
        } catch (error) {
            toast.error('Failed to create user')
        }
    }

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
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all">
                            <UserPlus className="h-4 w-4" />
                            <span>Create User</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New User</DialogTitle>
                            <DialogDescription>
                                Create a new user account and send them an invitation email.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={createUserData.email}
                                    onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="tier">Tier</Label>
                                    <select
                                        id="tier"
                                        value={createUserData.tier}
                                        onChange={(e) => setCreateUserData(prev => ({ ...prev, tier: e.target.value as any }))}
                                        className="w-full p-2 border rounded-md"
                                    >
                                        <option value="free">Free</option>
                                        <option value="pro">Pro</option>
                                        <option value="elite">Elite</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="role">Role</Label>
                                    <select
                                        id="role"
                                        value={createUserData.role}
                                        onChange={(e) => setCreateUserData(prev => ({ ...prev, role: e.target.value as any }))}
                                        className="w-full p-2 border rounded-md"
                                    >
                                        <option value="USER">User</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="sendInvite"
                                    checked={createUserData.sendInvite}
                                    onChange={(e) => setCreateUserData(prev => ({ ...prev, sendInvite: e.target.checked }))}
                                />
                                <Label htmlFor="sendInvite">Send invitation email</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateUser} disabled={!createUserData.email}>
                                Create User
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center space-x-2">
                            <MoreHorizontal className="h-4 w-4" />
                            <span>More Actions</span>
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
            </div>

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
