# Market Data Table Scrolling Issues - Expert Consultation Guide

## 🐛 Issue Description

### **Problem 1: Table Can Be Pulled Off Screen**
**Symptom:** On mobile/touch devices, users can sometimes drag the table horizontally beyond its boundaries, causing it to appear "pulled off" the screen.

**When it happens:**
- Horizontal scrolling/swiping on the table
- Table content extends beyond viewport
- Visual glitch where table appears disconnected from its container

**Expected behavior:** Table should stay within its container boundaries, with horizontal scrolling contained within the table area only.

---

### **Problem 2: Page Scroll Locked When Reaching Table End**
**Symptom:** When scrolling down the page and reaching the end of the Market Data table content, the page scroll becomes "stuck" - users cannot continue scrolling down the page unless they touch/click outside the table area.

**When it happens:**
- User scrolls down the page
- Reaches the bottom of the Market Data table
- Tries to continue scrolling down to see content below the table
- Page scroll doesn't work - seems "locked"
- Must touch/click outside table area to resume page scrolling

**Expected behavior:** When reaching the end of table content, scroll should naturally "chain" to the parent page scroll, allowing users to continue scrolling down the page seamlessly.

---

## 📋 Technical Context

### **Current Implementation:**

**File:** `volspike-nextjs-frontend/src/components/market-table.tsx`

**Key Features:**
1. **Scroll Container:** Uses `scrollContainerRef` pointing to a `<div>` with:
   - `overflow-y-auto` (vertical scrolling)
   - `overflow-x-auto` (horizontal scrolling)
   - `max-h-[600px]` (maximum height)
   - `overscrollBehaviorX: 'none'` (prevents horizontal overscroll)
   - `overscrollBehaviorY: 'auto'` (allows vertical scroll chaining)
   - `WebkitOverflowScrolling: 'touch'` (iOS smooth scrolling)

2. **Touch Event Handlers:**
   - `touchstart`: Captures initial touch position
   - `touchmove`: Handles horizontal scrolling with `preventDefault()` on boundaries
   - `scroll`: Clamps scroll position to prevent overscroll

3. **Scroll Clamping Logic:**
   - Horizontal: Prevents scrolling past left/right edges (STRICT)
   - Vertical: Only prevents negative scroll (top edge bounce)
   - Uses `clampScroll()` function called on scroll events

4. **Event Listeners:**
   - `touchmove` uses `{ passive: false }` to allow `preventDefault()`
   - `touchstart` and `scroll` use `{ passive: true }` for performance

---

## 🔍 Root Cause Analysis (Hypotheses)

### **Issue 1: Table Pulled Off Screen**

**Possible Causes:**
1. **Horizontal overscroll not fully prevented:**
   - `preventDefault()` in `touchmove` might not be catching all cases
   - CSS `overscrollBehaviorX: 'none'` might not be working on all browsers/devices
   - Touch event handling might be interfering with CSS scroll behavior

2. **Touch event conflict:**
   - `touchmove` handler with `preventDefault()` might be too aggressive
   - Could be preventing legitimate scroll gestures
   - May conflict with browser's native momentum scrolling

3. **Container boundaries not enforced:**
   - `clampScroll()` runs on `scroll` event, but might be too late
   - Touch gestures might bypass scroll clamping
   - Race condition between touch events and scroll events

---

### **Issue 2: Page Scroll Locked**

**Possible Causes:**
1. **Scroll chaining not working:**
   - `overscrollBehaviorY: 'auto'` should allow scroll chaining, but might not be working
   - Touch event handlers might be preventing scroll propagation to parent
   - `preventDefault()` in `touchmove` might be blocking vertical scroll chaining

2. **Touch event interference:**
   - `touchmove` handler checks horizontal scroll but might be interfering with vertical
   - `preventDefault()` might be called even when vertical scrolling is intended
   - Handler doesn't distinguish between horizontal vs vertical scroll intent

3. **Scroll container height calculation:**
   - `max-h-[600px]` might be causing scroll container to think it has more content
   - When reaching "end", browser might not recognize it's truly at the end
   - Scroll position detection might be incorrect

4. **Passive event listener conflict:**
   - `touchmove` uses `{ passive: false }` to allow `preventDefault()`
   - This might be preventing native scroll chaining behavior
   - Browser optimizations for scroll chaining might be disabled

---

## 📁 Files to Show Expert

### **Primary File:**
```
volspike-nextjs-frontend/src/components/market-table.tsx
```
**Lines to focus on:**
- Lines 70-134: Touch event handlers and scroll clamping logic
- Lines 297-302: Scroll container CSS and styling
- Lines 81-95: `clampScroll()` function implementation
- Lines 97-119: Touch event handlers (`touchstart`, `touchmove`)

### **Secondary Files:**
```
volspike-nextjs-frontend/src/components/dashboard.tsx
```
**Lines to focus on:**
- Lines 122-175: How MarketTable is rendered within Card/CardContent
- Check if parent containers have any overflow/scroll constraints

---

## ❓ Questions to Ask Expert

### **Question 1: Scroll Chaining**
**"How do I properly implement scroll chaining so that when a user reaches the end of a scrollable table, the scroll gesture naturally continues to scroll the parent page? I'm using `overscrollBehaviorY: 'auto'` but it's not working reliably on mobile devices."**

**Context to provide:**
- Using React with Next.js
- Table has `overflow-y-auto` and `overflow-x-auto`
- Touch event handlers with `preventDefault()` for horizontal scroll
- Need scroll chaining to work on iOS Safari and Android Chrome

---

### **Question 2: Touch Event Handling**
**"I have a horizontally scrollable table with custom touch handlers that prevent horizontal overscroll. However, these handlers seem to interfere with vertical scrolling and page scroll chaining. How can I distinguish between horizontal and vertical scroll intent in touch events, and only prevent default for horizontal gestures?"**

**Context to provide:**
- Current implementation uses `touchmove` with `preventDefault()` on horizontal boundaries
- This seems to block vertical scroll chaining
- Need to allow vertical scrolling to propagate to parent while preventing horizontal overscroll

---

### **Question 3: Overscroll Prevention**
**"What's the best way to prevent horizontal overscroll (table being pulled off screen) while maintaining smooth native scrolling behavior? I'm using CSS `overscrollBehaviorX: 'none'` and JavaScript clamping, but users can still sometimes pull the table off-screen."**

**Context to provide:**
- Table is horizontally scrollable
- Need to prevent overscroll bounce/rubber-band effect
- Must work on iOS Safari (known for aggressive overscroll)
- Should maintain smooth scrolling performance

---

### **Question 4: Passive Event Listeners**
**"I'm using `{ passive: false }` on `touchmove` to allow `preventDefault()` for horizontal scroll boundaries. However, this seems to disable browser optimizations for scroll chaining. Is there a way to selectively prevent default only for horizontal gestures while allowing vertical scroll chaining?"**

**Context to provide:**
- Currently: `touchmove` listener with `{ passive: false }`
- Problem: Blocks scroll chaining
- Need: Prevent horizontal overscroll but allow vertical scroll chaining

---

### **Question 5: Mobile Scroll Best Practices**
**"What are the current best practices for implementing nested scrollable containers on mobile web? Specifically, a horizontally scrollable table within a vertically scrollable page, with proper scroll chaining and overscroll prevention."**

**Context to provide:**
- React/Next.js application
- Mobile-first design
- Need to support iOS Safari and Android Chrome
- Performance is important (real-time data updates)

---

## 🎯 Specific Code Sections to Highlight

### **Section 1: Touch Event Handlers (Lines 97-119)**
```typescript
const handleTouchMove = (e: TouchEvent) => {
    const touchX = e.touches[0].clientX
    const deltaX = touchStartX - touchX
    const newScrollLeft = touchStartScrollLeft + deltaX

    const maxScrollLeft = container.scrollWidth - container.clientWidth

    // Prevent horizontal overscroll DURING touch
    if (newScrollLeft < 0) {
        container.scrollLeft = 0
        e.preventDefault()
    } else if (newScrollLeft > maxScrollLeft) {
        container.scrollLeft = maxScrollLeft
        e.preventDefault()
    }

    clampScroll()
}
```

**Issue:** This `preventDefault()` might be blocking vertical scroll chaining.

---

### **Section 2: Scroll Container Styling (Lines 297-302)**
```typescript
<div
    ref={scrollContainerRef}
    className="relative max-h-[600px] overflow-y-auto overflow-x-auto" 
    style={{
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: 'auto',
        WebkitOverflowScrolling: 'touch'
    }}
>
```

**Issue:** `overscrollBehaviorY: 'auto'` should allow scroll chaining, but might not be working due to touch handlers.

---

### **Section 3: Event Listener Setup (Lines 125-127)**
```typescript
container.addEventListener('touchstart', handleTouchStart, { passive: true })
container.addEventListener('touchmove', handleTouchMove, { passive: false })
container.addEventListener('scroll', handleScroll, { passive: true })
```

**Issue:** `{ passive: false }` on `touchmove` might be preventing scroll chaining optimizations.

---

## 📊 Testing Scenarios to Describe

### **Scenario 1: Horizontal Overscroll**
1. Open Market Data table on mobile device
2. Swipe horizontally left/right on the table
3. Try to swipe past the left or right edge
4. **Bug:** Table can be pulled off-screen
5. **Expected:** Table stops at boundaries, no overscroll

### **Scenario 2: Vertical Scroll Chaining**
1. Open page with Market Data table
2. Scroll down the page
3. Reach the Market Data table
4. Continue scrolling down within the table
5. Reach the bottom of table content
6. Try to continue scrolling down (should scroll page)
7. **Bug:** Page scroll is locked, must touch outside table
8. **Expected:** Scroll naturally continues to page scroll

---

## 🔧 Potential Solutions to Discuss

1. **Directional scroll detection:** Only prevent default for horizontal gestures
2. **CSS-only solution:** Rely more on CSS `overscroll-behavior` and less on JavaScript
3. **Intersection Observer:** Detect when scroll reaches boundaries before preventing default
4. **Wheel event handling:** Use wheel events for desktop, touch events for mobile
5. **Scroll event delegation:** Let browser handle scroll chaining, only clamp on boundaries

---

## 📝 Summary for Expert

**The Problem:**
- Market Data table has custom touch handlers to prevent horizontal overscroll
- These handlers interfere with vertical scroll chaining to parent page
- Users cannot continue scrolling page when reaching table end
- Table can sometimes be pulled off-screen horizontally

**The Goal:**
- Prevent horizontal overscroll (table stays within boundaries)
- Allow vertical scroll chaining (scroll continues to page when table ends)
- Maintain smooth native scrolling performance
- Work reliably on iOS Safari and Android Chrome

**The Question:**
What's the best approach to achieve both goals simultaneously without conflicts?

