// Single source of truth for tier pricing
// Update prices here and they will be reflected everywhere

export const TIER_PRICES = {
    free: 0,
    pro: 19,
    elite: 49,
} as const

export type TierName = keyof typeof TIER_PRICES

// Helper to get numeric price
export function getPrice(tier: TierName): number {
    return TIER_PRICES[tier]
}
