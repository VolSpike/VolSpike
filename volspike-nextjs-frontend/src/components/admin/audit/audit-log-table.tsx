'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    MoreHorizontal,
    Eye,
    Download,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    User,
    CreditCard,
    Settings,
    Shield,
    FileText,
    Copy
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { AuditLogEntry } from '@/types/admin'
import { adminAPI } from '@/lib/admin/api-client'
import { AuditLogDetailsDialog } from './audit-log-details-dialog'

interface AuditLogTableProps {
    logs: AuditLogEntry[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
    currentQuery: any
}

const actionIcons = {
    USER_CREATED: User,
    USER_UPDATED: User,
    USER_DELETED: User,
    USER_SUSPENDED: User,
    USER_ACTIVATED: User,
    USER_BANNED: User,
    SUBSCRIPTION_CREATED: CreditCard,
    SUBSCRIPTION_UPDATED: CreditCard,
    SUBSCRIPTION_CANCELLED: CreditCard,
    SUBSCRIPTION_REFUNDED: CreditCard,
    MANUAL_PAYMENT_CREATE: CreditCard,
    SETTINGS_UPDATED: Settings,
    SECURITY_EVENT: Shield,
    ADMIN_LOGIN: Shield,
    ADMIN_LOGOUT: Shield,
    BULK_ACTION_EXECUTED: Settings,
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

export function AuditLogTable({ logs, pagination, currentQuery }: AuditLogTableProps) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
    const [detailsLoading, setDetailsLoading] = useState(false)

    const handleSort = (field: string) => {
        const newSortOrder = currentQuery.sortBy === field && currentQuery.sortOrder === 'asc' ? 'desc' : 'asc'
        const params = new URLSearchParams()
        
        // Add existing query params
        if (currentQuery.actorUserId) params.set('actorUserId', String(currentQuery.actorUserId))
        if (currentQuery.action) params.set('action', String(currentQuery.action))
        if (currentQuery.targetType) params.set('targetType', String(currentQuery.targetType))
        if (currentQuery.targetId) params.set('targetId', String(currentQuery.targetId))
        if (currentQuery.startDate) params.set('startDate', currentQuery.startDate instanceof Date ? currentQuery.startDate.toISOString() : String(currentQuery.startDate))
        if (currentQuery.endDate) params.set('endDate', currentQuery.endDate instanceof Date ? currentQuery.endDate.toISOString() : String(currentQuery.endDate))
        if (currentQuery.page) params.set('page', String(currentQuery.page))
        if (currentQuery.limit) params.set('limit', String(currentQuery.limit))
        
        // Set sort params
        params.set('sortBy', field)
        params.set('sortOrder', newSortOrder)
        
        router.push(`/admin/audit?${params.toString()}`)
    }

    const getSortIcon = (field: string) => {
        if (currentQuery.sortBy !== field) {
            return <ChevronsUpDown className="h-4 w-4" />
        }
        return currentQuery.sortOrder === 'asc' ?
            <ChevronUp className="h-4 w-4" /> :
            <ChevronDown className="h-4 w-4" />
    }

    const handleViewDetails = async (logId: string) => {
        setLoading(logId)
        setDetailsLoading(true)
        try {
            const log = await adminAPI.getAuditLogById(logId)
            setSelectedLog(log as AuditLogEntry)
            setDetailsDialogOpen(true)
        } catch (error: any) {
            toast.error(error.message || 'Failed to load log details')
            console.error('Error loading audit log details:', error)
        } finally {
            setLoading(null)
            setDetailsLoading(false)
        }
    }

    const handleExport = async () => {
        try {
            const csvData = await adminAPI.exportAuditLogs(currentQuery, 'csv')

            // Create and download file
            const blob = new Blob([csvData], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            toast.success('Audit logs exported successfully')
        } catch (error) {
            toast.error('Export failed')
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button onClick={handleExport} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm relative">
                <div className="overflow-x-auto overflow-y-visible">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('createdAt')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Date</span>
                                    {getSortIcon('createdAt')}
                                </div>
                            </TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-64">
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground mb-1">No audit logs found</h3>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            {currentQuery.action || currentQuery.targetType || currentQuery.actorUserId
                                                ? 'Try adjusting your filters to see more results'
                                                : 'Audit logs will appear here as administrative actions are performed'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const Icon = actionIcons[log.action as keyof typeof actionIcons] || User
                                const colorClass = actionColors[log.action as keyof typeof actionColors] || 'bg-gray-100 text-gray-800'

                                return (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <div className={`p-1 rounded ${colorClass}`}>
                                                <Icon className="h-3 w-3" />
                                            </div>
                                            <span className="text-sm font-medium">{log.action}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{log.actor.email}</span>
                                            <span className="text-xs text-muted-foreground">{log.actor.role}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">{log.targetType}</span>
                                            {log.targetId && (
                                                <span className="text-xs text-muted-foreground">
                                                    ID: {log.targetId}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">
                                                {format(new Date(log.createdAt), 'MMM d, yyyy')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(log.createdAt), 'HH:mm:ss')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {log.metadata?.ip ? (
                                                <span className="text-sm font-mono text-foreground">
                                                    {typeof log.metadata.ip === 'string' 
                                                        ? log.metadata.ip.split(',')[0].trim() 
                                                        : log.metadata.ip}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Not captured</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right relative">
                                        <div className="flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={loading === log.id}
                                                        className="h-8 w-8"
                                                    >
                                                        {loading === log.id ? (
                                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                                        ) : (
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent 
                                                    align="end" 
                                                    side="bottom"
                                                    usePortal={true}
                                                    className="min-w-[180px]"
                                                >
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleViewDetails(log.id)}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => {
                                                        navigator.clipboard.writeText(log.id)
                                                        toast.success('Log ID copied to clipboard')
                                                    }}>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        Copy Log ID
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() => {
                                const params = new URLSearchParams()
                                
                                // Add existing query params
                                if (currentQuery.actorUserId) params.set('actorUserId', String(currentQuery.actorUserId))
                                if (currentQuery.action) params.set('action', String(currentQuery.action))
                                if (currentQuery.targetType) params.set('targetType', String(currentQuery.targetType))
                                if (currentQuery.targetId) params.set('targetId', String(currentQuery.targetId))
                                if (currentQuery.startDate) params.set('startDate', currentQuery.startDate instanceof Date ? currentQuery.startDate.toISOString() : String(currentQuery.startDate))
                                if (currentQuery.endDate) params.set('endDate', currentQuery.endDate instanceof Date ? currentQuery.endDate.toISOString() : String(currentQuery.endDate))
                                if (currentQuery.limit) params.set('limit', String(currentQuery.limit))
                                if (currentQuery.sortBy) params.set('sortBy', String(currentQuery.sortBy))
                                if (currentQuery.sortOrder) params.set('sortOrder', String(currentQuery.sortOrder))
                                
                                // Set page
                                params.set('page', String(pagination.page - 1))
                                
                                router.push(`/admin/audit?${params.toString()}`)
                            }}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= pagination.pages}
                            onClick={() => {
                                const params = new URLSearchParams()
                                
                                // Add existing query params
                                if (currentQuery.actorUserId) params.set('actorUserId', String(currentQuery.actorUserId))
                                if (currentQuery.action) params.set('action', String(currentQuery.action))
                                if (currentQuery.targetType) params.set('targetType', String(currentQuery.targetType))
                                if (currentQuery.targetId) params.set('targetId', String(currentQuery.targetId))
                                if (currentQuery.startDate) params.set('startDate', currentQuery.startDate instanceof Date ? currentQuery.startDate.toISOString() : String(currentQuery.startDate))
                                if (currentQuery.endDate) params.set('endDate', currentQuery.endDate instanceof Date ? currentQuery.endDate.toISOString() : String(currentQuery.endDate))
                                if (currentQuery.limit) params.set('limit', String(currentQuery.limit))
                                if (currentQuery.sortBy) params.set('sortBy', String(currentQuery.sortBy))
                                if (currentQuery.sortOrder) params.set('sortOrder', String(currentQuery.sortOrder))
                                
                                // Set page
                                params.set('page', String(pagination.page + 1))
                                
                                router.push(`/admin/audit?${params.toString()}`)
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Audit Log Details Dialog */}
            <AuditLogDetailsDialog
                open={detailsDialogOpen}
                onOpenChange={setDetailsDialogOpen}
                log={selectedLog}
                loading={detailsLoading}
            />
        </div>
    )
}
