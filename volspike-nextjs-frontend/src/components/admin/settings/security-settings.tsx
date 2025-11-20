'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Shield,
    Eye,
    EyeOff,
    RefreshCw,
    Trash2,
    Clock,
    MapPin,
    Monitor,
    Lock
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { formatDistanceToNow } from 'date-fns'
import { useSession } from 'next-auth/react'

export function SecuritySettings() {
    const { data: session } = useSession()
    const [loading, setLoading] = useState<string | null>(null)
    const [sessions, setSessions] = useState<any[]>([])
    const [showPassword, setShowPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })

    useEffect(() => {
        if (session?.accessToken) {
            adminAPI.setAccessToken(session.accessToken as string)
            loadSessions()
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

    const handleRevokeSession = async (sessionId: string) => {
        setLoading(sessionId)
        try {
            await adminAPI.revokeSession(sessionId)
            toast.success('Session revoked')
            setSessions(sessions.filter(s => s.id !== sessionId))
        } catch (error: any) {
            toast.error('Failed to revoke session')
        } finally {
            setLoading(null)
        }
    }

    const loadSessions = async () => {
        setLoading('sessions')
        try {
            if (!session?.accessToken) {
                toast.error('No session token available')
                setLoading(null)
                return
            }
            adminAPI.setAccessToken(session.accessToken as string)
            const data = await adminAPI.getActiveSessions()
            setSessions(data.sessions)
        } catch (error: any) {
            toast.error('Failed to load sessions')
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

            {/* Active Sessions */}
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
                                <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Active Sessions</CardTitle>
                                <CardDescription className="mt-1">
                                    Manage your active admin sessions
                                </CardDescription>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadSessions}
                            disabled={loading === 'sessions'}
                            className="border-border/60"
                        >
                            {loading === 'sessions' ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                <Monitor className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">No active sessions</h3>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Click refresh to load current sessions
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div 
                                    key={session.id} 
                                    className="group flex items-center justify-between p-4 rounded-lg border border-border/60 bg-card/30 hover:bg-card/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground">{session.ipAddress}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs border-border/60">
                                            {session.userAgent?.includes('Mobile') ? 'Mobile' : 'Desktop'}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeSession(session.id)}
                                        disabled={loading === session.id}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    >
                                        {loading === session.id ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
