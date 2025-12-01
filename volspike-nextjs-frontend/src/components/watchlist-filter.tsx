'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWatchlists } from '@/hooks/use-watchlists'
import { List, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WatchlistFilterProps {
  selectedWatchlistId: string | null
  onWatchlistChange: (watchlistId: string | null) => void
  className?: string
}

export function WatchlistFilter({ selectedWatchlistId, onWatchlistChange, className }: WatchlistFilterProps) {
  const { watchlists, isLoading, deleteWatchlistAsync } = useWatchlists()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [watchlistToDelete, setWatchlistToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Defensive check - ensure watchlists is always an array
  const safeWatchlists = Array.isArray(watchlists) ? watchlists : []

  const selectedWatchlist = safeWatchlists.find((w) => w.id === selectedWatchlistId)
  
  // Ensure Select always receives a string value (never null or undefined)
  const selectValue = selectedWatchlistId ?? 'all'

  const handleDeleteClick = (e: React.MouseEvent, watchlist: { id: string; name: string }) => {
    e.stopPropagation() // Prevent selecting the watchlist when clicking delete
    setWatchlistToDelete(watchlist)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!watchlistToDelete) return

    setIsDeleting(true)
    try {
      await deleteWatchlistAsync(watchlistToDelete.id)
      
      // If the deleted watchlist was selected, switch to "All Symbols"
      if (selectedWatchlistId === watchlistToDelete.id) {
        onWatchlistChange(null)
      }
      
      setDeleteDialogOpen(false)
      setWatchlistToDelete(null)
    } catch (error) {
      // Error is handled by the mutation's onError callback
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Select disabled value="all">
          <SelectTrigger className="w-full md:w-[200px] min-w-0">
            <SelectValue placeholder="Loading watchlists..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <Select value={selectValue} onValueChange={(value) => onWatchlistChange(value === 'all' ? null : value)}>
          <SelectTrigger className="w-full md:w-[200px] min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <List className="h-4 w-4 shrink-0" />
              <SelectValue placeholder="All Symbols" className="min-w-0">
                {selectedWatchlistId ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{selectedWatchlist?.name || 'Watchlist'}</span>
                    {selectedWatchlist && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {selectedWatchlist.items.length}
                      </Badge>
                    )}
                  </span>
                ) : (
                  'All Symbols'
                )}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Symbols</SelectItem>
            {safeWatchlists.length === 0 ? (
              <SelectItem value="empty" disabled>
                No watchlists yet
              </SelectItem>
            ) : (
              safeWatchlists.map((watchlist) => (
                <SelectItem key={watchlist.id} value={watchlist.id}>
                  <div className="flex items-center justify-between w-full gap-2 group">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate">{watchlist.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {watchlist.items.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, { id: watchlist.id, name: watchlist.name })}
                      title={`Delete "${watchlist.name}"`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedWatchlistId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => onWatchlistChange(null)}
            title="Clear filter"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Watchlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>&ldquo;{watchlistToDelete?.name}&rdquo;</strong>? This will remove all {watchlistToDelete && safeWatchlists.find(w => w.id === watchlistToDelete.id)?.items.length || 0} symbols from this watchlist. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setWatchlistToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Watchlist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

