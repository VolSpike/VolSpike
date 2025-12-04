import { Loader2, Zap } from 'lucide-react'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg'
    text?: string
    variant?: 'default' | 'brand'
}

export function LoadingSpinner({ 
    size = 'md', 
    text,
    variant = 'default' 
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    }

    return (
        <div className="flex flex-col items-center justify-center p-8 gap-4">
            {variant === 'brand' ? (
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-xl animate-pulse-glow" />
                    <div className={`relative ${sizeClasses[size]} rounded-full bg-brand-500/10 dark:bg-brand-400/20 flex items-center justify-center border-2 border-brand-500/30 animate-spin`}>
                        <Zap className="h-1/2 w-1/2 text-brand-600 dark:text-brand-400 fill-brand-600 dark:fill-brand-400" />
                    </div>
                </div>
            ) : (
                <Loader2 className={`${sizeClasses[size]} animate-spin text-brand-500`} />
            )}
            {text && (
                <p className="text-sm text-muted-foreground animate-pulse">
                    {text}
                </p>
            )}
        </div>
    )
}
