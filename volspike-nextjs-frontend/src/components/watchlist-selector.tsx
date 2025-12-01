'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWatchlists } from '@/hooks/use-watchlists'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Trash2, Edit2, Check, X, Plus, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface WatchlistSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol?: string // Optional symbol to add to selected watchlist
  onWatchlistSelected?: (watchlistId: string) => void
}

export function WatchlistSelector({ open, onOpenChange, symbol, onWatchlistSelected }: WatchlistSelectorProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const {
    watchlists,
    limits,
    createWatchlist,
    createWatchlistAsync,
    updateWatchlist,
    deleteWatchlist,
    addSymbol,
    addSymbolAsync,
    isCreating,
    isUpdating,
    isDeleting,
    isAddingSymbol,
  } = useWatchlists()

  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // Prevent duplicate calls

  // Get user tier
  const userTier = (session?.user as any)?.tier || 'free'
  const isFreeTier = userTier === 'free'
  const hasMaxWatchlists = limits?.limits.watchlistLimit === 1 && watchlists.length >= 1

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim() || isProcessing) {
      if (!newWatchlistName.trim()) {
        toast.error('Please enter a watchlist name')
      }
      return
    }

    const watchlistName = newWatchlistName.trim()
    const symbolToAdd = symbol // Store symbol before clearing state
    setNewWatchlistName('')
    setShowCreateForm(false)
    setIsProcessing(true) // Prevent duplicate calls

    try {
      // Create watchlist and wait for it to complete using mutateAsync
      const result = await createWatchlistAsync(watchlistName)
      
      // If symbol provided, add it to the newly created watchlist
      if (symbolToAdd && result?.watchlist?.id) {
        try {
          // Use mutateAsync to properly await the result and prevent duplicate calls
          await addSymbolAsync({ watchlistId: result.watchlist.id, symbol: symbolToAdd })
          if (onWatchlistSelected) {
            onWatchlistSelected(result.watchlist.id)
          }
          onOpenChange(false)
        } catch (error: any) {
          // Check if it's a duplicate error - if so, don't show error toast (success already shown)
          if (error?.message?.includes('already in this watchlist') || error?.message?.includes('Duplicate')) {
            // Symbol was already added (maybe race condition), just close dialog
            if (onWatchlistSelected) {
              onWatchlistSelected(result.watchlist.id)
            }
            onOpenChange(false)
          } else {
            // Other error - let hook handle it
            console.error('Failed to add symbol:', error)
          }
        }
      } else if (!symbolToAdd) {
        // No symbol to add, just close the dialog
        onOpenChange(false)
      }
    } catch (error) {
      // Error already handled by hook's onError callback
      // Don't show additional error - the hook will show it
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartEdit = (watchlist: { id: string; name: string }) => {
    setEditingId(watchlist.id)
    setEditingName(watchlist.name)
  }

  const handleSaveEdit = async (watchlistId: string) => {
    if (!editingName.trim()) {
      toast.error('Watchlist name cannot be empty')
      return
    }

    try {
      await updateWatchlist({ watchlistId, name: editingName.trim() })
      setEditingId(null)
      setEditingName('')
    } catch (error) {
      // Error already handled by hook
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDeleteWatchlist = async (watchlistId: string) => {
    if (!confirm('Are you sure you want to delete this watchlist?')) {
      return
    }

    try {
      await deleteWatchlist(watchlistId)
    } catch (error) {
      // Error already handled by hook
    }
  }

  const handleSelectWatchlist = async (watchlistId: string) => {
    if (symbol) {
      // Prevent duplicate calls
      if (isAddingSymbol || isProcessing) {
        return
      }
      
      try {
        // Use mutateAsync to properly await the result
        await addSymbolAsync({ watchlistId, symbol })
        if (onWatchlistSelected) {
          onWatchlistSelected(watchlistId)
        }
        onOpenChange(false)
      } catch (error: any) {
        // Check if it's a duplicate error - suppress error toast if symbol was already added
        if (error?.message?.includes('already in this watchlist') || 
            error?.message?.includes('Duplicate') ||
            error?.message?.includes('already in this watchlist')) {
          // Symbol already in watchlist - just close dialog (might have been added by another call)
          if (onWatchlistSelected) {
            onWatchlistSelected(watchlistId)
          }
          onOpenChange(false)
        } else {
          // Other error - let hook handle it
          console.error('Failed to add symbol:', error)
        }
      }
    } else {
      if (onWatchlistSelected) {
        onWatchlistSelected(watchlistId)
      }
      onOpenChange(false)
    }
  }

  // Allow creating if limits haven't loaded yet (optimistic) or if under limit
  const canCreateMore = limits === undefined ? true : (limits?.canCreateWatchlist ?? false)
  const remainingWatchlists = limits?.remainingWatchlists ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {symbol ? `Add ${symbol} to Watchlist` : 'Manage Watchlists'}
          </DialogTitle>
          <DialogDescription>
            {symbol
              ? `Select a watchlist to add ${symbol} to, or create a new one.`
              : 'Create and manage your watchlists. Symbols can be added from the market table.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Watchlist List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {watchlists.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No watchlists yet. Create your first watchlist below.
              </div>
            ) : (
              watchlists.map((watchlist) => (
                <div
                  key={watchlist.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {editingId === watchlist.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(watchlist.id)
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSaveEdit(watchlist.id)}
                        disabled={isUpdating}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <div className="font-medium">{watchlist.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {watchlist.items.length} symbol{watchlist.items.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {symbol && (
                          <Button
                            size="sm"
                            onClick={() => handleSelectWatchlist(watchlist.id)}
                            disabled={isAddingSymbol}
                          >
                            Add {symbol}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleStartEdit(watchlist)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteWatchlist(watchlist.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Create New Watchlist Form */}
          {showCreateForm ? (
            <div className="space-y-2 p-3 border rounded-lg bg-accent/30">
              <Label htmlFor="new-watchlist-name">Watchlist Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-watchlist-name"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g., My Favorites"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateWatchlist()
                    } else if (e.key === 'Escape') {
                      setShowCreateForm(false)
                      setNewWatchlistName('')
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewWatchlistName('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!canCreateMore && (
                <p className="text-xs text-destructive">
                  {limits?.limits.watchlistLimit === 1
                    ? 'Free tier limit: Maximum 1 watchlist'
                    : `Limit reached: ${limits?.limits.watchlistLimit} watchlist${limits?.limits.watchlistLimit !== 1 ? 's' : ''} maximum`}
                </p>
              )}
            </div>
          ) : (
            <>
              {isFreeTier && hasMaxWatchlists ? (
                <div className="w-full p-4 border rounded-lg bg-muted/30 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Free tier users can only have 1 watchlist. Upgrade to Pro to create up to 3 watchlists.
                  </p>
                  <Button
                    className="w-full bg-sec-600 hover:bg-sec-700 text-white"
                    onClick={() => {
                      onOpenChange(false)
                      router.push('/pricing')
                    }}
                  >
                    Upgrade to Pro
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (canCreateMore) {
                      setShowCreateForm(true)
                    } else {
                      toast.error(limits?.limits.watchlistLimit === 1
                        ? 'Free tier limit: Maximum 1 watchlist'
                        : `Limit reached: ${limits?.limits.watchlistLimit} watchlist${limits?.limits.watchlistLimit !== 1 ? 's' : ''} maximum`)
                    }
                  }}
                  disabled={!canCreateMore}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Watchlist
                  {remainingWatchlists > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({remainingWatchlists} remaining)
                    </span>
                  )}
                </Button>
              )}
            </>
          )}

          {/* Limit Info */}
          {limits && (
            <div className="text-xs text-muted-foreground pt-4 border-t">
              <div className="flex justify-between">
                <span>Watchlists:</span>
                <span>
                  {limits.usage.watchlistCount} / {limits.limits.watchlistLimit}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Symbols:</span>
                <span>
                  {limits.usage.symbolCount} / {limits.limits.symbolLimit === Number.MAX_SAFE_INTEGER ? '∞' : limits.limits.symbolLimit}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {showCreateForm && (
            <Button onClick={handleCreateWatchlist} disabled={isCreating || !newWatchlistName.trim()}>
              {isCreating ? 'Creating...' : 'Create Watchlist'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

