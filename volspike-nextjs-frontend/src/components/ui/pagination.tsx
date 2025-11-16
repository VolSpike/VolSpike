import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    isLoading?: boolean
    className?: string
    showPageNumbers?: boolean
    maxVisiblePages?: number
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    isLoading = false,
    className,
    showPageNumbers = true,
    maxVisiblePages = 7,
}: PaginationProps) {
    // Generate page numbers to display with smart ellipsis placement
    const getPageNumbers = (): (number | 'ellipsis')[] => {
        if (totalPages <= maxVisiblePages) {
            // Show all pages if total is less than max visible
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }

        const pages: (number | 'ellipsis')[] = []
        const halfVisible = Math.floor(maxVisiblePages / 2)

        if (currentPage <= halfVisible + 2) {
            // Near the beginning: show first pages, ellipsis, last page
            for (let i = 1; i <= maxVisiblePages - 2; i++) {
                pages.push(i)
            }
            if (maxVisiblePages - 1 < totalPages) {
                pages.push('ellipsis')
            }
            pages.push(totalPages)
        } else if (currentPage >= totalPages - halfVisible - 1) {
            // Near the end: show first page, ellipsis, last pages
            pages.push(1)
            if (totalPages - (maxVisiblePages - 2) > 2) {
                pages.push('ellipsis')
            }
            for (let i = totalPages - (maxVisiblePages - 3); i <= totalPages; i++) {
                pages.push(i)
            }
        } else {
            // In the middle: show first page, ellipsis, current ±1, ellipsis, last page
            pages.push(1)
            if (currentPage - 2 > 2) {
                pages.push('ellipsis')
            }
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
                pages.push(i)
            }
            if (currentPage + 2 < totalPages - 1) {
                pages.push('ellipsis')
            }
            pages.push(totalPages)
        }

        return pages
    }

    const pageNumbers = getPageNumbers()

    const handlePageClick = (page: number) => {
        if (page !== currentPage && page >= 1 && page <= totalPages && !isLoading) {
            onPageChange(page)
        }
    }

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <div className="flex items-center gap-1 sm:gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageClick(currentPage - 1)}
                    disabled={currentPage <= 1 || isLoading}
                    className="h-9 w-9 p-0 shrink-0"
                    aria-label="Go to previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {showPageNumbers && (
                    <div className="flex items-center gap-1">
                        {pageNumbers.map((page, index) => {
                            if (page === 'ellipsis') {
                                return (
                                    <div
                                        key={`ellipsis-${index}`}
                                        className="flex h-9 w-9 items-center justify-center shrink-0"
                                    >
                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )
                            }

                            const isCurrentPage = page === currentPage

                            return (
                                <Button
                                    key={page}
                                    variant={isCurrentPage ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handlePageClick(page)}
                                    disabled={isLoading}
                                    className={cn(
                                        'h-9 min-w-[36px] px-3 shrink-0 transition-all',
                                        isCurrentPage &&
                                            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
                                        !isCurrentPage && 'hover:bg-muted hover:border-border'
                                    )}
                                    aria-label={`Go to page ${page}`}
                                    aria-current={isCurrentPage ? 'page' : undefined}
                                >
                                    {page}
                                </Button>
                            )
                        })}
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageClick(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                    className="h-9 w-9 p-0 shrink-0"
                    aria-label="Go to next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

interface PaginationInfoProps {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    className?: string
}

export function PaginationInfo({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    className,
}: PaginationInfoProps) {
    const start = (currentPage - 1) * itemsPerPage + 1
    const end = Math.min(currentPage * itemsPerPage, totalItems)

    return (
        <div className={cn('text-sm text-muted-foreground', className)}>
            Showing <span className="font-medium text-foreground">{start}</span> to{' '}
            <span className="font-medium text-foreground">{end}</span> of{' '}
            <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> users
        </div>
    )
}

