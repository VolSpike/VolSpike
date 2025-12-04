import React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
    children: React.ReactNode
    className?: string
}

export function Avatar({ children, className }: AvatarProps) {
    return (
        <div className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}>
            {children}
        </div>
    )
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string
    alt?: string
}

export function AvatarImage({ src, alt, ...props }: AvatarImageProps) {
    return <img src={src} alt={alt} className="aspect-square h-full w-full" {...props} />
}

interface AvatarFallbackProps {
    children: React.ReactNode
    className?: string
}

export function AvatarFallback({ children, className }: AvatarFallbackProps) {
    return (
        <div className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}>
            {children}
        </div>
    )
}
