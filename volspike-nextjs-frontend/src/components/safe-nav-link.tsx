'use client'

import Link, { type LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'

interface SafeNavLinkProps extends Omit<LinkProps, 'href'> {
    href: string
    children: ReactNode
    className?: string
    style?: CSSProperties
    /**
     * Optional label used only for debug logging.
     * Keeps analytics / logging consistent across header & footer.
     */
    debugLabel?: string
}

/**
 * SafeNavLink
 *
 * Wrapper around next/link that:
 * - Guarantees client-side navigation via router.push
 * - Falls back to window.location.href if router navigation fails
 * - Logs rich debug info in development / ?debugNav=true mode
 * - Preserves normal browser behaviours (new tab, middle‑click, etc.)
 */
export function SafeNavLink(props: SafeNavLinkProps) {
    const { href, children, className, debugLabel, ...rest } = props
    const router = useRouter()

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        const isModifierClick =
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0

        const hrefString = href

        const isDebug =
            process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' &&
                new URLSearchParams(window.location.search).get('debugNav') === 'true')

        const beforeHref =
            typeof window !== 'undefined' ? window.location.href : null

        if (isDebug) {
            // Lightweight, structured debug logging
            // eslint-disable-next-line no-console
            console.log('[SafeNavLink] click', {
                label: debugLabel || hrefString,
                href: hrefString,
                isModifierClick,
                button: event.button,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
            })
        }

        // Let browser handle new tabs / middle-clicks
        if (isModifierClick) {
            return
        }

        event.preventDefault()

        try {
            router.push(hrefString)
        } catch (error) {
            if (isDebug) {
                // eslint-disable-next-line no-console
                console.error('[SafeNavLink] router.push failed, falling back to hard navigation', {
                    href: hrefString,
                    error,
                })
            }
            if (typeof window !== 'undefined') {
                window.location.href = hrefString
            }
        }

        // Safety net: if router.push didn't change location within a short time,
        // fall back to a hard navigation so links never feel "dead".
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                const afterHref = window.location.href
                if (beforeHref && afterHref === beforeHref) {
                    if (isDebug) {
                        // eslint-disable-next-line no-console
                        console.warn('[SafeNavLink] Fallback navigation triggered', {
                            href: hrefString,
                            beforeHref,
                            afterHref,
                        })
                    }
                    window.location.href = hrefString
                }
            }, 700)
        }
    }

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={className}
            {...rest}
        >
            {children}
        </Link>
    )
}
