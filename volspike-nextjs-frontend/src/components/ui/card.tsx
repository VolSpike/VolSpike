import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-xl border",
            // Colored background with subtle gradient tint
            "bg-gradient-to-br from-white/95 via-card to-brand-50/40",
            "dark:from-slate-900/95 dark:via-card dark:to-brand-950/30",
            "text-card-foreground",
            // Enhanced shadows with brand color tint
            "shadow-lg shadow-brand-500/8 dark:shadow-brand-500/15",
            "border-brand-200/30 dark:border-brand-900/30",
            // Glassmorphism
            "backdrop-blur-sm",
            // Hover effects with more color
            "hover:shadow-xl hover:shadow-brand-500/15 dark:hover:shadow-brand-500/25",
            "hover:border-brand-300/50 dark:hover:border-brand-800/50",
            "hover:from-white via-brand-50/20 hover:to-brand-50/50",
            "dark:hover:from-slate-900 dark:hover:via-brand-950/20 dark:hover:to-brand-950/40",
            "transition-all duration-300",
            "relative overflow-hidden",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0 relative z-10", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }