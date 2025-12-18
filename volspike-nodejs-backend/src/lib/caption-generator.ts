import type { VolumeAlert, OpenInterestAlert } from '@prisma/client'

/**
 * Format volume value to human-readable string
 * @example formatVolume(17240000) => "17.24M"
 * @example formatVolume(500000) => "500K"
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(0)}K`
  }
  return volume.toFixed(0)
}

/**
 * Format percentage value with + or - sign
 * @example formatPercent(9.96) => "+9.96%"
 * @example formatPercent(-3.45) => "-3.45%"
 */
export function formatPercent(pct: number): string {
  return pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
}

/**
 * Generate Twitter caption for a Volume Alert
 * @example
 * generateVolumeAlertCaption({
 *   symbol: "ACT",
 *   volumeRatio: 6.55,
 *   currentVolume: 17240000,
 *   previousVolume: 2630000,
 *   priceChange: 9.96
 * })
 * => "🚨 ACT volume spike: 6.55x in 1 hour! $17.24M this hour vs $2.63M last hour. Price: +9.96% #crypto #altcoin #volspike"
 */
export function generateVolumeAlertCaption(alert: VolumeAlert): string {
  const emoji = '🚨'
  const symbol = alert.symbol
  const ratio = alert.volumeRatio.toFixed(2)
  const currentVol = formatVolume(alert.currentVolume)
  const prevVol = formatVolume(alert.previousVolume)
  const priceChange = alert.priceChange !== null && alert.priceChange !== undefined
    ? formatPercent(alert.priceChange)
    : 'N/A'

  const caption = `${emoji} ${symbol} volume spike: ${ratio}x in 1 hour! $${currentVol} this hour vs $${prevVol} last hour. Price: ${priceChange} #crypto #altcoin #volspike`

  // Ensure caption is within Twitter's 280 character limit
  if (caption.length > 280) {
    // Truncate and add ellipsis if needed (rare case)
    return caption.substring(0, 277) + '...'
  }

  return caption
}

/**
 * Generate Twitter caption for an Open Interest Alert
 * @example
 * generateOIAlertCaption({
 *   symbol: "USTC",
 *   direction: "increase",
 *   pctChange: "3.94",
 *   current: "651920000",
 *   absChange: "24690000",
 *   priceChange: "5.47",
 *   timeframe: "5 min"
 * })
 * => "🚨 USTC Open Interest spike: +3.94% in 5 min! Current OI: $651.92M (up $24.69M). Price: +5.47% #crypto #openinterest #volspike"
 */
export function generateOIAlertCaption(alert: OpenInterestAlert): string {
  const isIncrease = alert.direction === 'increase'
  const emoji = '🚨'
  const directionWord = isIncrease ? 'up' : 'down'

  const symbol = alert.symbol
  const pctChange = formatPercent(Number(alert.pctChange))
  const timeframe = alert.timeframe
  const currentOI = formatVolume(Number(alert.current))
  const absChange = formatVolume(Number(alert.absChange))
  const priceChange = alert.priceChange !== null && alert.priceChange !== undefined
    ? formatPercent(Number(alert.priceChange))
    : 'N/A'

  const caption = `${emoji} ${symbol} Open Interest spike: ${pctChange} in ${timeframe}! Current OI: $${currentOI} (${directionWord} $${absChange}). Price: ${priceChange} #crypto #openinterest #volspike`

  // Ensure caption is within Twitter's 280 character limit
  if (caption.length > 280) {
    return caption.substring(0, 277) + '...'
  }

  return caption
}
