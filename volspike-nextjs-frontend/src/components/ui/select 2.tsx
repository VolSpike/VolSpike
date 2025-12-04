import React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode
}

export function Select({ className, children, ...props }: SelectProps) {
    return (
        <select
            className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            {children}
        </select>
    )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode
}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
    return (
        <button
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            {children}
        </button>
    )
}

interface SelectContentProps {
    children: React.ReactNode
    className?: string
}

export function SelectContent({ children, className }: SelectContentProps) {
    return (
        <div className={cn('relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md', className)}>
            {children}
        </div>
    )
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
    children: React.ReactNode
}

export function SelectItem({ children, ...props }: SelectItemProps) {
    return (
        <option {...props}>
            {children}
        </option>
    )
}

interface SelectValueProps {
    placeholder?: string
}

export function SelectValue({ placeholder }: SelectValueProps) {
    return <span className="text-muted-foreground">{placeholder}</span>
}
