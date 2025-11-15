'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    User,
    Shield,
    Calendar,
    MapPin,
    Monitor,
    FileText,
    Code,
    Clock,
    Activity,
    Copy,
    CheckCircle2,
    XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { AuditLogEntry } from '@/types/admin'

interface AuditLogDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    log: AuditLogEntry | null
    loading?: boolean
}

const actionIcons = {
    USER_CREATED: User,
    USER_UPDATED: User,
    USER_DELETED: User,
    USER_SUSPENDED: User,
    USER_ACTIVATED: User,
    USER_BANNED: User,
    SUBSCRIPTION_CREATED: FileText,
    SUBSCRIPTION_UPDATED: FileText,
    SUBSCRIPTION_CANCELLED: FileText,
    SUBSCRIPTION_REFUNDED: FileText,
    MANUAL_PAYMENT_CREATE: FileText,
    SETTINGS_UPDATED: Shield,
    SECURITY_EVENT: Shield,
    ADMIN_LOGIN: Shield,
    ADMIN_LOGOUT: Shield,
    BULK_ACTION_EXECUTED: Activity,
}

const actionColors = {
    USER_CREATED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    USER_UPDATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    USER_DELETED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    USER_SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    USER_ACTIVATED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    USER_BANNED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    SUBSCRIPTION_CREATED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    SUBSCRIPTION_UPDATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    SUBSCRIPTION_CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    SUBSCRIPTION_REFUNDED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    MANUAL_PAYMENT_CREATE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    SETTINGS_UPDATED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    SECURITY_EVENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    ADMIN_LOGIN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    ADMIN_LOGOUT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    BULK_ACTION_EXECUTED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
}

export function AuditLogDetailsDialog({
    open,
    onOpenChange,
    log,
    loading = false,
}: AuditLogDetailsDialogProps) {
    if (!log) return null

    const Icon = actionIcons[log.action as keyof typeof actionIcons] || FileText
    const colorClass = actionColors[log.action as keyof typeof actionColors] || 'bg-gray-100 text-gray-800'

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
    }

    const formatJSON = (obj: any): string => {
        if (!obj) return 'N/A'
        try {
            return JSON.stringify(obj, null, 2)
        } catch {
            return String(obj)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Audit Log Details
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Complete information about this administrative action
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
                    <div className="space-y-6 pb-4">
                        {/* Action Information */}
                        <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                Action Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Action Type</label>
                                    <div className="flex items-center gap-2">
                                        <Badge className={colorClass}>
                                            {log.action}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Target Type</label>
                                    <div className="text-sm font-medium">{log.targetType || 'N/A'}</div>
                                </div>
                                {log.targetId && (
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">Target ID</label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 rounded-md bg-muted/50 text-sm font-mono break-all">
                                                {log.targetId}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(log.targetId!, 'Target ID')}
                                                className="p-2 rounded-md hover:bg-muted transition-colors"
                                            >
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actor Information */}
                        <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                Actor Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{log.actor.email}</span>
                                        <button
                                            onClick={() => copyToClipboard(log.actor.email, 'Email')}
                                            className="p-1 rounded-md hover:bg-muted transition-colors"
                                        >
                                            <Copy className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground block mb-2">Role</label>
                                    <div className="mt-0.5">
                                        <Badge variant="outline">{log.actor.role}</Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Actor ID</label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 px-3 py-2 rounded-md bg-muted/50 text-sm font-mono break-all">
                                            {log.actor.id}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(log.actor.id, 'Actor ID')}
                                            className="p-2 rounded-md hover:bg-muted transition-colors"
                                        >
                                            <Copy className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timestamp & Metadata */}
                        <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                Timestamp & Metadata
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        Date & Time
                                    </label>
                                    <div className="text-sm">
                                        <div className="font-medium">
                                            {format(new Date(log.createdAt), 'PPpp')}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {format(new Date(log.createdAt), 'EEEE, MMMM d, yyyy')}
                                        </div>
                                    </div>
                                </div>
                                {log.metadata?.ip && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                            <MapPin className="h-3 w-3" />
                                            IP Address
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 rounded-md bg-muted/50 text-sm font-mono">
                                                {typeof log.metadata.ip === 'string' 
                                                    ? log.metadata.ip.split(',')[0].trim() 
                                                    : log.metadata.ip}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(
                                                    typeof log.metadata?.ip === 'string' 
                                                        ? log.metadata.ip.split(',')[0].trim() 
                                                        : String(log.metadata?.ip || ''),
                                                    'IP Address'
                                                )}
                                                className="p-2 rounded-md hover:bg-muted transition-colors"
                                            >
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {log.metadata?.userAgent && (
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                            <Monitor className="h-3 w-3" />
                                            User Agent
                                        </label>
                                        <code className="block px-3 py-2 rounded-md bg-muted/50 text-xs font-mono break-all">
                                            {log.metadata.userAgent}
                                        </code>
                                    </div>
                                )}
                                {log.metadata?.method && log.metadata?.path && (
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                            <Activity className="h-3 w-3" />
                                            Request
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono">
                                                {log.metadata.method}
                                            </Badge>
                                            <code className="flex-1 px-3 py-2 rounded-md bg-muted/50 text-xs font-mono break-all">
                                                {log.metadata.path}
                                            </code>
                                        </div>
                                    </div>
                                )}
                                {log.metadata?.duration !== undefined && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Duration</label>
                                        <div className="text-sm font-medium">
                                            {log.metadata.duration}ms
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Changes (Old vs New Values) */}
                        {(log.oldValues || log.newValues) && (
                            <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Code className="h-4 w-4 text-muted-foreground" />
                                    Changes
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {log.oldValues && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                                <XCircle className="h-3 w-3 text-red-500" />
                                                Old Values
                                            </label>
                                            <ScrollArea className="h-48 rounded-md border border-border/60 bg-muted/30 p-3">
                                                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                                                    {formatJSON(log.oldValues)}
                                                </pre>
                                            </ScrollArea>
                                        </div>
                                    )}
                                    {log.newValues && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                New Values
                                            </label>
                                            <div className="h-48 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-3">
                                                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                                                    {formatJSON(log.newValues)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Log ID */}
                        <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Log ID</label>
                                    <code className="block mt-1 text-xs font-mono text-foreground break-all">
                                        {log.id}
                                    </code>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(log.id, 'Log ID')}
                                    className="p-2 rounded-md hover:bg-muted transition-colors"
                                >
                                    <Copy className="h-4 w-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

