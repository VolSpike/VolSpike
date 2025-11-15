'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { AdminSettings } from '@/types/admin'
import { Settings, Mail, MapPin, Clock, FileText, Gauge } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface SettingsFormProps {
    settings: AdminSettings
}

export function SettingsForm({ settings }: SettingsFormProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        adminEmailWhitelist: settings.adminEmailWhitelist.join('\n'),
        adminIPWhitelist: settings.adminIPWhitelist.join('\n'),
        adminSessionDuration: settings.adminSessionDuration,
        auditLogRetentionDays: settings.auditLogRetentionDays,
        rateLimitConfig: settings.rateLimitConfig,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const updatedSettings = {
                adminEmailWhitelist: formData.adminEmailWhitelist.split('\n').filter(email => email.trim()),
                adminIPWhitelist: formData.adminIPWhitelist.split('\n').filter(ip => ip.trim()),
                adminSessionDuration: formData.adminSessionDuration,
                auditLogRetentionDays: formData.auditLogRetentionDays,
                rateLimitConfig: formData.rateLimitConfig,
            }

            await adminAPI.updateAdminSettings(updatedSettings)
            toast.success('Settings updated successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to update settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
                        <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">General Settings</CardTitle>
                        <CardDescription className="mt-1">
                            Configure system-wide settings and access controls
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Whitelist */}
                    <div className="space-y-2">
                        <Label htmlFor="emailWhitelist" className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Admin Email Whitelist
                        </Label>
                        <Textarea
                            id="emailWhitelist"
                            value={formData.adminEmailWhitelist}
                            onChange={(e) => setFormData(prev => ({ ...prev, adminEmailWhitelist: e.target.value }))}
                            placeholder="admin@example.com&#10;support@example.com"
                            rows={4}
                            className="min-h-[100px] border-border/60 bg-background/50 font-mono text-sm resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Only these email addresses can access the admin panel. Enter one per line.
                        </p>
                    </div>

                    {/* IP Whitelist */}
                    <div className="space-y-2">
                        <Label htmlFor="ipWhitelist" className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Admin IP Whitelist
                        </Label>
                        <Textarea
                            id="ipWhitelist"
                            value={formData.adminIPWhitelist}
                            onChange={(e) => setFormData(prev => ({ ...prev, adminIPWhitelist: e.target.value }))}
                            placeholder="192.168.1.1&#10;10.0.0.0/8"
                            rows={4}
                            className="min-h-[100px] border-border/60 bg-background/50 font-mono text-sm resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Only these IP addresses can access the admin panel. Leave empty to allow all IPs.
                        </p>
                    </div>

                    {/* Session Duration */}
                    <div className="space-y-2">
                        <Label htmlFor="sessionDuration" className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Admin Session Duration (minutes)
                        </Label>
                        <Input
                            id="sessionDuration"
                            type="number"
                            value={formData.adminSessionDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, adminSessionDuration: parseInt(e.target.value) }))}
                            min="5"
                            max="1440"
                            className="h-11 border-border/60 bg-background/50"
                        />
                        <p className="text-xs text-muted-foreground">
                            How long admin sessions should last before requiring re-authentication (5-1440 minutes)
                        </p>
                    </div>

                    {/* Audit Log Retention */}
                    <div className="space-y-2">
                        <Label htmlFor="auditRetention" className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Audit Log Retention (days)
                        </Label>
                        <Input
                            id="auditRetention"
                            type="number"
                            value={formData.auditLogRetentionDays}
                            onChange={(e) => setFormData(prev => ({ ...prev, auditLogRetentionDays: parseInt(e.target.value) }))}
                            min="30"
                            max="365"
                            className="h-11 border-border/60 bg-background/50"
                        />
                        <p className="text-xs text-muted-foreground">
                            How long to keep audit logs before automatic deletion (30-365 days)
                        </p>
                    </div>

                    {/* Rate Limiting */}
                    <div className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">Rate Limiting Configuration</Label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="loginWindow" className="text-xs">Login Window (ms)</Label>
                                <Input
                                    id="loginWindow"
                                    type="number"
                                    value={formData.rateLimitConfig.login.windowMs}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        rateLimitConfig: {
                                            ...prev.rateLimitConfig,
                                            login: {
                                                ...prev.rateLimitConfig.login,
                                                windowMs: parseInt(e.target.value)
                                            }
                                        }
                                    }))}
                                    className="h-10 border-border/60 bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loginMax" className="text-xs">Login Max Requests</Label>
                                <Input
                                    id="loginMax"
                                    type="number"
                                    value={formData.rateLimitConfig.login.maxRequests}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        rateLimitConfig: {
                                            ...prev.rateLimitConfig,
                                            login: {
                                                ...prev.rateLimitConfig.login,
                                                maxRequests: parseInt(e.target.value)
                                            }
                                        }
                                    }))}
                                    className="h-10 border-border/60 bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apiWindow" className="text-xs">API Window (ms)</Label>
                                <Input
                                    id="apiWindow"
                                    type="number"
                                    value={formData.rateLimitConfig.api.windowMs}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        rateLimitConfig: {
                                            ...prev.rateLimitConfig,
                                            api: {
                                                ...prev.rateLimitConfig.api,
                                                windowMs: parseInt(e.target.value)
                                            }
                                        }
                                    }))}
                                    className="h-10 border-border/60 bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apiMax" className="text-xs">API Max Requests</Label>
                                <Input
                                    id="apiMax"
                                    type="number"
                                    value={formData.rateLimitConfig.api.maxRequests}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        rateLimitConfig: {
                                            ...prev.rateLimitConfig,
                                            api: {
                                                ...prev.rateLimitConfig.api,
                                                maxRequests: parseInt(e.target.value)
                                            }
                                        }
                                    }))}
                                    className="h-10 border-border/60 bg-background/50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/60">
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Saving...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Save Settings
                                </span>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
