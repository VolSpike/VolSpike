/**
 * Click Debugger Utility
 * Helps identify what element is intercepting clicks
 * 
 * Usage: Call enableClickDebugger() in browser console
 */

export function enableClickDebugger() {
  console.log('🔍 Click Debugger Enabled')
  console.log('Click anywhere on the page to see what element receives the click')
  
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
    
    console.group('🖱️ Click Debug Info')
    console.log('Clicked element:', target)
    console.log('Element at point:', elementAtPoint)
    console.log('Element tag:', target.tagName)
    console.log('Element classes:', target.className)
    console.log('Element z-index:', window.getComputedStyle(target).zIndex)
    console.log('Element pointer-events:', window.getComputedStyle(target).pointerEvents)
    console.log('Element position:', window.getComputedStyle(target).position)
    console.log('Is clickable (has href or onClick):', 
      target.hasAttribute('href') || 
      target.onclick !== null ||
      target.closest('a') !== null ||
      target.closest('button') !== null
    )
    
    // Check if element is inside header or footer
    const isInHeader = target.closest('header') !== null
    const isInFooter = target.closest('footer') !== null
    console.log('Is in header:', isInHeader)
    console.log('Is in footer:', isInFooter)
    
    // Check for blocking overlays
    const allElements = document.elementsFromPoint(e.clientX, e.clientY)
    const blockingElements = allElements.filter(el => {
      const style = window.getComputedStyle(el as HTMLElement)
      return (
        style.position === 'fixed' ||
        style.position === 'absolute' ||
        parseInt(style.zIndex) > 50
      )
    })
    console.log('Elements at click point (stacking order):', allElements)
    console.log('Potential blocking elements:', blockingElements)
    
    console.groupEnd()
  }, true) // Use capture phase to catch all clicks
  
  return () => {
    document.removeEventListener('click', enableClickDebugger as any)
    console.log('🔍 Click Debugger Disabled')
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).enableClickDebugger = enableClickDebugger
}

