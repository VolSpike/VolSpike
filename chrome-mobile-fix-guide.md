Chrome Mobile Diagonal Rubber-Band Fix

Overview
- Symptom: When a user starts a horizontal pan inside the Market Data table and then drags vertically at the top/bottom, the inner scroller rubber-bands instead of chaining to the page or clamping.
- Target: Chrome mobile (Android and iOS Chrome). Behavior stems from mixed-axis gesture handoff and nested scrolling.

What We Implemented
- Early direction lock: Decide within the first ~10px whether the intent is horizontal or vertical.
- Horizontal bias: Use a factor (0.8) so slight diagonals still lock to horizontal when appropriate.
- Non-passive, capture-phase touch listeners: Ensure preventDefault is honored before the browser commits the scroll.
- Aggressive prevention during horizontal lock: Prevent vertical rubber-band at edges while allowing smooth horizontal scroll.
- Manual horizontal scroll + simple momentum: Drive scrollLeft directly and apply a short-lived inertial tail after touchend.

Key Code
- See volspike-nextjs-frontend/src/components/market-table.tsx
  - Scroll container styles: overscrollBehaviorX: 'none', overscrollBehaviorY: 'auto', touchAction: 'pan-x pan-y pinch-zoom'
  - Touch handler effect: capture-phase, passive: false on touchstart/move

Testing Checklist
- Chrome Android and iOS Chrome
  - Vertical-only drag at top/bottom: page scrolls (no regression)
  - Horizontal drag: smooth, inertial
  - Horizontal then vertical at edge: no rubber-band in table
  - Sticky header remains functional; sorting and actions work

Fallback/Alternatives (if needed)
- PointerEvents: Replace TouchEvents with pointerdown/pointermove; still non-passive + capture-phase.
- Dynamic CSS toggles: While horizontally locked, set overscroll-behavior-y: contain and/or touch-action: pan-x; restore on unlock.
- Layout isolation: Move sticky header out of the scrollable container to simplify scroll chain resolution.

Notes
- The solution is local to the table container and does not modify app-wide scroll behavior.
- If OEM/Chrome versions differ in behavior, try the PointerEvents variant or dynamic CSS toggles.

