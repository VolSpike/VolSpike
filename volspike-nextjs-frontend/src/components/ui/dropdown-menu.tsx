'use client'

import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

interface DropdownMenuContextType {
    open: boolean
    setOpen: (open: boolean) => void
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
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        if (open) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleEscape)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [open])

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen }}>
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
        return React.cloneElement(children as React.ReactElement, {
            onClick: handleClick,
            'aria-expanded': context.open,
            'aria-haspopup': 'menu',
        })
    }
    return (
        <div onClick={handleClick} aria-expanded={context.open} aria-haspopup="menu" className="inline-block cursor-pointer">
            {children}
        </div>
    )
}

interface DropdownMenuContentProps {
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom'
    children: React.ReactNode
    className?: string
}

export function DropdownMenuContent({
    align = 'start',
    side = 'bottom',
    children,
    className,
}: DropdownMenuContentProps) {
    const context = useContext(DropdownMenuContext)
    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')

    if (!context.open) return null

    return (
        <div
            className={cn(
                'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                // Horizontal alignment
                align === 'end'
                    ? 'right-0'
                    : align === 'center'
                        ? 'left-1/2 transform -translate-x-1/2'
                        : 'left-0',
                // Vertical side: open below (default) or above the trigger
                side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
                className
            )}
            role="menu"
        >
            {children}
        </div>
    )
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
