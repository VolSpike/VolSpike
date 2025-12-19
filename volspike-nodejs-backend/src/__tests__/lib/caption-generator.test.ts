import { describe, expect, it } from 'vitest'
import { generateOIAlertCaption, generateVolumeAlertCaption } from '../../lib/caption-generator'

describe('caption-generator', () => {
  it('formats volume caption with $SYMBOL and percent from fraction', () => {
    const caption = generateVolumeAlertCaption({
      id: 'va_1',
      symbol: 'WCTUSDT',
      asset: 'WCT',
      currentVolume: 8_170_000,
      previousVolume: 864_770,
      volumeRatio: 9.45,
      price: null,
      fundingRate: null,
      alertType: 'FULL_UPDATE',
      message: '',
      timestamp: new Date(),
      hourTimestamp: new Date(),
      isUpdate: true,
      candleDirection: 'bullish',
      detectionTime: null,
      oiChange: 0.1822,
      priceChange: 0.0942,
    } as any)

    expect(caption).toContain('🚨 $WCT volume spike: 9.45x in 1 hour!')
    expect(caption).toContain('Price: +9.42%')
  })

  it('formats OI caption with $SYMBOL, percent from fraction, contracts (no $), and direction UP', () => {
    const caption = generateOIAlertCaption({
      id: 'oi_1',
      symbol: 'USTCUSDT',
      direction: 'UP',
      baseline: '627230000',
      current: '651920000',
      pctChange: '0.0394',
      absChange: '24690000',
      priceChange: '0.0547',
      fundingRate: null,
      timeframe: '5 min',
      source: 'test',
      ts: new Date(),
      createdAt: new Date(),
    } as any)

    expect(caption).toContain('🚨 $USTC Open Interest spike: +3.94% in 5 min!')
    expect(caption).toContain('Current OI: 651.92M (up 24.69M).')
    expect(caption).toContain('Price: +5.47%')
    expect(caption).not.toContain('Current OI: $')
    expect(caption).not.toContain('(up $')
  })

  it('formats OI caption direction DOWN when current is lower', () => {
    const caption = generateOIAlertCaption({
      id: 'oi_2',
      symbol: 'ABCUSDT',
      direction: 'DOWN',
      baseline: '1000000',
      current: '900000',
      pctChange: '-0.1',
      absChange: '-100000',
      priceChange: '-0.0123',
      fundingRate: null,
      timeframe: '15 min',
      source: 'test',
      ts: new Date(),
      createdAt: new Date(),
    } as any)

    expect(caption).toContain('$ABC Open Interest spike: -10.00% in 15 min!')
    expect(caption).toContain('Current OI: 900K (down 100K).')
    expect(caption).not.toContain('(down -')
    expect(caption).toContain('Price: -1.23%')
  })
})
