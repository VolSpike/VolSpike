'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, FileSpreadsheet, FileJson, Lock } from 'lucide-react'
import { 
  generateTradingViewWatchlist, 
  generateCSV, 
  generateJSON,
  downloadFile,
  generateFilename 
} from '@/lib/watchlist-export'
import toast from 'react-hot-toast'

interface MarketData {
  symbol: string
  price: number
  volume24h: number
  change24h?: number
  fundingRate: number
  openInterest: number
  timestamp: number
}

interface WatchlistExportButtonProps {
  data: MarketData[]
  userTier: 'free' | 'pro' | 'elite'
}

export function WatchlistExportButton({ data, userTier }: WatchlistExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportTradingView = () => {
    setIsExporting(true)
    try {
      const limit = userTier === 'free' ? 50 : undefined
      const content = generateTradingViewWatchlist(data, limit)
      const filename = generateFilename('volspike_tradingview_watchlist', 'txt')
      downloadFile(content, filename, 'text/plain')
      
      const symbolCount = limit || data.length
      toast.success(`✅ ${symbolCount} symbols exported to TradingView format`)
    } catch (error) {
      toast.error('Failed to generate watchlist file')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportCSV = () => {
    if (userTier === 'free') {
      toast.error('CSV export is available for Pro and Elite tiers')
      return
    }

    setIsExporting(true)
    try {
      const content = generateCSV(data)
      const filename = generateFilename('volspike_market_data', 'csv')
      downloadFile(content, filename, 'text/csv')
      
      toast.success(`✅ ${data.length} symbols exported to CSV`)
    } catch (error) {
      toast.error('Failed to generate CSV file')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJSON = () => {
    if (userTier === 'free') {
      toast.error('JSON export is available for Pro and Elite tiers')
      return
    }

    setIsExporting(true)
    try {
      const content = generateJSON(data)
      const filename = generateFilename('volspike_market_data', 'json')
      downloadFile(content, filename, 'application/json')
      
      toast.success(`✅ ${data.length} symbols exported to JSON`)
    } catch (error) {
      toast.error('Failed to generate JSON file')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isExporting || data.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Watchlist</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* TradingView Export - Available to all tiers */}
        <DropdownMenuItem onClick={handleExportTradingView} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">TradingView (.txt)</div>
            <div className="text-xs text-muted-foreground">
              {userTier === 'free' ? 'Top 50 symbols' : 'All symbols'}
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* CSV Export - Pro/Elite only */}
        <DropdownMenuItem 
          onClick={handleExportCSV}
          className={userTier === 'free' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">CSV (.csv)</div>
            <div className="text-xs text-muted-foreground">
              Full data export
            </div>
          </div>
          {userTier === 'free' && (
            <Lock className="h-3 w-3 ml-2 text-muted-foreground" />
          )}
        </DropdownMenuItem>

        {/* JSON Export - Pro/Elite only */}
        <DropdownMenuItem 
          onClick={handleExportJSON}
          className={userTier === 'free' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        >
          <FileJson className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">JSON (.json)</div>
            <div className="text-xs text-muted-foreground">
              API-ready format
            </div>
          </div>
          {userTier === 'free' && (
            <Lock className="h-3 w-3 ml-2 text-muted-foreground" />
          )}
        </DropdownMenuItem>

        {userTier === 'free' && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Upgrade to Pro for CSV/JSON exports
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

