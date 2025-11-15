'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Key,
    Shield,
    ShieldCheck,
    ShieldX,
    Copy,
    Download,
    RefreshCw
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import type { TwoFactorSetup } from '@/types/admin'

interface TwoFactorSettingsProps {
    user: {
        twoFactorEnabled: boolean
    }
}

export function TwoFactorSettings({ user }: TwoFactorSettingsProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null)
    const [verificationCode, setVerificationCode] = useState('')
    const [backupCode, setBackupCode] = useState('')

    const handleSetup2FA = async () => {
        setLoading('setup')
        try {
            const data = await adminAPI.setup2FA('') // Password would be required in real implementation
            setSetupData(data)
            toast.success('2FA setup initiated')
        } catch (error: any) {
            toast.error(error.message || 'Failed to setup 2FA')
        } finally {
            setLoading(null)
        }
    }

    const handleVerify2FA = async () => {
        setLoading('verify')
        try {
            await adminAPI.verify2FA({
                code: verificationCode,
                backupCode: backupCode || undefined,
            })
            toast.success('2FA enabled successfully')
            setSetupData(null)
            setVerificationCode('')
            setBackupCode('')
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify 2FA')
        } finally {
            setLoading(null)
        }
    }

    const handleDisable2FA = async () => {
        setLoading('disable')
        try {
            await adminAPI.disable2FA()
            toast.success('2FA disabled successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to disable 2FA')
        } finally {
            setLoading(null)
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
    }

    const downloadBackupCodes = () => {
        if (!setupData) return

        const content = `VolSpike Admin 2FA Backup Codes\n\n${setupData.backupCodes.join('\n')}\n\nKeep these codes safe! Each can only be used once.`
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'volspike-2fa-backup-codes.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
                        <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
                            <Badge 
                                variant={user.twoFactorEnabled ? 'default' : 'secondary'}
                                className={user.twoFactorEnabled ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' : ''}
                            >
                                {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                        </div>
                        <CardDescription className="mt-1">
                            Add an extra layer of security to your admin account
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {!user.twoFactorEnabled ? (
                    <div className="space-y-6">
                        {!setupData ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                    <Shield className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Enable Two-Factor Authentication</h3>
                                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                                    Add an extra layer of security to your admin account with time-based one-time passwords
                                </p>
                                <Button 
                                    onClick={handleSetup2FA} 
                                    disabled={loading === 'setup'}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                                >
                                    {loading === 'setup' ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Setting up...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            Enable 2FA
                                        </span>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* QR Code */}
                                <div className="text-center space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Use your authenticator app (Google Authenticator, Authy, etc.)
                                        </p>
                                    </div>
                                    <div className="inline-block p-4 bg-white dark:bg-gray-900 border-2 border-border/60 rounded-xl shadow-lg">
                                        <img
                                            src={setupData.qrCode}
                                            alt="2FA QR Code"
                                            className="w-48 h-48"
                                        />
                                    </div>
                                </div>

                                {/* Secret Key */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Secret Key</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={setupData.secret}
                                            readOnly
                                            className="font-mono text-sm h-11 border-border/60 bg-background/50"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => copyToClipboard(setupData.secret, 'Secret key')}
                                            className="border-border/60"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Enter this key manually if you can&apos;t scan the QR code
                                    </p>
                                </div>

                                {/* Backup Codes */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Backup Codes</Label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={downloadBackupCodes}
                                            className="border-border/60"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            Download
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 p-4 rounded-lg border border-border/60 bg-card/30">
                                        {setupData.backupCodes.map((code, index) => (
                                            <div key={index} className="group flex items-center justify-between p-2 rounded hover:bg-card/50 transition-colors">
                                                <span className="font-mono text-sm text-foreground">{code}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => copyToClipboard(code, 'Backup code')}
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Save these codes in a safe place. Each can only be used once.
                                    </p>
                                </div>

                                {/* Verification */}
                                <div className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-4">
                                    <h3 className="text-lg font-semibold">Verify Setup</h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="verificationCode" className="text-sm font-medium">Enter 6-digit code from your app</Label>
                                        <Input
                                            id="verificationCode"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            placeholder="123456"
                                            maxLength={6}
                                            className="h-11 border-border/60 bg-background/50 text-center text-lg tracking-widest font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="backupCode" className="text-sm font-medium">Or enter a backup code</Label>
                                        <Input
                                            id="backupCode"
                                            value={backupCode}
                                            onChange={(e) => setBackupCode(e.target.value)}
                                            placeholder="Backup code"
                                            className="h-11 border-border/60 bg-background/50 font-mono"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleVerify2FA}
                                        disabled={loading === 'verify' || (!verificationCode && !backupCode)}
                                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                                    >
                                        {loading === 'verify' ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Verifying...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4" />
                                                Verify and Enable
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-4">
                            <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication Enabled</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md">
                            Your account is protected with 2FA. You&apos;ll need to enter a code from your authenticator app when signing in.
                        </p>
                        <Button
                            variant="destructive"
                            onClick={handleDisable2FA}
                            disabled={loading === 'disable'}
                            className="border-red-500/30"
                        >
                            {loading === 'disable' ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Disabling...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <ShieldX className="h-4 w-4" />
                                    Disable 2FA
                                </span>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
