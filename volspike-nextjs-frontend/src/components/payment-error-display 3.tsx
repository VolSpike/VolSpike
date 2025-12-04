'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { XCircle, AlertTriangle, Info, RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaymentErrorDisplayProps {
  error: string
  onRetry?: () => void
  className?: string
}

export function PaymentErrorDisplay({ error, onRetry, className }: PaymentErrorDisplayProps) {
  // Parse error type for better UX
  const isMinimumAmountError = error.toLowerCase().includes('minimum') || 
                               error.toLowerCase().includes('less than minimal')
  const isCurrencyError = error.toLowerCase().includes('currency') || 
                          error.toLowerCase().includes('pay_currency')
  const isCurrencyFormatError = isCurrencyError && error.toLowerCase().includes('alpha-numeric')
  const isNetworkError = error.toLowerCase().includes('network') || 
                         error.toLowerCase().includes('fetch') ||
                         error.toLowerCase().includes('connection')
  const isAuthError = error.toLowerCase().includes('authentication') || 
                      error.toLowerCase().includes('unauthorized') ||
                      error.toLowerCase().includes('api key')

  // Extract helpful information
  const getErrorDetails = () => {
    if (isMinimumAmountError) {
      const amountMatch = error.match(/\$?(\d+\.?\d*)/)
      const minAmount = amountMatch ? amountMatch[1] : '5'
      return {
        title: 'Payment Amount Too Low',
        description: `The payment amount is below NowPayments' minimum requirement. Please use at least $${minAmount} for this currency.`,
        icon: AlertTriangle,
        variant: 'warning' as const,
      }
    }
    
    if (isCurrencyError) {
      if (isCurrencyFormatError) {
        return {
          title: 'Payment Currency Formatting Issue',
          description: 'The payment provider rejected this currency code due to formatting. Please refresh this page and try again, or pick a different currency (USDT on Solana is recommended).',
          icon: XCircle,
          variant: 'destructive' as const,
        }
      }

      return {
        title: 'Invalid Currency',
        description: 'The selected payment currency is not supported or invalid. Please try selecting a different currency.',
        icon: XCircle,
        variant: 'destructive' as const,
      }
    }
    
    if (isNetworkError) {
      return {
        title: 'Connection Error',
        description: 'Unable to connect to the payment service. Please check your internet connection and try again.',
        icon: AlertTriangle,
        variant: 'warning' as const,
      }
    }
    
    if (isAuthError) {
      return {
        title: 'Authentication Error',
        description: 'There was an issue authenticating with the payment service. Please try signing in again.',
        icon: XCircle,
        variant: 'destructive' as const,
      }
    }
    
    return {
      title: 'Payment Error',
      description: error,
      icon: XCircle,
      variant: 'destructive' as const,
    }
  }

  const errorDetails = getErrorDetails()
  const Icon = errorDetails.icon

  return (
    <div className={cn('space-y-3', className)}>
      <Alert 
        variant={errorDetails.variant === 'destructive' ? 'destructive' : 'default'}
        className={cn(
          'border-2',
          errorDetails.variant === 'destructive' && 'border-red-500/50 bg-gradient-to-r from-red-500/10 via-red-500/5 to-amber-500/10',
          errorDetails.variant === 'warning' && 'border-yellow-500/50 bg-yellow-500/10'
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className={cn(
            'h-5 w-5 mt-0.5 flex-shrink-0',
            errorDetails.variant === 'destructive' && 'text-red-500',
            errorDetails.variant === 'warning' && 'text-yellow-500'
          )} />
          <div className="flex-1 space-y-2">
            <AlertTitle className={cn(
              'font-semibold',
              errorDetails.variant === 'destructive' && 'text-red-700 dark:text-red-400',
              errorDetails.variant === 'warning' && 'text-yellow-700 dark:text-yellow-400'
            )}>
              {errorDetails.title}
            </AlertTitle>
            <AlertDescription className={cn(
              'text-sm',
              errorDetails.variant === 'destructive' && 'text-red-600 dark:text-red-300',
              errorDetails.variant === 'warning' && 'text-yellow-600 dark:text-yellow-300'
            )}>
              {errorDetails.description}
            </AlertDescription>
            
            {/* Collapsible technical details for advanced debugging */}
            {error && (
              <details className="mt-3">
                <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto">
                  {error}
                </pre>
              </details>
            )}
          </div>
        </div>
      </Alert>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant={errorDetails.variant === 'destructive' ? 'destructive' : 'default'}
            className="flex-1"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Page
        </Button>
      </div>

      {/* Helpful Info */}
      {isMinimumAmountError && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
            <strong>Tip:</strong> Different cryptocurrencies have different minimum amounts. 
            USDT on Solana typically requires at least $2-3, while others may require more.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
