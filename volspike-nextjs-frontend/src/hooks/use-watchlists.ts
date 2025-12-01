'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Types
export interface Watchlist {
  id: string
  name: string
  userId: string
  createdAt: string
  items: WatchlistItem[]
}

export interface WatchlistItem {
  id: string
  watchlistId: string
  contract: {
    symbol: string
    isActive: boolean
  }
}

export interface WatchlistLimits {
  tier: string
  limits: {
    watchlistLimit: number
    symbolLimit: number
  }
  usage: {
    watchlistCount: number
    symbolCount: number
  }
  canCreateWatchlist: boolean
  canAddSymbol: boolean
  remainingWatchlists: number
  remainingSymbols: number
}

interface WatchlistsResponse {
  watchlists: Watchlist[]
  limits: WatchlistLimits
}

/**
 * Hook for managing user watchlists
 * Provides watchlist CRUD operations with React Query caching
 */
export function useWatchlists() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  // Get auth token for API requests
  // Backend accepts simple user ID as token (not JWT)
  const getAuthToken = () => {
    if (!session?.user?.id) {
      return ''
    }
    // Use user ID directly as token (backend accepts simple user IDs)
    return String(session.user.id)
  }

  // Fetch watchlists with limit status
  const {
    data: watchlistsData,
    isLoading,
    error,
  } = useQuery<WatchlistsResponse>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch watchlists')
      }

      return response.json()
    },
    enabled: !!session?.user,
    staleTime: 30000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })


  // Create watchlist mutation
  const createWatchlist = useMutation({
    mutationFn: async (name: string) => {
      try {
        const token = getAuthToken()
        const response = await fetch(`${API_URL}/api/watchlist`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ name }),
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            // If response is not JSON, use status text
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          // Extract error message from various possible formats
          const errorMessage = errorData.message || errorData.error || `Failed to create watchlist (${response.status})`
          
          // Include validation details if available
          if (errorData.details && Array.isArray(errorData.details)) {
            const validationErrors = errorData.details.map((d: any) => d.message).join(', ')
            throw new Error(`${errorMessage}: ${validationErrors}`)
          }
          
          throw new Error(errorMessage)
        }

        return response.json()
      } catch (error) {
        // Re-throw with better error message
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to create watchlist: Unknown error')
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch watchlists
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      queryClient.invalidateQueries({ queryKey: ['watchlist-limits'] })
      // Only show success toast if not adding a symbol (to avoid double toasts)
      // The addSymbol mutation will show its own success toast
      const isAddingSymbol = (context as any)?.isAddingSymbol
      if (!isAddingSymbol) {
        toast.success(`Watchlist "${data.watchlist.name}" created`)
      }
      // Return data so it can be accessed in component
      return data
    },
    onError: (error: Error) => {
      console.error('Create watchlist error:', error)
      toast.error(error.message || 'Failed to create watchlist')
    },
  })

  // Update watchlist name mutation
  const updateWatchlist = useMutation({
    mutationFn: async ({ watchlistId, name }: { watchlistId: string; name: string }) => {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/watchlist/${watchlistId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || 'Failed to update watchlist')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      toast.success('Watchlist updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update watchlist')
    },
  })

  // Delete watchlist mutation
  const deleteWatchlist = useMutation({
    mutationFn: async (watchlistId: string) => {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/watchlist/${watchlistId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete watchlist')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      toast.success('Watchlist deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete watchlist')
    },
  })

  // Add symbol to watchlist mutation
  const addSymbol = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/watchlist/${watchlistId}/symbols`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ symbol }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || 'Failed to add symbol')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      // Also invalidate market data if filtered by watchlist
      queryClient.invalidateQueries({ queryKey: ['watchlist-market-data'] })
      toast.success(`Added ${variables.symbol} to watchlist`)
    },
    onError: (error: Error) => {
      // Don't show error toast for duplicate symbols (already handled in component)
      if (!error.message?.includes('already in this watchlist') && 
          !error.message?.includes('Duplicate')) {
        toast.error(error.message || 'Failed to add symbol')
      }
    },
  })

  // Remove symbol from watchlist mutation
  const removeSymbol = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      const token = getAuthToken()
      const response = await fetch(
        `${API_URL}/api/watchlist/${watchlistId}/symbols/${symbol}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove symbol')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      queryClient.invalidateQueries({ queryKey: ['watchlist-info', variables.watchlistId] })
      queryClient.invalidateQueries({ queryKey: ['watchlist-market-data'] })
      toast.success(`Removed ${variables.symbol} from watchlist`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove symbol')
    },
  })

  return {
    watchlists: watchlistsData?.watchlists || [],
    limits: watchlistsData?.limits,
    isLoading,
    error,
    createWatchlist: createWatchlist.mutate,
    createWatchlistAsync: createWatchlist.mutateAsync,
    updateWatchlist: updateWatchlist.mutate,
    deleteWatchlist: deleteWatchlist.mutate,
    addSymbol: addSymbol.mutate,
    addSymbolAsync: addSymbol.mutateAsync,
    removeSymbol: removeSymbol.mutate,
    isCreating: createWatchlist.isPending,
    isUpdating: updateWatchlist.isPending,
    isDeleting: deleteWatchlist.isPending,
    isAddingSymbol: addSymbol.isPending,
    isRemovingSymbol: removeSymbol.isPending,
  }
}

/**
 * Hook for fetching watchlist limit status
 * Can be used independently for limit checks
 */
export function useWatchlistLimits() {
  const { data: session } = useSession()

  // Get auth token for API requests
  // Backend accepts simple user ID as token (not JWT)
  const getAuthToken = () => {
    if (!session?.user?.id) {
      return ''
    }
    // Use user ID directly as token (backend accepts simple user IDs)
    return String(session.user.id)
  }

  const { data: limits, isLoading, error } = useQuery<WatchlistLimits>({
    queryKey: ['watchlist-limits'],
    queryFn: async () => {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/watchlist/limits`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch limit status')
      }

      return response.json()
    },
    enabled: !!session?.user,
    staleTime: 60000, // 1 minute
  })

  return {
    limits,
    isLoading,
    error,
  }
}

