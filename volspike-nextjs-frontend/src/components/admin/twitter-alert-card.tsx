'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface TwitterAlertCardProps {
  alert: {
    id: string
    symbol?: string
    asset?: string
    direction?: string
    candleDirection?: string
    pctChange?: number
    volumeRatio?: number
    timeframe?: string
    alertType?: string
    isUpdate?: boolean
    current?: number
    baseline?: number
    currentVolume?: number
    previousVolume?: number
    priceChange?: number | null
    fundingRate?: number | null
    oiChange?: number | null // OI % change for Volume alerts
    ts?: string
    timestamp?: string
  }
  alertType: 'VOLUME' | 'OPEN_INTEREST'
}

// Fixed dimensions for Twitter (16:9 aspect ratio, Twitter optimal)
const CARD_WIDTH = 480
const CARD_HEIGHT = 270
const BADGE_HEIGHT = 28

export function TwitterAlertCard({ alert, alertType }: TwitterAlertCardProps) {
  const isOI = alertType === 'OPEN_INTEREST'

  // Determine direction
  const isUp = isOI
    ? alert.direction === 'UP'
    : alert.candleDirection === 'bullish'
  const isDown = isOI
    ? alert.direction === 'DOWN'
    : alert.candleDirection === 'bearish'

  // Get symbol/asset name
  const symbol = isOI
    ? (alert.symbol?.replace('USDT', '') || 'Unknown')
    : (alert.asset || 'Unknown')

  // Get timestamp
  const timestamp = isOI ? alert.ts : alert.timestamp

  // Format values
  const formatOI = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`
    return value.toFixed(0)
  }

  const formatVolume = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
    return `$${value.toFixed(0)}`
  }

  const formatExactTime = (ts: string) => format(new Date(ts), 'h:mm a')
  const formatRelativeTime = (ts: string) => formatDistanceToNow(new Date(ts), { addSuffix: true }).replace('about ', '')

  // Get badge info
  const getBadgeText = () => {
    if (isOI) {
      const pctChange = (alert.pctChange || 0) * 100
      return `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)} %`
    }
    return `${(alert.volumeRatio || 0).toFixed(2)}x`
  }

  const getTimeframeBadge = () => {
    if (isOI) {
      return alert.timeframe || '5 min'
    }
    if (alert.isUpdate) {
      return alert.alertType === 'HALF_UPDATE' ? '30m Update' : 'Hourly Update'
    }
    return null
  }

  // Colors
  const borderColor = isUp ? 'rgba(34, 197, 94, 0.4)' : isDown ? 'rgba(239, 68, 68, 0.4)' : 'rgba(100, 116, 139, 0.4)'
  const bgColor = isUp ? 'rgba(34, 197, 94, 0.08)' : isDown ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)'
  const accentColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#64748b'
  const badgeBg = isUp ? 'rgba(34, 197, 94, 0.15)' : isDown ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)'

  const timeframeBadge = getTimeframeBadge()
  const isHourly = alert.alertType === 'FULL_UPDATE' || alert.timeframe === '1 hour'
  const is15min = alert.alertType === 'HALF_UPDATE' || alert.timeframe === '15 min'
  const is5min = !isHourly && !is15min // Default case for OI alerts

  // Timeframe badge colors: 5min = cyan, 15min = violet, 1hour = amber
  const getTimeframeBadgeColor = () => {
    if (isHourly) return 'rgba(245, 158, 11, 0.85)' // amber
    if (is15min) return 'rgba(139, 92, 246, 0.85)' // violet
    return 'rgba(6, 182, 212, 0.85)' // cyan for 5 min
  }

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: `linear-gradient(135deg, ${bgColor} 0%, #0f172a 100%)`,
        padding: 20,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      {/* Header: Symbol + Timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
	        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
	          {isDown ? (
	            <TrendingDown style={{ width: 24, height: 24, color: '#ef4444' }} />
	          ) : (
	            <TrendingUp style={{ width: 24, height: 24, color: isUp ? '#22c55e' : '#64748b' }} />
	          )}
	          <span
	            data-capture="symbol"
	            style={{
	              fontSize: 28,
	              fontWeight: 700,
	              letterSpacing: '-0.02em',
	              // html2canvas can render unitless line-heights slightly off; use an explicit px line-height.
	              lineHeight: '34px',
	              display: 'block',
	            }}
	          >
	            {symbol}
	          </span>
	        </div>
	        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {timestamp && formatExactTime(timestamp)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            ({timestamp && formatRelativeTime(timestamp)})
          </div>
        </div>
      </div>

	      {/* Badges */}
	      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
		        <span
		          data-capture="badge-primary"
		          style={{
		            // html2canvas has known flexbox alignment quirks; use line-height centering for reliable capture.
		            display: 'inline-block',
		            padding: '0 12px',
	            borderRadius: 6,
	            backgroundColor: badgeBg,
	            border: `1px solid ${borderColor}`,
	            color: accentColor,
		            fontSize: 16,
		            fontWeight: 600,
		            fontFamily: 'ui-monospace, monospace',
		            height: BADGE_HEIGHT,
		            lineHeight: `${BADGE_HEIGHT}px`,
		            textAlign: 'center',
		            verticalAlign: 'middle',
		            whiteSpace: 'nowrap',
		            boxSizing: 'border-box',
	          }}
	        >
	          {getBadgeText()}
	        </span>
		        {timeframeBadge && (
		          <span
		            data-capture="badge-timeframe"
		            style={{
		              // Keep sizing consistent with multiplier badge (transparent border keeps height math stable).
		              display: 'inline-block',
		              padding: '0 12px',
	              borderRadius: 6,
	              backgroundColor: getTimeframeBadgeColor(),
	              border: '1px solid transparent',
		              color: '#fff',
		              fontSize: 14,
		              fontWeight: 500,
		              height: BADGE_HEIGHT,
		              lineHeight: `${BADGE_HEIGHT}px`,
		              textAlign: 'center',
		              verticalAlign: 'middle',
		              whiteSpace: 'nowrap',
		              boxSizing: 'border-box',
	            }}
	          >
	            {timeframeBadge}
	          </span>
	        )}
	      </div>

      {/* Main Info */}
      <div style={{ marginTop: 12, fontSize: 15, color: '#94a3b8', lineHeight: 1.6 }}>
        {isOI ? (
          <>
            <div>Current OI: <span style={{ color: '#e2e8f0' }}>{formatOI(alert.current || 0)}</span></div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{alert.timeframe || '5 min'} ago: {formatOI(alert.baseline || 0)}</div>
          </>
        ) : (
          <>
            <div>This hour: <span style={{ color: '#e2e8f0' }}>{formatVolume(alert.currentVolume || 0)}</span></div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Last hour: {formatVolume(alert.previousVolume || 0)}</div>
          </>
        )}
      </div>

      {/* Footer: Price + OI + Funding */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid rgba(100, 116, 139, 0.2)',
      }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
          {alert.priceChange !== undefined && alert.priceChange !== null && (
            <span>
              Price:{' '}
              <span style={{ color: (alert.priceChange >= 0) ? '#22c55e' : '#ef4444' }}>
                {alert.priceChange >= 0 ? '+' : ''}{(alert.priceChange * 100).toFixed(2)}%
              </span>
            </span>
          )}
          {/* OI change for Volume alerts */}
          {!isOI && alert.oiChange !== undefined && alert.oiChange !== null && (
            <span>
              OI:{' '}
              <span style={{ color: (alert.oiChange >= 0) ? '#22c55e' : '#ef4444' }}>
                {alert.oiChange >= 0 ? '+' : ''}{(alert.oiChange * 100).toFixed(2)}%
              </span>
            </span>
          )}
          {alert.fundingRate !== undefined && alert.fundingRate !== null && (
            <span>
              Funding:{' '}
              <span style={{
                color: alert.fundingRate > 0.0003 ? '#22c55e' : alert.fundingRate < -0.0003 ? '#ef4444' : '#94a3b8'
              }}>
                {(alert.fundingRate * 100).toFixed(3)}%
              </span>
            </span>
          )}
        </div>
        {/* VolSpike branding */}
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          volspike.com
        </div>
      </div>
    </div>
  )
}

export { CARD_WIDTH, CARD_HEIGHT }
