'use client'

import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownMenuContextType {
    open: boolean
    setOpen: (open: boolean) => void
    triggerRef: React.MutableRefObject<HTMLElement | null>
    containerRef: React.MutableRefObject<HTMLDivElement | null>
    contentRef: React.MutableRefObject<HTMLDivElement | null>
}

const DropdownMenuContext = createContext<DropdownMenuContextType | null>(null)

interface DropdownMenuProps {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLElement | null>(null)
    const contentRef = useRef<HTMLDivElement | null>(null)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    const setOpen = (value: boolean) => {
        if (isControlled) {
            onOpenChange?.(value)
        } else {
            setInternalOpen(value)
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            const container = containerRef.current
            const content = contentRef.current
            
            // Check if click is outside both container and content (for portals)
            if (container && !container.contains(target) && 
                content && !content.contains(target)) {
                setOpen(false)
            } else if (container && !container.contains(target) && !content) {
                // Fallback for non-portal dropdowns
                setOpen(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        if (open) {
            // Use a small delay to avoid immediate closure
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside)
                document.addEventListener('keydown', handleEscape)
            }, 0)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [open])

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, containerRef, contentRef }}>
            <div ref={containerRef} className="relative inline-block text-left">
                {children}
            </div>
        </DropdownMenuContext.Provider>
    )
}

interface DropdownMenuTriggerProps {
    asChild?: boolean
    children: React.ReactNode
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
    const context = useContext(DropdownMenuContext)
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu')

    const handleClick = () => {
        context.setOpen(!context.open)
    }

    if (asChild) {
        const childElement = children as React.ReactElement
        const originalRef = (childElement as any).ref
        
        return React.cloneElement(childElement, {
            onClick: (e: React.MouseEvent) => {
                e.stopPropagation()
                handleClick()
            },
            'aria-expanded': context.open,
            'aria-haspopup': 'menu',
            ref: (node: HTMLElement | null) => {
                console.log('[DropdownMenuTrigger] Setting trigger ref:', {
                    node,
                    tagName: node?.tagName,
                    className: node?.className,
                })
                context.triggerRef.current = node
                // Call original ref if it exists
                if (typeof originalRef === 'function') {
                    originalRef(node)
                } else if (originalRef && typeof originalRef === 'object' && 'current' in originalRef) {
                    (originalRef as React.MutableRefObject<HTMLElement | null>).current = node
                }
            },
        })
    }
    return (
        <div 
            ref={(node) => { context.triggerRef.current = node }}
            onClick={handleClick} 
            aria-expanded={context.open} 
            aria-haspopup="menu" 
            className="inline-block cursor-pointer"
        >
            {children}
        </div>
    )
}

interface DropdownMenuContentProps {
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom'
    children: React.ReactNode
    className?: string
    usePortal?: boolean
}

export function DropdownMenuContent({
    align = 'start',
    side = 'bottom',
    children,
    className,
    usePortal = false,
}: DropdownMenuContentProps) {
    const context = useContext(DropdownMenuContext)
    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')

    const [position, setPosition] = useState({ top: 0, left: 0, right: 0, bottom: 0 })
    const contentRef = useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = useState(false)
    
    // Share contentRef with context for click-outside detection
    useEffect(() => {
        if (context.contentRef) {
            context.contentRef.current = contentRef.current
        }
    })

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!context.open || !usePortal || !context.triggerRef.current) {
            console.log('[DropdownMenu] Position update skipped:', {
                open: context.open,
                usePortal,
                hasTrigger: !!context.triggerRef.current,
            })
            return
        }

        const updatePosition = () => {
            const trigger = context.triggerRef.current
            if (!trigger) {
                console.warn('[DropdownMenu] No trigger element found')
                return
            }

            const rect = trigger.getBoundingClientRect()
            const contentHeight = contentRef.current?.offsetHeight || 200
            const contentWidth = contentRef.current?.offsetWidth || 180

            console.log('[DropdownMenu] Position calculation:', {
                triggerRect: {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height,
                },
                contentSize: {
                    width: contentWidth,
                    height: contentHeight,
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                scroll: {
                    x: window.scrollX,
                    y: window.scrollY,
                },
                align,
                side,
            })

            let top = 0
            let left = 0
            let right = 0

            // Smart positioning: prefer bottom, but use top if not enough space
            const spaceBelow = window.innerHeight - rect.bottom
            const spaceAbove = rect.top
            const useTop = side === 'top' || (side === 'bottom' && spaceBelow < contentHeight && spaceAbove > spaceBelow)

            if (useTop) {
                // Position above the trigger
                top = rect.top - contentHeight - 4
                // Ensure it doesn't go off-screen
                if (top < 0) {
                    top = 4
                }
            } else {
                // Position below the trigger
                top = rect.bottom + 4
                // Ensure it doesn't go off-screen
                if (top + contentHeight > window.innerHeight) {
                    top = window.innerHeight - contentHeight - 4
                    // If still off-screen, position above
                    if (top < 0) {
                        top = rect.top - contentHeight - 4
                        if (top < 0) {
                            top = 4
                        }
                    }
                }
            }

            if (align === 'end') {
                // Align to the right edge of the trigger
                right = window.innerWidth - rect.right
                // Ensure it doesn't go off-screen
                if (right < 0) {
                    right = 4
                } else if (right + contentWidth > window.innerWidth) {
                    right = window.innerWidth - contentWidth - 4
                }
            } else if (align === 'center') {
                // Center on the trigger
                left = rect.left + rect.width / 2 - contentWidth / 2
                // Ensure it doesn't go off-screen
                if (left < 0) {
                    left = 4
                } else if (left + contentWidth > window.innerWidth) {
                    left = window.innerWidth - contentWidth - 4
                }
            } else {
                // Align to the left edge of the trigger
                left = rect.left
                // Ensure it doesn't go off-screen
                if (left + contentWidth > window.innerWidth) {
                    left = window.innerWidth - contentWidth - 4
                }
                if (left < 0) {
                    left = 4
                }
            }

            const finalPosition = { top, left: left as number, right: right as number, bottom: 0 }
            console.log('[DropdownMenu] Final position:', finalPosition)
            setPosition(finalPosition)
        }

        // Small delay to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            updatePosition()
        }, 0)
        
        // Update on scroll/resize
        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()
        
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)
        
        // Update when content size changes
        const resizeObserver = new ResizeObserver(() => {
            // Small delay to allow content to render
            setTimeout(updatePosition, 0)
        })
        if (contentRef.current) {
            resizeObserver.observe(contentRef.current)
        }

        return () => {
            clearTimeout(timeoutId)
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
        }
    }, [context.open, usePortal, align, side, context.triggerRef])

    if (!context.open) return null

    const content = (
        <div
            ref={contentRef}
            className={cn(
                'fixed z-[9999] min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
                usePortal ? '' : 'absolute',
                !usePortal && (
                    // Horizontal alignment (only when not using portal)
                    align === 'end'
                        ? 'right-0'
                        : align === 'center'
                            ? 'left-1/2 transform -translate-x-1/2'
                            : 'left-0'
                ),
                !usePortal && (
                    // Vertical side (only when not using portal)
                    side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
                ),
                className
            )}
            style={usePortal ? {
                top: position.top,
                left: align === 'end' ? undefined : position.left,
                right: align === 'end' ? position.right : undefined,
            } : undefined}
            role="menu"
        >
            {children}
        </div>
    )

    if (usePortal && mounted && typeof window !== 'undefined') {
        return createPortal(content, document.body)
    }

    return content
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode
    asChild?: boolean
}

export function DropdownMenuItem({ children, asChild, className, ...props }: DropdownMenuItemProps) {
    const context = useContext(DropdownMenuContext)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        props.onClick?.(e)
        if (!asChild) {
            context?.setOpen(false)
        }
    }

    if (asChild) {
        return <>{children}</>
    }
    return (
        <button
            className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                className
            )}
            {...props}
            onClick={handleClick}
            role="menuitem"
        >
            {children}
        </button>
    )
}

interface DropdownMenuLabelProps {
    children: React.ReactNode
    className?: string
}

export function DropdownMenuLabel({ children, className }: DropdownMenuLabelProps) {
    return (
        <div className={cn('px-2 py-1.5 text-sm font-semibold', className)}>
            {children}
        </div>
    )
}

interface DropdownMenuSeparatorProps {
    className?: string
}

export function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
    return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} />
}

// Submenu support
interface DropdownMenuSubProps {
    children: React.ReactNode
}

const DropdownMenuSubContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

export function DropdownMenuSub({ children }: DropdownMenuSubProps) {
    const [open, setOpen] = useState(false)

    return (
        <DropdownMenuSubContext.Provider value={{ open, setOpen }}>
            <div className="relative">
                {children}
            </div>
        </DropdownMenuSubContext.Provider>
    )
}

interface DropdownMenuSubTriggerProps {
    children: React.ReactNode
    className?: string
}

export function DropdownMenuSubTrigger({ children, className }: DropdownMenuSubTriggerProps) {
    const context = useContext(DropdownMenuSubContext)
    if (!context) throw new Error('DropdownMenuSubTrigger must be used within DropdownMenuSub')

    return (
        <button
            className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                className
            )}
            onClick={() => context.setOpen(!context.open)}
            onMouseEnter={() => context.setOpen(true)}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={context.open}
        >
            {children}
            <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>
    )
}

interface DropdownMenuSubContentProps {
    children: React.ReactNode
    className?: string
}

export function DropdownMenuSubContent({ children, className }: DropdownMenuSubContentProps) {
    const context = useContext(DropdownMenuSubContext)
    if (!context) throw new Error('DropdownMenuSubContent must be used within DropdownMenuSub')

    if (!context.open) return null

    return (
        <div
            className={cn(
                'absolute left-full top-0 ml-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-50',
                className
            )}
            role="menu"
        >
            {children}
        </div>
    )
}

// Portal component (for compatibility with Radix-style usage)
interface DropdownMenuPortalProps {
    children: React.ReactNode
}

export function DropdownMenuPortal({ children }: DropdownMenuPortalProps) {
    return <>{children}</>
}
