'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWatchlists } from '@/hooks/use-watchlists'
import { List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface WatchlistFilterProps {
  selectedWatchlistId: string | null
  onWatchlistChange: (watchlistId: string | null) => void
  className?: string
}

export function WatchlistFilter({ selectedWatchlistId, onWatchlistChange, className }: WatchlistFilterProps) {
  const { watchlists, isLoading } = useWatchlists()

  const selectedWatchlist = watchlists.find((w) => w.id === selectedWatchlistId)

  if (isLoading) {
    return (
      <div className={className}>
        <Select disabled>
          <SelectTrigger className="w-full md:w-[200px] min-w-0">
            <SelectValue placeholder="Loading watchlists..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={selectedWatchlistId ?? 'all'} onValueChange={(value) => onWatchlistChange(value === 'all' ? null : value)}>
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
          {watchlists.length === 0 ? (
            <SelectItem value="empty" disabled>
              No watchlists yet
            </SelectItem>
          ) : (
            watchlists.map((watchlist) => (
              <SelectItem key={watchlist.id} value={watchlist.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{watchlist.name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {watchlist.items.length}
                  </Badge>
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
  )
}

