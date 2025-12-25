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
    /**
     * Add a new triggered alert to the store.
     * Automatically deduplicates and trims old alerts.
     */
    addAlert: (alert: Omit<TriggeredAlert, 'read'>) => void
    /**
     * Mark a single alert as read by ID.
     */
    markAsRead: (id: string) => void
    /**
     * Mark all alerts as read.
     */
    markAllAsRead: () => void
    /**
     * Remove an alert from the list by ID.
     */
    dismissAlert: (id: string) => void
    /**
     * Clear all alerts.
     */
    clearAll: () => void
    /**
     * Get count of unread alerts.
     */
    unreadCount: () => number
}

const MAX_ALERTS = 50
const MAX_READ_ALERTS = 20

/**
 * Zustand store for managing triggered user alerts.
 * Persists to localStorage and handles deduplication/trimming.
 */
export const useTriggeredAlerts = create<TriggeredAlertsState>()(
    persist(
        (set, get) => ({
            alerts: [],

            addAlert: (alert) => {
                set((state) => {
                    // Validate required fields
                    if (!alert.id || !alert.symbol) {
                        console.warn('Invalid alert: missing id or symbol', alert)
                        return state
                    }

                    // Prevent duplicates
                    if (state.alerts.some((a) => a.id === alert.id)) {
                        return state
                    }

                    const newAlert: TriggeredAlert = { ...alert, read: false }
                    const allAlerts = [newAlert, ...state.alerts]

                    // Trim if exceeds limits
                    if (allAlerts.length > MAX_ALERTS) {
                        const unread = allAlerts.filter((a) => !a.read)
                        const read = allAlerts.filter((a) => a.read)
                        const trimmed = [...unread, ...read.slice(0, MAX_READ_ALERTS)]
                        return { alerts: trimmed.slice(0, MAX_ALERTS) }
                    }

                    return { alerts: allAlerts }
                })
            },

            markAsRead: (id) => {
                if (!id?.trim()) return
                set((state) => ({
                    alerts: state.alerts.map((a) =>
                        a.id === id ? { ...a, read: true } : a
                    )
                }))
            },

            markAllAsRead: () => {
                set((state) => ({
                    alerts: state.alerts.map((a) => ({ ...a, read: true }))
                }))
            },

            dismissAlert: (id) => {
                if (!id?.trim()) return
                set((state) => {
                    const newAlerts = state.alerts.filter((a) => a.id !== id)
                    if (newAlerts.length === state.alerts.length) {
                        return state
                    }
                    return { alerts: newAlerts }
                })
            },

            clearAll: () => set({ alerts: [] }),

            unreadCount: () => {
                const state = get()
                return state.alerts.filter((a) => !a.read).length
            },
        }),
        {
            name: 'volspike-triggered-alerts',
        }
    )
)
