'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()

    return (
        <TooltipProvider delayDuration={700}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="h-9 w-9 rounded-full hover:bg-accent transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label="Toggle theme"
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-200 ease-smooth dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-200 ease-smooth dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent 
                    side="bottom" 
                    className="bg-popover/95 backdrop-blur-sm border-border/50 text-xs"
                >
                    <p>Toggle {theme === 'light' ? 'dark' : 'light'} mode</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
