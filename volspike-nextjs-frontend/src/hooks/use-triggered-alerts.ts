'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TriggeredAlert {
    id: string
    symbol: string
    alertType: string
    alertTypeName: string
    thresholdFormatted: string
    currentValueFormatted: string
    direction: string
    timestamp: string
    read: boolean
}

interface TriggeredAlertsState {
    alerts: TriggeredAlert[]
    addAlert: (alert: Omit<TriggeredAlert, 'read'>) => void
    markAsRead: (id: string) => void
    markAllAsRead: () => void
    clearAll: () => void
    unreadCount: () => number
}

export const useTriggeredAlerts = create<TriggeredAlertsState>()(
    persist(
        (set, get) => ({
            alerts: [],
            addAlert: (alert) => set((state) => ({
                alerts: [{ ...alert, read: false }, ...state.alerts].slice(0, 50) // Keep last 50
            })),
            markAsRead: (id) => set((state) => ({
                alerts: state.alerts.map((a) => a.id === id ? { ...a, read: true } : a)
            })),
            markAllAsRead: () => set((state) => ({
                alerts: state.alerts.map((a) => ({ ...a, read: true }))
            })),
            clearAll: () => set({ alerts: [] }),
            unreadCount: () => get().alerts.filter((a) => !a.read).length,
        }),
        {
            name: 'volspike-triggered-alerts',
        }
    )
)
