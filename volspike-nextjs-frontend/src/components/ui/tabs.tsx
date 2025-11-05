import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            "flex h-12 items-center justify-center rounded-xl p-1",
            // Vibrant gradient background with color tints
            "bg-gradient-to-br from-brand-50/60 via-slate-100/80 to-secondary-50/60",
            "dark:from-brand-950/40 dark:via-slate-800/80 dark:to-secondary-950/40",
            "backdrop-blur-md",
            // Colored border and shadow
            "border border-brand-200/40 dark:border-brand-800/40",
            "shadow-md shadow-brand-500/10 dark:shadow-brand-500/20",
            // Ensure proper containment
            "w-full max-w-full",
            className
        )}
        {...props}
    />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2",
            "text-sm font-semibold transition-all duration-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            "disabled:pointer-events-none disabled:opacity-50",
            "flex-1", // Equal width distribution
            // Inactive state - subtle and blended
            "text-slate-600 dark:text-slate-400",
            "hover:text-slate-900 dark:hover:text-slate-100",
            "hover:bg-white/50 dark:hover:bg-slate-800/50",
            // Active state - clean and refined
            "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900",
            "data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400",
            "data-[state=active]:shadow-sm data-[state=active]:shadow-brand-500/10",
            "dark:data-[state=active]:shadow-brand-500/20",
            className
        )}
        {...props}
    />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-800",
            className
        )}
        {...props}
    />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
