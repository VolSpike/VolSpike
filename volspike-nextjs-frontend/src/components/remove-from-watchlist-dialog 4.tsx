'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useWatchlists } from '@/hooks/use-watchlists'
import toast from 'react-hot-toast'

interface RemoveFromWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  watchlists: Array<{ id: string; name: string }>
  onRemoved?: () => void
}

export function RemoveFromWatchlistDialog({
  open,
  onOpenChange,
  symbol,
  watchlists,
  onRemoved,
}: RemoveFromWatchlistDialogProps) {
  const { removeSymbol, isRemovingSymbol } = useWatchlists()
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<Set<string>>(new Set())

  // Initialize with all watchlists selected when dialog opens
  useEffect(() => {
    if (open && watchlists.length > 0) {
      setSelectedWatchlistIds(new Set(watchlists.map(w => w.id)))
    } else if (!open) {
      // Reset when dialog closes
      setSelectedWatchlistIds(new Set())
    }
  }, [open, watchlists])

  const handleToggleWatchlist = (watchlistId: string) => {
    const newSelected = new Set(selectedWatchlistIds)
    if (newSelected.has(watchlistId)) {
      newSelected.delete(watchlistId)
    } else {
      newSelected.add(watchlistId)
    }
    setSelectedWatchlistIds(newSelected)
  }

  const handleRemove = async () => {
    if (selectedWatchlistIds.size === 0) {
      toast.error('Please select at least one watchlist')
      return
    }

    try {
      // Remove from all selected watchlists
      const removePromises = Array.from(selectedWatchlistIds).map(watchlistId =>
        removeSymbol({ watchlistId, symbol })
      )
      
      await Promise.all(removePromises)
      
      toast.success(`Removed ${symbol} from ${selectedWatchlistIds.size} watchlist${selectedWatchlistIds.size > 1 ? 's' : ''}`)
      onOpenChange(false)
      setSelectedWatchlistIds(new Set())
      if (onRemoved) {
        onRemoved()
      }
    } catch (error) {
      // Error already handled by hook
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    setSelectedWatchlistIds(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove {symbol} from Watchlist</DialogTitle>
          <DialogDescription>
            This symbol is in multiple watchlists. Select which watchlist(s) to remove it from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {watchlists.map((watchlist) => (
            <div key={watchlist.id} className="flex items-center space-x-2">
              <Checkbox
                id={`watchlist-${watchlist.id}`}
                checked={selectedWatchlistIds.has(watchlist.id)}
                onCheckedChange={() => handleToggleWatchlist(watchlist.id)}
              />
              <Label
                htmlFor={`watchlist-${watchlist.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
              >
                {watchlist.name}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleRemove}
            disabled={selectedWatchlistIds.size === 0 || isRemovingSymbol}
            variant="destructive"
          >
            {isRemovingSymbol
              ? 'Removing...'
              : `Remove from ${selectedWatchlistIds.size} watchlist${selectedWatchlistIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

