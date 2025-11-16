'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { CreateUserRequest } from '@/types/admin'
import { UserPlus, Mail, Shield, Sparkles, ArrowLeft, Copy, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function CreateUserForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    // FIX: Single atomic state instead of two separate states to avoid React batching race condition
    const [passwordAlert, setPasswordAlert] = useState<{
        password: string
        email: string
    } | null>(null)
    const [formData, setFormData] = useState<CreateUserRequest>({
        email: '',
        tier: 'free',
        role: 'USER',
        sendInvite: false, // CRITICAL FIX: Default to false to show password by default
    })

    // FIX: Track state changes for debugging
    useEffect(() => {
        if (passwordAlert) {
            console.log('✅ [CreateUser] passwordAlert state updated:', {
                email: passwordAlert.email,
                hasPassword: passwordAlert.password.length > 0,
                passwordLength: passwordAlert.password.length,
                timestamp: new Date().toISOString(),
            })
        }
    }, [passwordAlert])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        
        // Reset previous password display
        setPasswordAlert(null)

        try {
            console.log('📤 [CreateUser] Submitting form data:', {
                email: formData.email,
                tier: formData.tier,
                role: formData.role,
                sendInvite: formData.sendInvite,
                sendInviteType: typeof formData.sendInvite,
                fullFormData: formData,
            })

            const result = await adminAPI.createUser(formData)

            console.log('📥 [CreateUser] API Response received:', {
                hasUser: !!result.user,
                hasTemporaryPassword: !!result.temporaryPassword,
                temporaryPasswordValue: result.temporaryPassword,
                temporaryPasswordType: typeof result.temporaryPassword,
                temporaryPasswordLength: result.temporaryPassword?.length,
                fullResult: result,
            })

            console.log('🔑 [CreateUser] Temporary Password check:', {
                'result.temporaryPassword': result.temporaryPassword,
                'typeof result.temporaryPassword': typeof result.temporaryPassword,
                'result.temporaryPassword?.length': result.temporaryPassword?.length,
                'Boolean(result.temporaryPassword)': Boolean(result.temporaryPassword),
                "'temporaryPassword' in result": 'temporaryPassword' in result,
            })

            // FIX: Only reset form AFTER password is handled
            if (result.temporaryPassword && result.temporaryPassword.length > 0) {
                // Password exists - show it first, DON'T reset form yet
                // FIX: Single atomic state update to avoid React batching race condition
                console.log('✅ [CreateUser] Password found - setting atomic state', {
                    passwordLength: result.temporaryPassword.length,
                    email: result.user?.email || formData.email,
                })
                setPasswordAlert({
                    password: result.temporaryPassword,
                    email: result.user?.email || formData.email,
                })
                console.log('✅ [CreateUser] Password alert state set - Alert should render in next render cycle')
                toast.success('User created successfully! Please copy the temporary password.', {
                    duration: 5000,
                })
                // Form will reset when user dismisses password or creates another user
            } else {
                console.warn('⚠️ [CreateUser] No temporary password in response', {
                    sendInvite: formData.sendInvite,
                    hasTemporaryPassword: !!result.temporaryPassword,
                    temporaryPasswordValue: result.temporaryPassword,
                    resultKeys: Object.keys(result),
                })
                // Email was sent - safe to reset form
                
                if (formData.sendInvite) {
                    toast.success('User created successfully! Invitation email sent.', {
                        duration: 3000,
                    })
                    // Reset form and redirect after email sent
                    setFormData({
                        email: '',
                        tier: 'free',
                        role: 'USER',
                        sendInvite: false, // Reset to false for next user
                    })
                    setTimeout(() => {
                        router.push('/admin/users')
                    }, 2000)
                } else {
                    // This shouldn't happen, but handle it gracefully
                    toast.error('User created but password was not returned. Please check backend logs.', {
                        duration: 5000,
                    })
                }
            }
        } catch (error: any) {
            let errorMessage = 'Failed to create user'
            
            if (error?.message) {
                errorMessage = error.message
            } else if (error?.error) {
                errorMessage = error.error
                if (error?.details && Array.isArray(error.details)) {
                    const details = error.details.map((d: any) => `${d.path}: ${d.message}`).join(', ')
                    errorMessage += ` (${details})`
                }
            }
            
            toast.error(errorMessage, {
                duration: 5000,
            })
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        router.push('/admin/users')
    }

    const [copied, setCopied] = useState(false)
    const handleCopyPassword = () => {
        if (passwordAlert?.password) {
            navigator.clipboard.writeText(passwordAlert.password)
            setCopied(true)
            toast.success('Password copied to clipboard!')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleDismissPassword = () => {
        // Clear password display and reset form for next user
        setPasswordAlert(null)
        setFormData({
            email: '',
            tier: 'free',
            role: 'USER',
            sendInvite: false, // Keep false for next user
        })
    }

    const handleContinue = () => {
        handleDismissPassword()
        router.push('/admin/users')
    }

    const getTierIcon = (tier: string) => {
        switch (tier) {
            case 'elite':
                return <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            case 'pro':
                return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            default:
                return <UserPlus className="h-4 w-4 text-muted-foreground" />
        }
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'elite':
                return 'border-purple-500/30 bg-purple-500/5'
            case 'pro':
                return 'border-blue-500/30 bg-blue-500/5'
            default:
                return 'border-border/60 bg-card/30'
        }
    }

    return (
        <div className="max-w-3xl">
            <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
                            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">User Information</CardTitle>
                            <CardDescription className="mt-1">
                                Enter the details for the new user account
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Password Display - ABOVE form so it's always visible */}
                    {/* FIX: Removed IIFE pattern - simplified conditional rendering */}
                    {passwordAlert && (
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Alert className="border-green-500 bg-green-500/20 shadow-lg shadow-green-500/20 ring-2 ring-green-500/30">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 space-y-4">
                                        <AlertTitle className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                            <span className="text-2xl">✅</span>
                                            User Created Successfully!
                                        </AlertTitle>
                                        <AlertDescription className="space-y-4">
                                            <div className="bg-background/80 p-3 rounded-lg border border-green-500/30">
                                                <p className="text-sm font-semibold mb-2 text-foreground">Email Address:</p>
                                                <code className="text-base font-mono bg-background px-3 py-2 rounded border-2 border-green-500/50 text-green-600 dark:text-green-400 block">
                                                    {passwordAlert.email}
                                                </code>
                                            </div>
                                            <div className="bg-background/80 p-3 rounded-lg border-2 border-green-500/50">
                                                <p className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                                                    <span className="text-yellow-500">🔑</span>
                                                    Temporary Password:
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <code className="flex-1 text-lg font-mono font-bold bg-background px-4 py-3 rounded border-2 border-green-500 text-green-600 dark:text-green-400 break-all">
                                                        {passwordAlert.password}
                                                    </code>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="lg"
                                                        onClick={handleCopyPassword}
                                                        className="shrink-0 h-12 px-4 border-green-500/50 hover:bg-green-500/10"
                                                    >
                                                        {copied ? (
                                                            <>
                                                                <Check className="h-5 w-5 text-green-500 mr-2" />
                                                                Copied!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="h-5 w-5 mr-2" />
                                                                Copy
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                                                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                                    <span className="text-lg">⚠️</span>
                                                    Save this password now - you won&apos;t be able to see it again!
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleDismissPassword}
                                                    className="text-sm"
                                                >
                                                    Dismiss & Create Another User
                                                </Button>
                                            </div>
                                        </AlertDescription>
                                    </div>
                                </div>
                            </Alert>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                Email Address
                                <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="user@example.com"
                                required
                                className="h-11 border-border/60 bg-background/50 focus:border-brand-500/50 focus:ring-brand-500/20"
                            />
                            <p className="text-xs text-muted-foreground">
                                This will be used as the login email address
                            </p>
                        </div>

                        {/* Tier and Role Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="tier" className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    Subscription Tier
                                </Label>
                                <Select
                                    value={formData.tier}
                                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, tier: value }))}
                                >
                                    <SelectTrigger className={`h-11 border-border/60 bg-background/50 ${getTierColor(formData.tier)}`}>
                                        <div className="flex items-center gap-2">
                                            {getTierIcon(formData.tier)}
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">
                                            <div className="flex items-center gap-2">
                                                <UserPlus className="h-4 w-4" />
                                                Free
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="pro">
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-blue-600" />
                                                Pro
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="elite">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-purple-600" />
                                                Elite
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Determines feature access level
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-sm font-medium flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    User Role
                                </Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, role: value }))}
                                >
                                    <SelectTrigger className="h-11 border-border/60 bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USER">User</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Controls system permissions
                                </p>
                            </div>
                        </div>

                        {/* Invitation Options */}
                        <div className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-4">
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="sendInvite"
                                    checked={formData.sendInvite}
                                    onCheckedChange={(checked) => {
                                        const newValue = Boolean(checked) // Ensure boolean type
                                        console.log('✅ [CreateUser] Checkbox changed:', {
                                            checked,
                                            checkedType: typeof checked,
                                            newValue,
                                            newValueType: typeof newValue,
                                        })
                                        setFormData(prev => {
                                            const updated = { ...prev, sendInvite: newValue }
                                            console.log('✅ [CreateUser] Form data updated:', {
                                                ...updated,
                                                sendInvite: updated.sendInvite,
                                                sendInviteType: typeof updated.sendInvite,
                                            })
                                            return updated
                                        })
                                    }}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <Label htmlFor="sendInvite" className="text-sm font-medium cursor-pointer">
                                        Send invitation email
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formData.sendInvite ? (
                                            <span className="flex items-center gap-1.5">
                                                <span className="text-green-500">✓</span>
                                                <span>User will receive an email with account setup instructions. Password will NOT be shown.</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                <span className="text-orange-500 font-semibold">✗</span>
                                                <span className="font-medium text-orange-600 dark:text-orange-400">Temporary password will be displayed below after creation.</span>
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {!formData.sendInvite && (
                                <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                                    <Label htmlFor="temporaryPassword" className="text-sm font-medium">
                                        Temporary Password
                                    </Label>
                                    <Input
                                        id="temporaryPassword"
                                        type="password"
                                        value={formData.temporaryPassword || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                                        placeholder="Leave empty to generate automatically"
                                        minLength={12}
                                        className="h-11 border-border/60 bg-background/50"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Minimum 12 characters. Leave empty to generate automatically.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/60">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={handleCancel}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Users
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handleCancel}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                {passwordAlert ? (
                                    <Button 
                                        type="button"
                                        onClick={handleContinue}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                                    >
                                        Continue to Users
                                    </Button>
                                ) : (
                                    <Button 
                                        type="submit" 
                                        disabled={loading || !formData.email}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Creating...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <UserPlus className="h-4 w-4" />
                                                Create User
                                            </span>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
