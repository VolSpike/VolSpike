'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminPageHeaderProps {
    title: string
    description?: string
    /** Optional leading icon rendered in a soft badge */
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
    /** Right-aligned metadata, e.g. totals or status */
    meta?: React.ReactNode
    /** Primary actions such as buttons */
    actions?: React.ReactNode
    className?: string
}

export function AdminPageHeader({
    title,
    description,
    icon: Icon,
    meta,
    actions,
    className,
}: AdminPageHeaderProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
                className
            )}
        >
            <div className="flex items-start gap-3 sm:items-center">
                {Icon && (
                    <div className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 via-elite-500/10 to-sec-500/15 text-brand-500 dark:text-brand-300 shadow-inner ring-1 ring-brand-500/20">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl bg-gradient-to-r from-brand-500 via-elite-400 to-sec-500 bg-clip-text text-transparent">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {(meta || actions) && (
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                    {meta && (
                        <div className="text-sm text-muted-foreground sm:text-right">
                            {meta}
                        </div>
                    )}
                    {actions && (
                        <div className="flex items-center justify-end gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

