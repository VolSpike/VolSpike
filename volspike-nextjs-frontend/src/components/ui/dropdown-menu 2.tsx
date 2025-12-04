import React from 'react'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
    children: React.ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
    return <div className="relative inline-block text-left">{children}</div>
}

interface DropdownMenuTriggerProps {
    asChild?: boolean
    children: React.ReactNode
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
    if (asChild) {
        return <>{children}</>
    }
    return <div className="inline-block">{children}</div>
}

interface DropdownMenuContentProps {
    align?: 'start' | 'center' | 'end'
    children: React.ReactNode
    className?: string
}

export function DropdownMenuContent({ align = 'start', children, className }: DropdownMenuContentProps) {
    return (
        <div
            className={cn(
                'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 transform -translate-x-1/2' : 'left-0',
                className
            )}
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
