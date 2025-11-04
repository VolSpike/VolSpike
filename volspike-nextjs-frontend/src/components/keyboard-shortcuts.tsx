'use client'

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export function KeyboardShortcuts() {
    const [open, setOpen] = useState(false)

    // Show shortcuts with ?
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                // Only trigger if not in input/textarea
                const target = e.target as HTMLElement
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return
                }
                e.preventDefault()
                setOpen((open) => !open)
            }
            // Esc to close
            if (e.key === 'Escape' && open) {
                setOpen(false)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [open])

    const shortcuts = [
        {
            category: 'General',
            items: [
                { keys: ['⌘', 'K'], description: 'Open command palette', mac: true },
                { keys: ['Ctrl', 'K'], description: 'Open command palette', mac: false },
                { keys: ['?'], description: 'Show keyboard shortcuts' },
                { keys: ['Esc'], description: 'Close dialog / modal' },
            ]
        },
        {
            category: 'Navigation',
            items: [
                { keys: ['G', 'D'], description: 'Go to Dashboard' },
                { keys: ['G', 'A'], description: 'Go to Alerts' },
                { keys: ['G', 'W'], description: 'Go to Watchlist' },
                { keys: ['G', 'S'], description: 'Go to Settings' },
            ]
        },
        {
            category: 'Actions',
            items: [
                { keys: ['/'], description: 'Focus search' },
                { keys: ['N'], description: 'Create new alert' },
                { keys: ['S'], description: 'Add to watchlist' },
            ]
        },
        {
            category: 'Table',
            items: [
                { keys: ['↑', '↓'], description: 'Navigate rows' },
                { keys: ['Enter'], description: 'Open detail view' },
                { keys: ['Tab'], description: 'Navigate cells' },
            ]
        }
    ]

    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

    return (
        <>
            {/* Keyboard hint - compact by default, expands on hover */}
            <div className="fixed bottom-4 right-4 z-40 hidden lg:block">
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-2 px-2 py-2 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md hover:bg-muted hover:rounded-lg hover:px-3 transition-all duration-200 text-xs text-muted-foreground group"
                >
                    <span className="hidden group-hover:inline-block group-hover:text-foreground transition-colors whitespace-nowrap">
                        Keyboard shortcuts
                    </span>
                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-background border border-border/50 text-[11px] font-semibold text-foreground">
                        ?
                    </div>
                </button>
            </div>

            {/* Shortcuts Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-h2">Keyboard Shortcuts</DialogTitle>
                        <DialogDescription>
                            Speed up your workflow with these keyboard shortcuts
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {shortcuts.map((section) => (
                            <div key={section.category}>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                    {section.category}
                                </h3>
                                <div className="space-y-2">
                                    {section.items.map((shortcut, index) => {
                                        // Skip if platform-specific
                                        if (shortcut.mac !== undefined && shortcut.mac !== isMac) {
                                            return null
                                        }
                                        
                                        return (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="text-sm text-foreground">
                                                    {shortcut.description}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {shortcut.keys.map((key, keyIndex) => (
                                                        <React.Fragment key={keyIndex}>
                                                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border/50 rounded shadow-sm font-mono">
                                                                {key}
                                                            </kbd>
                                                            {keyIndex < shortcut.keys.length - 1 && (
                                                                <span className="text-muted-foreground text-xs">+</span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30 text-xs text-muted-foreground">
                        <p>
                            <strong className="text-foreground">Tip:</strong> Most dialogs and modals can be closed by pressing <kbd className="px-1.5 py-0.5 bg-background border border-border/50 rounded font-mono">Esc</kbd>
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

