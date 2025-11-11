'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const primaryLinks = [
    { href: '/pricing', label: 'Pricing' },
    { href: '/donate', label: 'Donate' },
    { href: '/docs', label: 'Docs' },
    { href: '/support', label: 'Support' },
]

const secondaryLinks = [
    { href: '/legal/privacy', label: 'Privacy' },
    { href: '/legal/terms', label: 'Terms' },
    { href: '/legal/refunds', label: 'Refund & Cancellation' },
    { href: '/status', label: 'Status' },
]

export function Footer() {
    const currentYear = new Date().getFullYear()
    const { resolvedTheme } = useTheme()
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isAuthRoute = pathname?.startsWith('/auth')
    const isDarkMode = isAuthRoute || (mounted ? resolvedTheme === 'dark' : false)

    const footerClasses = cn(
        'border-t backdrop-blur transition-colors duration-200',
        isDarkMode
            ? 'border-white/10 bg-slate-950/90 text-slate-200'
            : 'border-slate-200 bg-white/90 text-slate-800'
    )

    const descriptionClass = isDarkMode ? 'text-slate-400' : 'text-slate-600'
    const sectionHeadingClass = cn(
        'text-xs font-semibold uppercase tracking-wider',
        isDarkMode ? 'text-slate-400' : 'text-slate-500'
    )
    const linkClass = cn(
        'transition-colors',
        isDarkMode ? 'text-slate-200/80 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'
    )
    const bottomRowClass = cn(
        'mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between',
        isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
    )
    const taglineClass = isDarkMode ? 'text-slate-500' : 'text-slate-600'

    return (
        <footer className={footerClasses}>
            <div className="container mx-auto px-4 py-10">
                <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-4 max-w-sm">
                        <Link href="/" className="flex items-center gap-3">
                            <Image
                                src="/volspike-logo.svg"
                                alt="VolSpike logo"
                                width={40}
                                height={40}
                                className="h-10 w-10"
                            />
                            <span className="text-xl font-semibold tracking-tight">VolSpike</span>
                        </Link>
                        <p className={cn('text-sm leading-relaxed', descriptionClass)}>
                            Precision tools for Binance perpetual futures traders. Monitor real-time volume
                            spikes, unlock advanced funding analytics, and stay a step ahead of the market.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-sm lg:flex lg:items-start lg:gap-14">
                        <div className="min-w-[140px]">
                            <h3 className={sectionHeadingClass}>
                                Platform
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {primaryLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href} className={linkClass}>
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="min-w-[140px]">
                            <h3 className={sectionHeadingClass}>
                                Company
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {secondaryLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href} className={linkClass}>
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className={bottomRowClass}>
                    <span>© {currentYear} VolSpike Labs. All rights reserved.</span>
                    <span className={taglineClass}>
                        Crafted for high-volatility markets
                    </span>
                </div>
            </div>
        </footer>
    )
}
