'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useMemo, useCallback } from 'react'

export interface UserAlert {
    id: string
    symbol: string
    alertType: 'PRICE_CROSS' | 'FUNDING_CROSS' | 'OI_CROSS'
    threshold: number
    isActive: boolean
    deliveryMethod: 'DASHBOARD' | 'EMAIL' | 'BOTH'
    triggeredAt: string | null
    triggeredValue: number | null
    createdAt: string
}

export function useUserAlerts() {
    const { data: session } = useSession()
    const queryClient = useQueryClient()

    // Fetch all user alerts
    const { data: alertsData, isLoading, error } = useQuery({
        queryKey: ['user-cross-alerts'],
        queryFn: async () => {
            if (!session?.user?.id) throw new Error('Not authenticated')

            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session.user.id

            const response = await fetch(`${API_URL}/api/user-alerts`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) throw new Error('Failed to fetch alerts')

            return response.json()
        },
        enabled: !!session?.user?.id,
        staleTime: 30000, // 30 seconds
    })

    const alerts: UserAlert[] = alertsData?.alerts || []
    const activeAlerts = alerts.filter(a => a.isActive)
    const inactiveAlerts = alerts.filter(a => !a.isActive)

    // Create a set of symbols with active alerts for quick lookup
    const symbolsWithActiveAlerts = useMemo(() => {
        return new Set(activeAlerts.map(a => a.symbol.toUpperCase()))
    }, [activeAlerts])

    // Check if a symbol has an active alert
    const hasActiveAlert = useCallback((symbol: string) => {
        return symbolsWithActiveAlerts.has(symbol.toUpperCase())
    }, [symbolsWithActiveAlerts])

    // Get alerts for a specific symbol
    const getAlertsForSymbol = useCallback((symbol: string) => {
        return alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
    }, [alerts])

    // Get active alerts for a specific symbol
    const getActiveAlertsForSymbol = useCallback((symbol: string) => {
        return activeAlerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
    }, [activeAlerts])

    // Delete alert mutation
    const deleteMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts/${alertId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
        },
    })

    // Reactivate alert mutation
    const reactivateMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts/${alertId}/reactivate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to reactivate alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
        },
    })

    // Update alert mutation
    const updateMutation = useMutation({
        mutationFn: async ({ alertId, data }: { alertId: string; data: { threshold?: number; deliveryMethod?: string } }) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts/${alertId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
        },
    })

    // Create alert mutation
    const createMutation = useMutation({
        mutationFn: async (data: { symbol: string; alertType: string; threshold: number; deliveryMethod: string }) => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const token = session?.user?.id

            const response = await fetch(`${API_URL}/api/user-alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create alert')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })
        },
    })

    return {
        alerts,
        activeAlerts,
        inactiveAlerts,
        isLoading,
        error,
        hasActiveAlert,
        getAlertsForSymbol,
        getActiveAlertsForSymbol,
        symbolsWithActiveAlerts,
        deleteAlert: deleteMutation.mutate,
        deleteAlertAsync: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
        reactivateAlert: reactivateMutation.mutate,
        reactivateAlertAsync: reactivateMutation.mutateAsync,
        isReactivating: reactivateMutation.isPending,
        updateAlert: updateMutation.mutate,
        updateAlertAsync: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        createAlert: createMutation.mutate,
        createAlertAsync: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
    }
}
