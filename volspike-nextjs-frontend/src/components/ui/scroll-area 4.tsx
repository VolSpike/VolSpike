import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollAreaProps {
    children: React.ReactNode
    className?: string
    direction?: 'vertical' | 'horizontal' | 'both'
    showHint?: boolean
}

export function ScrollArea({
    children,
    className,
    direction = 'vertical',
    showHint = false,
}: ScrollAreaProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [canScroll, setCanScroll] = useState(false)
    const [atStart, setAtStart] = useState(true)
    const [atEnd, setAtEnd] = useState(false)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const update = () => {
            const node = containerRef.current
            if (!node) return

            const scrollSize =
                direction === 'horizontal' ? node.scrollWidth : node.scrollHeight
            const clientSize =
                direction === 'horizontal' ? node.clientWidth : node.clientHeight
            const scrollPos =
                direction === 'horizontal' ? node.scrollLeft : node.scrollTop

            const can = scrollSize > clientSize + 1
            setCanScroll(can)
            setAtStart(scrollPos <= 1)
            setAtEnd(scrollPos + clientSize >= scrollSize - 1)
        }

        update()
        el.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)

        const id = window.setTimeout(update, 0)

        return () => {
            window.clearTimeout(id)
            el.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [direction])

    const isVertical = direction === 'vertical' || direction === 'both'
    const isHorizontal = direction === 'horizontal' || direction === 'both'

    return (
        <div className={cn('relative', className)}>
            <div
                ref={containerRef}
                className={cn(
                    'vs-scroll h-full',
                    direction === 'vertical' && 'overflow-y-auto',
                    direction === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
                    direction === 'both' && 'overflow-auto'
                )}
            >
                {children}
            </div>

            {canScroll && isVertical && !atStart && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-background to-transparent" />
            )}
            {canScroll && isVertical && !atEnd && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background to-transparent" />
            )}

            {canScroll && isHorizontal && !atStart && (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
            )}
            {canScroll && isHorizontal && !atEnd && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />
            )}

            {showHint && canScroll && (
                <div className="pointer-events-none absolute bottom-1 right-3 z-10 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm md:hidden">
                    <span>{direction === 'horizontal' ? 'Swipe \u2192' : 'Scroll'}</span>
                </div>
            )}
        </div>
    )
}
