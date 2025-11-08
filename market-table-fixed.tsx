// Reference copy of the fixed MarketTable component used in
// volspike-nextjs-frontend/src/components/market-table.tsx.
// This file is provided per expert's deliverables for quick
// comparison and fallback, and is not imported by the app.

export const notes = `
This file mirrors the production MarketTable component with the
enhanced Chrome mobile diagonal gesture fix:

- Early direction lock at 10px
- Non-passive, capture-phase touchstart/move
- Horizontal bias (0.8) for diagonal swipes
- Aggressive preventDefault while horizontally locked
- Manual horizontal scroll + basic momentum

See chrome-mobile-fix-guide.md for details.
`

