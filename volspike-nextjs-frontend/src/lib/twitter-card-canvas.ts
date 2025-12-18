'use client'

import { format, formatDistanceToNow } from 'date-fns'

export const TWITTER_CARD_WIDTH = 480
export const TWITTER_CARD_HEIGHT = 270

type AlertType = 'VOLUME' | 'OPEN_INTEREST'

type TwitterCardAlert = {
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
  oiChange?: number | null
  ts?: string
  timestamp?: string
}

type Palette = {
  border: string
  bgTint: string
  accent: string
  badgeBg: string
  badgeBorder: string
}

type CanvasFill = string | CanvasGradient | CanvasPattern

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatExactTime(ts: string) {
  return format(new Date(ts), 'h:mm a')
}

function formatRelativeTime(ts: string) {
  return formatDistanceToNow(new Date(ts), { addSuffix: true }).replace('about ', '')
}

function formatOI(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toFixed(0)
}

function formatVolume(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(0)}`
}

function withFont(ctx: CanvasRenderingContext2D, font: string) {
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
}

function measureText(ctx: CanvasRenderingContext2D, text: string) {
  const m = ctx.measureText(text)
  const ascent =
    typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : 0
  const descent =
    typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : 0
  return { width: m.width, ascent, descent, height: ascent + descent }
}

function baselineForCenterY(metrics: { ascent: number; descent: number }, centerY: number) {
  return centerY + (metrics.ascent - metrics.descent) / 2
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = clamp(r, 0, Math.min(w, h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: CanvasFill
) {
  roundedRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth: number
) {
  roundedRectPath(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number
    y: number
    h: number
    text: string
    font: string
    fg: string
    bg: string
    border?: string
    radius: number
    paddingX: number
  }
) {
  withFont(ctx, opts.font)
  const m = measureText(ctx, opts.text)
  const w = Math.ceil(m.width + opts.paddingX * 2)
  fillRoundedRect(ctx, opts.x, opts.y, w, opts.h, opts.radius, opts.bg)
  if (opts.border) {
    strokeRoundedRect(ctx, opts.x, opts.y, w, opts.h, opts.radius, opts.border, 1)
  }
  ctx.fillStyle = opts.fg
  const centerY = opts.y + opts.h / 2
  const baselineY = baselineForCenterY(m, centerY)
  ctx.fillText(opts.text, opts.x + opts.paddingX, baselineY)
  return { w }
}

function pickPalette(isUp: boolean, isDown: boolean): Palette {
  if (isUp) {
    return {
      border: 'rgba(34, 197, 94, 0.4)',
      bgTint: 'rgba(34, 197, 94, 0.08)',
      accent: '#22c55e',
      badgeBg: 'rgba(34, 197, 94, 0.15)',
      badgeBorder: 'rgba(34, 197, 94, 0.4)',
    }
  }
  if (isDown) {
    return {
      border: 'rgba(239, 68, 68, 0.4)',
      bgTint: 'rgba(239, 68, 68, 0.08)',
      accent: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.4)',
    }
  }
  return {
    border: 'rgba(100, 116, 139, 0.4)',
    bgTint: 'rgba(100, 116, 139, 0.08)',
    accent: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    badgeBorder: 'rgba(100, 116, 139, 0.4)',
  }
}

function timeframeBadgeColor(isHourly: boolean, is15min: boolean) {
  if (isHourly) return 'rgba(245, 158, 11, 0.85)'
  if (is15min) return 'rgba(139, 92, 246, 0.85)'
  return 'rgba(6, 182, 212, 0.85)'
}

function drawTrendIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isDown: boolean,
  color: string
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Simple zigzag arrow (roughly matches lucide style at small sizes).
  const s = size
  ctx.beginPath()
  if (isDown) {
    ctx.moveTo(0.1 * s, 0.25 * s)
    ctx.lineTo(0.45 * s, 0.6 * s)
    ctx.lineTo(0.65 * s, 0.4 * s)
    ctx.lineTo(0.9 * s, 0.65 * s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0.9 * s, 0.65 * s)
    ctx.lineTo(0.75 * s, 0.65 * s)
    ctx.lineTo(0.9 * s, 0.8 * s)
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.moveTo(0.1 * s, 0.75 * s)
    ctx.lineTo(0.45 * s, 0.4 * s)
    ctx.lineTo(0.65 * s, 0.6 * s)
    ctx.lineTo(0.9 * s, 0.35 * s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0.9 * s, 0.35 * s)
    ctx.lineTo(0.75 * s, 0.35 * s)
    ctx.lineTo(0.9 * s, 0.2 * s)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

export async function renderTwitterCardDataUrl(params: {
  alert: TwitterCardAlert
  alertType: AlertType
  scale?: number
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('renderTwitterCardDataUrl must be called in the browser')
  }

  const { alert, alertType, scale = 2.5 } = params
  const isOI = alertType === 'OPEN_INTEREST'

  const isUp = isOI ? alert.direction === 'UP' : alert.candleDirection === 'bullish'
  const isDown = isOI ? alert.direction === 'DOWN' : alert.candleDirection === 'bearish'
  const palette = pickPalette(isUp, isDown)

  const symbol = isOI
    ? (alert.symbol?.replace('USDT', '') || 'Unknown')
    : (alert.asset || 'Unknown')

  const timestamp = isOI ? alert.ts : alert.timestamp

  const timeframeBadge = (() => {
    if (isOI) return alert.timeframe || '5 min'
    if (alert.isUpdate) return alert.alertType === 'HALF_UPDATE' ? '30m Update' : 'Hourly Update'
    return null
  })()

  const isHourly = alert.alertType === 'FULL_UPDATE' || alert.timeframe === '1 hour'
  const is15min = alert.alertType === 'HALF_UPDATE' || alert.timeframe === '15 min'

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(TWITTER_CARD_WIDTH * scale)
  canvas.height = Math.round(TWITTER_CARD_HEIGHT * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  const context = ctx

  // Scale to design pixels.
  context.scale(scale, scale)

  // Background + outer border.
  fillRoundedRect(context, 0, 0, TWITTER_CARD_WIDTH, TWITTER_CARD_HEIGHT, 12, '#0f172a')
  const grad = context.createLinearGradient(0, 0, TWITTER_CARD_WIDTH, TWITTER_CARD_HEIGHT)
  grad.addColorStop(0, palette.bgTint)
  grad.addColorStop(1, '#0f172a')
  fillRoundedRect(context, 0, 0, TWITTER_CARD_WIDTH, TWITTER_CARD_HEIGHT, 12, grad)
  strokeRoundedRect(context, 0, 0, TWITTER_CARD_WIDTH, TWITTER_CARD_HEIGHT, 12, palette.border, 2)

  const padding = 20
  // Keep header + badges fixed (these are the elements that were misaligned before).
  // Only nudge the body/footer text blocks for visual parity with the previous DOM-based card.
  const bodyNudgeY = 6
  const footerNudgeY = 6

  // Header: icon + symbol (left), timestamps (right).
  const headerTop = padding
  const headerLineH = 34
  const headerCenterY = headerTop + headerLineH / 2

  drawTrendIcon(
    context,
    padding,
    headerCenterY - 12,
    24,
    isDown,
    isDown ? '#ef4444' : isUp ? '#22c55e' : '#64748b'
  )

  withFont(context, '700 28px system-ui, -apple-system, sans-serif')
  context.fillStyle = '#e2e8f0'
  const symbolMetrics = measureText(context, symbol)
  const symbolBaseline = baselineForCenterY(symbolMetrics, headerCenterY)
  context.fillText(symbol, padding + 24 + 10, symbolBaseline)

  if (timestamp) {
    const rightX = TWITTER_CARD_WIDTH - padding
    withFont(context, '400 14px system-ui, -apple-system, sans-serif')
    context.fillStyle = '#94a3b8'
    context.textAlign = 'right'
    const exact = formatExactTime(timestamp)
    context.fillText(exact, rightX, headerTop + 14)
    withFont(context, '400 12px system-ui, -apple-system, sans-serif')
    context.fillStyle = '#64748b'
    context.fillText(`(${formatRelativeTime(timestamp)})`, rightX, headerTop + 30)
    context.textAlign = 'left'
  }

  // Badges row.
  const badgesTop = headerTop + headerLineH + 12
  let badgeX = padding

  const primaryBadgeText = (() => {
    if (isOI) {
      const pct = (alert.pctChange || 0) * 100
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} %`
    }
    return `${(alert.volumeRatio || 0).toFixed(2)}x`
  })()

  const primary = drawBadge(context, {
    x: badgeX,
    y: badgesTop,
    h: 28,
    text: primaryBadgeText,
    font: '600 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fg: palette.accent,
    bg: palette.badgeBg,
    border: palette.badgeBorder,
    radius: 6,
    paddingX: 12,
  })
  badgeX += primary.w + 10

  if (timeframeBadge) {
    const tf = drawBadge(context, {
      x: badgeX,
      y: badgesTop,
      h: 28,
      text: timeframeBadge,
      font: '500 14px system-ui, -apple-system, sans-serif',
      fg: '#ffffff',
      bg: timeframeBadgeColor(isHourly, is15min),
      border: undefined,
      radius: 6,
      paddingX: 12,
    })
    badgeX += tf.w + 10
  }

  // Main info.
  const mainTop = badgesTop + 28 + 16 + bodyNudgeY
  context.fillStyle = '#94a3b8'
  withFont(context, '400 15px system-ui, -apple-system, sans-serif')
  const lineGap = 22

  if (isOI) {
    const current = formatOI(alert.current || 0)
    const baseline = formatOI(alert.baseline || 0)
    context.fillText('Current OI:', padding, mainTop)
    withFont(context, '400 15px system-ui, -apple-system, sans-serif')
    const labelW = measureText(context, 'Current OI: ').width
    context.fillStyle = '#e2e8f0'
    context.fillText(current, padding + labelW, mainTop)

    withFont(context, '400 13px system-ui, -apple-system, sans-serif')
    context.fillStyle = 'rgba(148, 163, 184, 0.8)'
    const tf = alert.timeframe || '5 min'
    context.fillText(`${tf} ago: ${baseline}`, padding, mainTop + lineGap)
  } else {
    const thisHour = formatVolume(alert.currentVolume || 0)
    const lastHour = formatVolume(alert.previousVolume || 0)
    context.fillText('This hour:', padding, mainTop)
    const labelW = measureText(context, 'This hour: ').width
    context.fillStyle = '#e2e8f0'
    context.fillText(thisHour, padding + labelW, mainTop)

    withFont(context, '400 13px system-ui, -apple-system, sans-serif')
    context.fillStyle = 'rgba(148, 163, 184, 0.8)'
    context.fillText(`Last hour: ${lastHour}`, padding, mainTop + lineGap)
  }

  // Footer separator.
  const sepY = TWITTER_CARD_HEIGHT - padding - 28 + footerNudgeY
  context.strokeStyle = 'rgba(100, 116, 139, 0.2)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(padding, sepY)
  context.lineTo(TWITTER_CARD_WIDTH - padding, sepY)
  context.stroke()

  // Footer metrics.
  const footerY = TWITTER_CARD_HEIGHT - padding - 10 + footerNudgeY
  withFont(context, '400 13px system-ui, -apple-system, sans-serif')
  context.fillStyle = '#94a3b8'

  let fx = padding
  const gap = 16

  function drawFooterMetric(label: string, value: string, valueColor: string) {
    withFont(context, '400 13px system-ui, -apple-system, sans-serif')
    context.fillStyle = '#94a3b8'
    context.fillText(label, fx, footerY)
    const lw = measureText(context, label).width
    context.fillStyle = valueColor
    context.fillText(value, fx + lw, footerY)
    const vw = measureText(context, value).width
    fx += lw + vw + gap
  }

  if (alert.priceChange !== undefined && alert.priceChange !== null) {
    const pct = alert.priceChange * 100
    drawFooterMetric(
      'Price: ',
      `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
      pct >= 0 ? '#22c55e' : '#ef4444'
    )
  }

  if (!isOI && alert.oiChange !== undefined && alert.oiChange !== null) {
    const pct = alert.oiChange * 100
    drawFooterMetric(
      'OI: ',
      `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
      pct >= 0 ? '#22c55e' : '#ef4444'
    )
  }

  if (alert.fundingRate !== undefined && alert.fundingRate !== null) {
    const pct = alert.fundingRate * 100
    const valueColor = alert.fundingRate > 0.0003 ? '#22c55e' : alert.fundingRate < -0.0003 ? '#ef4444' : '#94a3b8'
    drawFooterMetric('Funding: ', `${pct.toFixed(3)}%`, valueColor)
  }

  // Branding (right).
  context.textAlign = 'right'
  context.fillStyle = '#64748b'
  withFont(context, '500 12px system-ui, -apple-system, sans-serif')
  context.fillText('volspike.com', TWITTER_CARD_WIDTH - padding, footerY)
  context.textAlign = 'left'

  return canvas.toDataURL('image/png', 1.0)
}
