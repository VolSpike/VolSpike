'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Shield,
    Eye,
    EyeOff,
    Lock
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { useSession } from 'next-auth/react'

export function SecuritySettings() {
    const { data: session } = useSession()
    const [loading, setLoading] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })

    useEffect(() => {
        if (session?.accessToken) {
            adminAPI.setAccessToken(session.accessToken as string)
        }
    }, [session?.accessToken])

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading('password')

        try {
            if (passwordData.newPassword !== passwordData.confirmPassword) {
                toast.error('New passwords do not match')
                return
            }

            await adminAPI.changePassword(passwordData)
            toast.success('Password changed successfully')
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            })
        } catch (error: any) {
            toast.error(error.message || 'Failed to change password')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Password Change */}
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
                            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Change Password</CardTitle>
                            <CardDescription className="mt-1">
                                Update your admin account password
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword" className="text-sm font-medium flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                Current Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    required
                                    className="h-11 border-border/60 bg-background/50 pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                minLength={12}
                                required
                                className="h-11 border-border/60 bg-background/50"
                            />
                            <p className="text-xs text-muted-foreground">
                                Minimum 12 characters with mixed case, numbers, and symbols
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                                className="h-11 border-border/60 bg-background/50"
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                type="submit" 
                                disabled={loading === 'password'}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                            >
                                {loading === 'password' ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Changing...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Lock className="h-4 w-4" />
                                        Change Password
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
