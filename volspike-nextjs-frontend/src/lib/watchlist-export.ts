/**
 * Watchlist Export Utilities
 * Generate TradingView, CSV, and JSON exports for market data
 */

interface MarketData {
  symbol: string
  price: number
  volume24h: number
  change24h?: number
  fundingRate: number
  openInterest: number
  timestamp: number
}

/**
 * Special symbol mapping for TradingView compatibility
 * TradingView doesn't support Chinese characters
 */
const SYMBOL_MAPPINGS: Record<string, string> = {
  '币安人生USDT': 'BIANRENSHENGUSDT',
  // Add more mappings here if needed
}

/**
 * Normalize symbol for TradingView export
 */
function normalizeSymbol(symbol: string): string {
  return SYMBOL_MAPPINGS[symbol] || symbol
}

/**
 * Generate TradingView watchlist (.txt format)
 * Format: BINANCE:SYMBOLUSDT.P (one per line)
 */
export function generateTradingViewWatchlist(
  data: MarketData[],
  limit?: number
): string {
  const symbols = limit ? data.slice(0, limit) : data
  
  const lines = symbols.map(item => {
    const normalizedSymbol = normalizeSymbol(item.symbol)
    return `BINANCE:${normalizedSymbol}.P`
  })
  
  return lines.join('\n')
}

/**
 * Generate CSV export with full market data
 */
export function generateCSV(data: MarketData[]): string {
  // CSV Header
  const headers = [
    'Symbol',
    'Price (USD)',
    '24h Change (%)',
    'Funding Rate (%)',
    '24h Volume (USD)',
    'Open Interest (USD)',
    'Timestamp',
  ]
  
  // CSV Rows
  const rows = data.map(item => [
    item.symbol.replace('USDT', ''), // Remove USDT suffix for cleaner display
    item.price.toFixed(item.price >= 1 ? 2 : 6),
    (item.change24h || 0).toFixed(2),
    (item.fundingRate * 100).toFixed(4),
    item.volume24h.toFixed(2),
    item.openInterest.toFixed(2),
    new Date(item.timestamp).toISOString(),
  ])
  
  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  return csvContent
}

/**
 * Generate JSON export with full market data
 */
export function generateJSON(data: MarketData[]): string {
  const exportData = {
    exported_at: new Date().toISOString(),
    symbol_count: data.length,
    data: data.map(item => ({
      symbol: item.symbol,
      asset: item.symbol.replace('USDT', ''),
      price: item.price,
      change_24h_percent: item.change24h || 0,
      funding_rate_percent: item.fundingRate * 100,
      volume_24h_usd: item.volume24h,
      open_interest_usd: item.openInterest,
      timestamp: new Date(item.timestamp).toISOString(),
    }))
  }
  
  return JSON.stringify(exportData, null, 2)
}

/**
 * Download file to user's device
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
  return `${prefix}_${dateStr}_${timeStr}.${extension}`
}

