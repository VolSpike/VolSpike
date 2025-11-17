'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CheckCircle2, AlertCircle, XCircle, Activity } from 'lucide-react'
import { adminAPI } from '@/lib/admin/api-client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'checking' | 'unknown'

export function SystemStatusIndicator() {
    const router = useRouter()
    const { data: session } = useSession()
    const [status, setStatus] = useState<HealthStatus>('checking')
    const [lastCheck, setLastCheck] = useState<Date | null>(null)

    useEffect(() => {
        // Set access token
        const token = (session as any)?.accessToken as string | undefined
        if (token) {
            adminAPI.setAccessToken(token)
        }
    }, [session])

    useEffect(() => {
        const checkHealth = async () => {
            try {
                // Get accessToken from session (could be in session.accessToken or session.user.id)
                const token = ((session as any)?.accessToken || session?.user?.id) as string | undefined
                if (!token) {
                    setStatus('unknown')
                    return
                }

                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                const response = await fetch(`${API_BASE_URL}/api/admin/metrics/health`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                })

                if (!response.ok) {
                    setStatus('unhealthy')
                    setLastCheck(new Date())
                    return
                }

                const data = await response.json()
                
                // Determine overall status
                if (data.databaseStatus?.status === 'healthy') {
                    setStatus('healthy')
                } else {
                    setStatus('degraded')
                }
                
                setLastCheck(new Date())
            } catch (error) {
                console.error('[SystemStatus] Health check failed:', error)
                setStatus('unhealthy')
                setLastCheck(new Date())
            }
        }

        // Initial check
        checkHealth()

        // Check every 30 seconds
        const interval = setInterval(checkHealth, 30000)

        return () => clearInterval(interval)
    }, [session])

    const getStatusConfig = () => {
        switch (status) {
            case 'healthy':
                return {
                    icon: CheckCircle2,
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500/20',
                    dotColor: 'bg-emerald-500',
                    label: 'System Healthy',
                    description: 'All systems operational',
                }
            case 'degraded':
                return {
                    icon: AlertCircle,
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-500/20',
                    dotColor: 'bg-amber-500',
                    label: 'System Degraded',
                    description: 'Some services may be experiencing issues',
                }
            case 'unhealthy':
                return {
                    icon: XCircle,
                    color: 'text-red-500',
                    bgColor: 'bg-red-500/20',
                    dotColor: 'bg-red-500',
                    label: 'System Unhealthy',
                    description: 'Critical services are down',
                }
            case 'checking':
                return {
                    icon: Activity,
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-500/20',
                    dotColor: 'bg-blue-500',
                    label: 'Checking...',
                    description: 'Verifying system status',
                    animate: true,
                }
            default:
                return {
                    icon: Activity,
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted',
                    dotColor: 'bg-muted-foreground',
                    label: 'Unknown',
                    description: 'Unable to determine status',
                }
        }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    const formatLastCheck = () => {
        if (!lastCheck) return 'Never'
        const seconds = Math.floor((Date.now() - lastCheck.getTime()) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        return `${hours}h ago`
    }

    return (
        <div className="hidden lg:block border-t border-border/60 px-4 py-3">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => router.push('/admin/metrics')}
                            className="w-full flex items-center justify-between group hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${config.animate ? 'animate-pulse' : ''}`} />
                                <span className="text-[10px] font-mono text-muted-foreground/70 group-hover:text-foreground transition-colors">
                                    {config.label}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/50">
                                v1.0
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                                <p className="text-xs font-semibold">{config.label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                            {lastCheck && (
                                <p className="text-xs text-muted-foreground/80 mt-1">
                                    Last checked: {formatLastCheck()}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground/60 mt-1.5 pt-1 border-t border-border/40">
                                Click to view detailed metrics
                            </p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

