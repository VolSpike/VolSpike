'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Copy, Check, AlertCircle, ExternalLink, QrCode, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'
import { PaymentProgress } from '@/components/payment-progress'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PaymentDetails {
  paymentId: string
  payAddress: string
  payAmount: number
  payAmountString?: string // Full precision string version from backend
  payCurrency: string
  priceAmount: number
  priceCurrency: string
  paymentStatus: string
  orderId: string
  tier: string
  bufferInfo?: {
    applied: boolean
    percentage: string
    baseAmount: number
    bufferedAmount: number
  } | null
}

export default function CryptoPaymentPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('paymentId')
  const debugMode = process.env.NODE_ENV === 'development' || searchParams.get('debug') === 'true'

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const safeNavigate = useCallback(
    (href: string, source: string) => {
      const isDebug =
        process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('debugNav') === 'true')

      const beforeHref =
        typeof window !== 'undefined' ? window.location.href : null

      if (isDebug) {
        console.log('[CryptoPaymentPage] safeNavigate start', {
          href,
          source,
          beforeHref,
        })
      }

      try {
        router.push(href)
      } catch (error) {
        if (isDebug) {
          console.error('[CryptoPaymentPage] safeNavigate router.push error', {
            href,
            source,
            error,
          })
        }
        if (typeof window !== 'undefined') {
          window.location.href = href
        }
        return
      }

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          const afterHref = window.location.href
          if (beforeHref && afterHref === beforeHref) {
            if (isDebug) {
              console.warn('[CryptoPaymentPage] safeNavigate fallback triggered', {
                href,
                source,
                beforeHref,
                afterHref,
              })
            }
            window.location.href = href
          }
        }, 700)
      }
    },
    [router]
  )

  // Debug: Log page structure on mount
  useEffect(() => {
    if (debugMode) {
      const logDebugInfo = () => {
        const header = document.querySelector('header')
        const footer = document.querySelector('footer')
        const main = document.querySelector('main')
        
        console.log('🔍 [CryptoPaymentPage] Page structure debug:', {
          header: header ? {
            element: header,
            zIndex: window.getComputedStyle(header).zIndex,
            pointerEvents: window.getComputedStyle(header).pointerEvents,
            position: window.getComputedStyle(header).position,
          } : null,
          footer: footer ? {
            element: footer,
            zIndex: window.getComputedStyle(footer).zIndex,
            pointerEvents: window.getComputedStyle(footer).pointerEvents,
            position: window.getComputedStyle(footer).position,
          } : null,
          main: main ? {
            element: main,
            zIndex: window.getComputedStyle(main).zIndex,
          } : null,
          headerLinks: Array.from(document.querySelectorAll('header a')).map(a => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent?.trim(),
            pointerEvents: window.getComputedStyle(a).pointerEvents,
            zIndex: window.getComputedStyle(a).zIndex,
          })),
          footerLinks: Array.from(document.querySelectorAll('footer a')).map(a => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent?.trim(),
            pointerEvents: window.getComputedStyle(a).pointerEvents,
            zIndex: window.getComputedStyle(a).zIndex,
          })),
        })
      }
      
      // Log immediately and after a short delay (to catch async rendering)
      logDebugInfo()
      setTimeout(logDebugInfo, 1000)

      setTimeout(() => {
        const headerLink = document.querySelector('header nav a[href="/pricing"]') as HTMLElement | null
        if (headerLink) {
          const rect = headerLink.getBoundingClientRect()
          const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          console.log('🔍 [Debug] Header Pricing elementFromPoint:', {
            target: el,
            targetTag: el?.tagName,
            targetClasses: el?.className,
            targetZIndex: el ? window.getComputedStyle(el).zIndex : null,
            headerRect: rect,
            headerPointerEvents: window.getComputedStyle(headerLink).pointerEvents,
          })
        }

        const footerLink = document.querySelector('footer a[href="/legal/privacy"]') as HTMLElement | null
        if (footerLink) {
          const rect = footerLink.getBoundingClientRect()
          const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          console.log('🔍 [Debug] Footer Privacy elementFromPoint:', {
            target: el,
            targetTag: el?.tagName,
            targetClasses: el?.className,
            targetZIndex: el ? window.getComputedStyle(el).zIndex : null,
            footerRect: rect,
            footerPointerEvents: window.getComputedStyle(footerLink).pointerEvents,
          })
        }
      }, 1500)
    }
  }, [debugMode])

  // Generate Solana Pay URI (wallet-agnostic transfer request)
  // Solana Pay spec: solana:<address>?amount=<decimal>&spl-token=<mint>&label=<label>&message=<message>
  // IMPORTANT: This is the only officially documented, QR-friendly payment format that Phantom supports.
  const { solanaUri, phantomDeepLink, phantomUniversalLink } = useMemo(() => {
    if (!paymentDetails?.payAddress || !paymentDetails?.payAmount) {
      return { solanaUri: null, phantomDeepLink: null, phantomUniversalLink: null }
    }

    try {
      const currency = paymentDetails.payCurrency?.toLowerCase() || ''
      const isSOL = currency === 'sol'
      const isUSDT = currency.includes('usdt')
      const isUSDC = currency.includes('usdc')

      // SPL Token mint addresses (Solana mainnet)
      const SPL_TOKEN_MINTS: Record<string, string> = {
        'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
        'usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
      }

      // Amount formatting - remove trailing zeros for cleaner URLs
      let amountDecimal: string
      let splTokenMint: string | null = null

      if (isSOL) {
        // SOL: up to 9 decimals, remove trailing zeros
        amountDecimal = paymentDetails.payAmount.toFixed(9).replace(/\.?0+$/, '')
      } else if (isUSDT) {
        // USDT: CRITICAL - Use 6 decimals (token standard), not 9!
        // Phantom rejects transactions with more than 6 decimals for USDT
        // This was causing "Failed to generate a valid transaction" error
        if (paymentDetails.payAmountString) {
          // Parse and limit to 6 decimals (USDT standard)
          const parsed = parseFloat(paymentDetails.payAmountString)
          amountDecimal = parsed.toFixed(6).replace(/\.?0+$/, '')
          console.log('[CryptoPaymentPage] USDT amount formatting (6 decimals):', {
            payAmountString: paymentDetails.payAmountString,
            payAmountNumber: paymentDetails.payAmount,
            formatted: amountDecimal,
            decimalPlaces: amountDecimal.includes('.') ? amountDecimal.split('.')[1].length : 0,
            note: 'USDT on Solana uses 6 decimals - limiting to 6 to prevent transaction errors',
          })
        } else {
          // Fallback: Use number version with 6 decimals (USDT standard)
          amountDecimal = paymentDetails.payAmount.toFixed(6).replace(/\.?0+$/, '')
          console.warn('[CryptoPaymentPage] payAmountString not available, using number version (6 decimals):', {
            payAmount: paymentDetails.payAmount,
            formatted: amountDecimal,
            note: 'USDT on Solana uses 6 decimals - using toFixed(6)',
          })
        }
        splTokenMint = SPL_TOKEN_MINTS.usdt
      } else if (isUSDC) {
        // USDC: CRITICAL - Use 6 decimals (token standard), not 9!
        // Phantom rejects transactions with more than 6 decimals for USDC
        if (paymentDetails.payAmountString) {
          const parsed = parseFloat(paymentDetails.payAmountString)
          amountDecimal = parsed.toFixed(6).replace(/\.?0+$/, '')
        } else {
          amountDecimal = paymentDetails.payAmount.toFixed(6).replace(/\.?0+$/, '')
        }
        splTokenMint = SPL_TOKEN_MINTS.usdc
      } else {
        // For other tokens, use raw decimal string with full precision
        amountDecimal = paymentDetails.payAmount.toString()
      }
      
      // CRITICAL: Validate amount is a valid positive number
      const parsedAmount = parseFloat(amountDecimal)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.error('[CryptoPaymentPage] Invalid amount:', {
          original: paymentDetails.payAmount,
          formatted: amountDecimal,
          parsed: parsedAmount,
        })
        throw new Error('Invalid payment amount')
      }
      
      // CRITICAL: Don't re-parse and convert - this can lose precision!
      // Keep the original amountDecimal string as-is to preserve all decimal places

      // CRITICAL: Validate payAddress is a valid Solana address format
      // Invalid addresses cause Phantom to fail with "Failed to generate a valid transaction"
      // Solana addresses are base58 encoded, 32-44 characters
      const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      const addressValid = solanaAddressRegex.test(paymentDetails.payAddress)
      
      console.log('[CryptoPaymentPage] Address validation:', {
        address: paymentDetails.payAddress,
        addressLength: paymentDetails.payAddress.length,
        isValid: addressValid,
        firstChar: paymentDetails.payAddress[0],
        lastChar: paymentDetails.payAddress[paymentDetails.payAddress.length - 1],
        containsInvalidChars: /[0OIl]/.test(paymentDetails.payAddress), // Base58 excludes these
      })
      
      if (!addressValid) {
        console.error('[CryptoPaymentPage] ❌ Invalid Solana address format:', {
          address: paymentDetails.payAddress,
          length: paymentDetails.payAddress.length,
          reason: 'Address does not match Solana base58 format (32-44 characters)',
          note: 'This will cause Phantom to fail with "Failed to generate a valid transaction"',
        })
        // Don't throw - let it try anyway, but log the error
        // Some valid addresses might not match the regex perfectly
      }

      // Build Solana Pay URI (standard format - supported by Phantom and other wallets)
      // CRITICAL: Amount must come first and always be included
      const params = new URLSearchParams()
      
      // Amount is always required and should be first
      // CRITICAL: Use the exact string to preserve precision - don't let URLSearchParams convert it
      params.append('amount', amountDecimal)
      
      // SPL token mint address (only for tokens, not SOL)
      // FIXED: Removed redundant !isSOL check - splTokenMint is already null for SOL
      if (splTokenMint) {
        params.append('spl-token', splTokenMint)
      }
      
      // Optional metadata (helps with UX)
      // URLSearchParams handles encoding automatically
      params.append('label', 'VolSpike Payment')
      params.append('message', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)
      
      // Reference for tracking (optional) - CRITICAL FIX
      // Reference MUST be a valid Solana public key (base58, 32-44 chars)
      // Most orderIds are UUIDs or database IDs, NOT valid Solana keys
      // Including an invalid reference causes Phantom to reject the entire URI
      if (paymentDetails.orderId) {
        // Validate that orderId is a valid Solana public key format
        const isValidSolanaKey = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(paymentDetails.orderId)
        if (isValidSolanaKey) {
          params.append('reference', paymentDetails.orderId)
        } else {
          // Log warning but don't break the payment flow
          console.warn('[CryptoPaymentPage] Skipping invalid reference (not a valid Solana public key):', {
            orderId: paymentDetails.orderId,
            reason: 'OrderId is not a valid Solana base58 public key format',
            note: 'Reference is optional - payment will work without it',
          })
        }
      }

      // CRITICAL: Verify amount parameter before building URI
      const amountParam = params.get('amount')
      if (!amountParam || amountParam !== amountDecimal) {
        console.error('[CryptoPaymentPage] ❌ Amount parameter mismatch!', {
          expected: amountDecimal,
          actual: amountParam,
          paramsString: params.toString(),
        })
      }
      
      const solanaPayUri = `solana:${paymentDetails.payAddress}?${params.toString()}`
      
      // Parse the URI to verify amount is preserved correctly
      const uriParams = new URLSearchParams(solanaPayUri.split('?')[1] || '')
      const uriAmount = uriParams.get('amount')
      
      // Comprehensive debug logging
      console.log('[CryptoPaymentPage] ✅ Generated Solana Pay URI:', {
        fullUri: solanaPayUri,
        address: paymentDetails.payAddress,
        originalAmount: paymentDetails.payAmount,
        formattedAmount: amountDecimal,
        amountInParams: amountParam,
        amountInURI: uriAmount,
        amountPreserved: uriAmount === amountDecimal,
        currency: currency,
        isSOL: isSOL,
        splToken: splTokenMint || 'none (native SOL)',
        paramsObject: Object.fromEntries(params),
        uriLength: solanaPayUri.length,
        // Validation checks
        startsWithSolana: solanaPayUri.startsWith('solana:'),
        hasAddress: !!paymentDetails.payAddress,
        hasAmount: params.has('amount'),
        hasSplToken: params.has('spl-token'),
        hasReference: params.has('reference'),
        // Reference validation
        orderId: paymentDetails.orderId,
        referenceIncluded: params.has('reference'),
        // Amount precision check
        originalDecimalPlaces: paymentDetails.payAmount.toString().includes('.') 
          ? paymentDetails.payAmount.toString().split('.')[1].length 
          : 0,
        formattedDecimalPlaces: amountDecimal.includes('.') 
          ? amountDecimal.split('.')[1].length 
          : 0,
        uriDecimalPlaces: uriAmount?.includes('.') 
          ? uriAmount.split('.')[1].length 
          : 0,
      })
      
      // CRITICAL: Warn if amount precision was lost
      if (uriAmount && uriAmount !== amountDecimal) {
        console.error('[CryptoPaymentPage] ⚠️ Amount precision lost in URI!', {
          original: paymentDetails.payAmount,
          formatted: amountDecimal,
          inURI: uriAmount,
          difference: parseFloat(amountDecimal) - parseFloat(uriAmount || '0'),
        })
      }
      
      // Validate URI format
      try {
        // This will throw if the URI is malformed
        const testUrl = new URL(solanaPayUri)
        console.log('[CryptoPaymentPage] ✅ URI format validation passed:', {
          protocol: testUrl.protocol,
          pathname: testUrl.pathname,
          search: testUrl.search,
        })
      } catch (validationError) {
        console.error('[CryptoPaymentPage] ❌ URI format validation failed:', validationError)
      }
      
      // Phantom universal link (EXPERIMENTAL – not used for QR, may be used for future UX)
      // NOTE: Phantom does not currently document a "send" or "transfer" method; official deeplinks
      // are connect / signMessage / browse / fungible / swap. We keep this here only for potential
      // future experiments and logging, but do **not** rely on it for payment flows.
      const phantomParams = new URLSearchParams()
      phantomParams.set('recipient', paymentDetails.payAddress)
      phantomParams.set('amount', amountDecimal) // Use the same decimal format as Solana Pay
      
      // For SPL tokens, we need to check if Phantom supports token parameter in /send method
      // If not, we may need to use Solana Pay URI format instead
      if (splTokenMint && !isSOL) {
        // Try token parameter - if this doesn't work, we'll fall back to Solana Pay URI
        phantomParams.set('token', splTokenMint)
      }
      
      // Optional memo parameter (per Phantom docs)
      // phantomParams.set('memo', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)
      
      // Universal link (for logging / potential future use, not primary payment path)
      const phantomUniversalLinkUri = `https://phantom.app/ul/v1/send?${phantomParams.toString()}`
      // Deep link (fallback for direct button clicks)
      const phantomDeepLinkUri = phantomUniversalLinkUri.replace('https://phantom.app/ul/', 'phantom://ul/')
      
      // Comprehensive debug logging
      console.log('[CryptoPaymentPage] Generated Payment URIs:', {
        payAddress: paymentDetails.payAddress,
        payAmount: paymentDetails.payAmount,
        payCurrency: paymentDetails.payCurrency,
        isSOL,
        isUSDT,
        isUSDC,
        amountDecimal,
        splTokenMint,
        solanaPayUri: {
          uri: solanaPayUri,
          length: solanaPayUri.length,
          preview: solanaPayUri.substring(0, 80) + '...',
        params: Object.fromEntries(params),
          recommendedFor: 'QR codes (iOS camera scanner)',
        },
        phantomUniversalLinkUri: {
          uri: phantomUniversalLinkUri,
          length: phantomUniversalLinkUri.length,
          preview: phantomUniversalLinkUri.substring(0, 80) + '...',
          params: Object.fromEntries(phantomParams),
          recommendedFor: 'Button clicks (direct app opening)',
        },
        phantomDeepLinkUri: {
          uri: phantomDeepLinkUri,
          recommendedFor: 'Fallback button clicks',
        },
        // Verify format matches Solana Pay spec
        matchesSpec: {
          hasAddress: !!paymentDetails.payAddress,
          hasAmount: !!amountDecimal,
          hasSplToken: !isSOL && !!splTokenMint,
          amountFormat: 'decimal',
          solanaPayUriValid: solanaPayUri.startsWith('solana:'),
          phantomLinkValid: phantomUniversalLinkUri.startsWith('https://phantom.app/ul/v1/send'),
        },
      })

      return {
        solanaUri: solanaPayUri,
        phantomDeepLink: phantomDeepLinkUri,
        phantomUniversalLink: phantomUniversalLinkUri,
      }
    } catch (error) {
      console.error('[CryptoPaymentPage] Error generating payment URIs:', error)
      return { solanaUri: null, phantomDeepLink: null, phantomUniversalLink: null }
    }
  }, [paymentDetails])

  // Generate QR code – **Solana Pay transfer URL only**
  // This is the wallet-agnostic, officially documented way to trigger a prefilled payment.
  useEffect(() => {
    const uriForQR = solanaUri
    
    if (!uriForQR) {
      console.warn('[CryptoPaymentPage] No Solana Pay URI available for QR code generation', {
        hasSolanaUri: !!solanaUri,
        hasPhantomLink: !!phantomUniversalLink,
        paymentDetails: paymentDetails ? {
          hasAddress: !!paymentDetails.payAddress,
          hasAmount: !!paymentDetails.payAmount,
          currency: paymentDetails.payCurrency,
        } : null,
      })
      return
    }

    const usingPhantomLink = false
    console.log('[CryptoPaymentPage] Generating QR code', {
      usingPhantomUniversalLink: usingPhantomLink,
      usingSolanaPayUri: !usingPhantomLink,
      uri: uriForQR,
      uriLength: uriForQR.length,
      uriPreview: uriForQR.substring(0, 150) + (uriForQR.length > 150 ? '...' : ''),
      fullUri: uriForQR,
      // Show what will happen when scanned
      expectedBehavior: 'Solana Pay transfer URL – supported by Phantom and other Solana wallets',
      recommendation: '✅ Using Solana Pay URI as QR payload (wallet-agnostic, spec-compliant)',
      note: 'If multiple wallets are installed, the OS will offer a chooser for the solana: link.',
      // Parse and show parameters for debugging
      parsedParams: uriForQR.includes('?') ? Object.fromEntries(
        new URLSearchParams(uriForQR.split('?')[1] || '')
      ) : {},
    })

    QRCode.toDataURL(uriForQR, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M', // Medium error correction for better scanning
    })
      .then((url) => {
        console.log('[CryptoPaymentPage] QR code generated successfully', {
          uriLength: uriForQR.length,
          qrCodeSize: url.length,
          uriType: usingPhantomLink ? 'phantom-universal-link' : 'solana-pay',
          encodedUri: uriForQR,
          usingPhantomUniversalLink: usingPhantomLink,
          // Parse and log the URI structure for debugging
          parsedUri: usingPhantomLink ? {
            scheme: 'https',
            domain: 'phantom.app',
            path: '/ul/v1/send',
            params: Object.fromEntries(new URLSearchParams(uriForQR.split('?')[1] || '')),
          } : {
            scheme: 'solana',
            address: paymentDetails?.payAddress,
            params: Object.fromEntries(new URLSearchParams(uriForQR.split('?')[1] || '')),
          },
          // Compatibility check
          compatibility: usingPhantomLink 
            ? '✅ Best for Phantom\'s scanner - Universal links are designed specifically for Phantom'
            : '⚠️ Fallback format - Phantom universal link preferred',
          recommendation: 'Use Phantom\'s built-in scanner (Send → QR icon) - universal links work best',
          // Show exact parameters being sent
          parameters: Object.fromEntries(new URLSearchParams(uriForQR.split('?')[1] || '')),
        })
        setQrCodeDataUrl(url)
      })
      .catch((err) => {
        console.error('[CryptoPaymentPage] QR code generation error:', {
          error: err,
          uri: uriForQR,
          uriLength: uriForQR.length,
          stack: err instanceof Error ? err.stack : undefined,
        })
        toast.error('Failed to generate QR code')
      })
  }, [phantomUniversalLink, solanaUri, paymentDetails])

  // Fetch payment details
  useEffect(() => {
    if (!session?.user || !paymentId) {
      if (!session?.user) {
        router.push('/auth')
      }
      return
    }

    const fetchPaymentDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const authToken = (session as any)?.accessToken || session.user.id
        const response = await fetch(`${API_URL}/api/payments/nowpayments/payment/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `Failed to fetch payment details (${response.status})`)
        }

        const data = await response.json()
        setPaymentDetails(data)

        // Set timer (15 minutes)
        setTimeRemaining(15 * 60)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load payment details'
        console.error('[CryptoPaymentPage] Error:', err)
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentDetails()
  }, [session, paymentId, router])

  // Countdown timer with expiration handling
  useEffect(() => {
    if (timeRemaining === null) return

    if (timeRemaining <= 0) {
      if (!isExpired) {
        setIsExpired(true)
        // Check payment status one more time when timer expires
        if (paymentDetails && session?.user && paymentId) {
          const checkExpiredPayment = async () => {
            try {
              const authToken = (session as any)?.accessToken || session.user.id
              const response = await fetch(`${API_URL}/api/payments/nowpayments/payment/${paymentId}`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              })

              if (response.ok) {
                const data = await response.json()
                // If payment was completed, update state (don't show expired message)
                if (data.paymentStatus === 'finished') {
                  setIsExpired(false)
                  setPaymentDetails((prev) => prev ? { ...prev, ...data } : null)
                  setTimeout(() => {
                    router.push(`/checkout/success?payment=crypto&tier=${paymentDetails?.tier}`)
                  }, 2000)
                  return
                }
              }
            } catch (err) {
              console.error('[CryptoPaymentPage] Error checking expired payment:', err)
            }
            
            // Show expiration toast
            toast.error('Payment window expired. Please create a new payment.', {
              duration: 5000,
            })
          }
          checkExpiredPayment()
        }
      }
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, isExpired, paymentDetails, session, paymentId, router])

  // Poll payment status (every 10 seconds)
  // Uses status endpoint which automatically triggers upgrade if payment is finished
  useEffect(() => {
    if (!paymentDetails || !session?.user || polling) return

    // Only poll if payment is not finished
    if (paymentDetails.paymentStatus === 'finished' || paymentDetails.paymentStatus === 'failed') {
      return
    }

    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const authToken = (session as any)?.accessToken || session.user.id
        // Use status endpoint which triggers upgrade automatically if finished
        const response = await fetch(`${API_URL}/api/payments/nowpayments/status/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          // Update payment details with status info
          setPaymentDetails((prev) => prev ? { 
            ...prev, 
            paymentStatus: data.status,
            // Keep other fields from prev
          } : null)

          // If payment is finished and user was upgraded, redirect to success page
          if (data.status === 'finished' && data.upgraded) {
            // Refresh session to get new tier
            await updateSession()
            
            // Show success message before redirect
            toast.success(`Payment confirmed! Upgrading to ${paymentDetails.tier.toUpperCase()} tier...`, { duration: 3000 })
            
            setTimeout(() => {
              router.push(`/checkout/success?payment=crypto&tier=${paymentDetails.tier}`)
            }, 2000)
          } else if (data.status === 'finished') {
            // Payment finished but upgrade pending - refresh session and check again
            await updateSession()
            
            // Show success message
            toast.success('Payment confirmed! Upgrading your account...', { duration: 5000 })
          } else if (data.status === 'partially_paid') {
            // Show informative message about partially_paid status
            toast('Payment received! Waiting for blockchain confirmations...', {
              icon: '⏳',
              duration: 5000,
            })
          }
        }
      } catch (err) {
        console.error('[CryptoPaymentPage] Polling error:', err)
        // Don't show error toast for polling failures
      }
    }, 10000) // Poll every 10 seconds

    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [paymentDetails, session, paymentId, router, polling, updateSession])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const copyToClipboard = async (text: string, type: 'address' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success(`${type === 'address' ? 'Address' : 'Amount'} copied!`)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  const getCurrencyDisplayName = (currency: string): string => {
    const currencyMap: Record<string, string> = {
      'usdtsol': 'USDT',
      'usdterc20': 'USDT',
      'usdce': 'USDC',
      'sol': 'SOL',
      'btc': 'BTC',
      'eth': 'ETH',
    }
    return currencyMap[currency.toLowerCase()] || currency.toUpperCase()
  }

  const getNetworkName = (currency: string): string => {
    const normalized = currency.toLowerCase()
    if (normalized.includes('sol') || normalized === 'sol') {
      return 'Solana'
    }
    if (normalized.includes('erc20') || normalized.includes('eth') || normalized === 'eth') {
      return 'Ethereum'
    }
    if (normalized === 'btc') {
      return 'Bitcoin'
    }
    return 'Unknown'
  }

  const getFriendlyStatus = (status: string | undefined | null): { label: string; tone: 'default' | 'success' | 'warning' | 'danger' } => {
    if (!status) return { label: 'Waiting for payment', tone: 'default' }
    const normalized = status.toLowerCase()
    if (normalized === 'finished' || normalized === 'confirmed') {
      return { label: 'Payment confirmed on-chain', tone: 'success' }
    }
    if (normalized === 'failed' || normalized === 'expired' || normalized === 'refunded') {
      return { label: 'Payment could not be completed', tone: 'danger' }
    }
    if (normalized === 'partially_paid') {
      return { label: 'Payment received, confirming on blockchain', tone: 'warning' }
    }
    if (normalized === 'confirming' || normalized === 'sending') {
      return { label: 'Waiting for blockchain confirmations', tone: 'warning' }
    }
    return { label: 'Waiting for payment', tone: 'default' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sec-600 dark:text-sec-400 mb-4" />
              <p className="text-muted-foreground">Loading payment details...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error || !paymentDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-5 w-5" />
                <CardTitle>Payment Error</CardTitle>
              </div>
              <CardDescription>{error || 'Payment not found'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/pricing')} className="w-full">
                Back to Pricing
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const currencyDisplay = getCurrencyDisplayName(paymentDetails.payCurrency)
  const networkName = getNetworkName(paymentDetails.payCurrency)
  const usdAmount = paymentDetails.priceAmount
  const friendlyStatus = getFriendlyStatus(paymentDetails.paymentStatus)

  return (
    <>
      {/* Diagnostic overlay - only in dev mode with debug param */}
      {debugMode && typeof window !== 'undefined' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '2px solid red',
          }}
          onClick={(e) => {
            const element = document.elementFromPoint(e.clientX, e.clientY)
            console.log('🔍 Click intercepted at:', {
              x: e.clientX,
              y: e.clientY,
              element,
              elementTag: element?.tagName,
              elementClasses: element?.className,
              elementZIndex: element ? window.getComputedStyle(element).zIndex : null,
              elementPointerEvents: element ? window.getComputedStyle(element).pointerEvents : null,
              allElementsAtPoint: document.elementsFromPoint(e.clientX, e.clientY),
            })
          }}
        >
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'red', color: 'white', padding: '10px', zIndex: 100000 }}>
            DEBUG MODE: Click anywhere to see what element receives the click
          </div>
        </div>
      )}
      <div className="min-h-screen bg-background relative">
        <Header />
        <main className="container mx-auto px-4 py-10 max-w-2xl relative z-0">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sec-500">
                Crypto checkout
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                Scan &amp; confirm in Phantom
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Open Phantom on your phone, scan the QR code, and confirm. We&apos;ll upgrade your tier automatically once the payment lands on‑chain.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
              <span className="font-medium">Live status</span>
            </div>
          </div>

          <PaymentProgress status={paymentDetails.paymentStatus} isExpired={isExpired} />

          <Card className="relative z-0 overflow-hidden border-border/70 bg-gradient-to-b from-background via-background/95 to-background">
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5 text-sec-500" />
                    <span>{networkName} · {currencyDisplay}</span>
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      Pay with Phantom
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Use your wallet&apos;s <span className="font-medium text-foreground">Scan</span> feature to send the exact amount below.
                    </CardDescription>
                  </div>
                </div>

                {timeRemaining !== null && (
                  <div className="flex flex-col items-end gap-2 text-right text-xs sm:text-sm font-mono">
                    {isExpired ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-destructive font-semibold">
                          Payment window expired
                        </span>
                      </div>
                    ) : timeRemaining > 0 ? (
                      <>
                        <div className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1',
                          timeRemaining < 300
                            ? 'border-destructive/40 bg-destructive/10'
                            : 'border-border/60 bg-muted/40'
                        )}>
                          <Clock className={cn(
                            'h-3.5 w-3.5',
                            timeRemaining < 300 ? 'text-destructive' : 'text-muted-foreground'
                          )} />
                          <span className={cn(
                            'font-semibold tracking-tight',
                            timeRemaining < 300 && 'text-destructive'
                          )}>
                            {formatTime(timeRemaining)} left
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Address refreshes after this timer for security.
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pb-6">
              {/* Amount & status row */}
              <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Amount to pay
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-3xl font-bold tabular-nums">
                      {paymentDetails.payAmount.toFixed(8)}{' '}
                      <span className="text-base font-semibold text-muted-foreground">
                        {currencyDisplay}
                      </span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(paymentDetails.payAmount.toString(), 'amount')}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'amount' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ≈ ${usdAmount.toFixed(2)} USD · {networkName} network
                  </p>
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 p-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-sec-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Amount includes network fee buffer
                      </p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {paymentDetails.bufferInfo?.applied ? (
                          <>
                            The USD amount (${paymentDetails.priceAmount.toFixed(2)}) includes a <strong>{paymentDetails.bufferInfo.percentage} buffer</strong> over the minimum (${paymentDetails.bufferInfo.baseAmount.toFixed(2)} base + ${(paymentDetails.bufferInfo.bufferedAmount - paymentDetails.bufferInfo.baseAmount).toFixed(2)} buffer). This ensures your payment completes successfully even if network fees are higher than expected. The crypto amount shown above (${paymentDetails.payAmount.toFixed(8)} {currencyDisplay}) is converted from this buffered USD amount.
                          </>
                        ) : (
                          <>
                            The payment amount includes a 20% buffer to cover blockchain network fees. The USD amount (${paymentDetails.priceAmount.toFixed(2)}) includes this buffer before conversion to crypto. This ensures your payment completes successfully even if fees are higher than expected. You&apos;ll only pay the actual amount sent, and any excess covers transaction costs.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 text-xs">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Payment status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-2 w-2 rounded-full',
                        friendlyStatus.tone === 'success' && 'bg-emerald-400',
                        friendlyStatus.tone === 'warning' && 'bg-amber-400',
                        friendlyStatus.tone === 'danger' && 'bg-destructive',
                        friendlyStatus.tone === 'default' && 'bg-sec-400'
                      )}
                    />
                    <span className="text-[13px] font-medium">
                      {friendlyStatus.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This page auto-updates. You can safely switch apps while waiting for confirmations.
                  </p>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative rounded-2xl border border-border/60 bg-background/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-sec-500/25 opacity-80 blur-sm" />
                    <div className="relative bg-white p-3 rounded-xl border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeDataUrl}
                        alt="Payment QR Code"
                        className="h-64 w-64"
                      />
                    </div>
                  </div>
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-2">How to scan:</p>
                      <div className="space-y-1.5 text-left">
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">Option A:</span>
                          <span>
                            <strong>iPhone Camera</strong> (Easiest & Preferred):
                            <br />
                            <span className="text-[11px]">Open Camera app → Point at QR code → Tap notification banner → Phantom opens with prepopulated payment</span>
                            <br />
                            <span className="text-[11px] text-muted-foreground">Android: Open Phantom app → Tap &quot;Scan&quot; → Point at QR code</span>
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">Option B:</span>
                          <span>
                            <strong>Use Phantom&apos;s built-in scanner:</strong>
                            <br />
                            <span className="text-[11px]">Open Phantom → Tap &quot;Send&quot; → Tap QR icon → Scan this code</span>
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="font-bold text-sec-500">Option C:</span>
                          <span>
                            <strong>Manual entry:</strong> Copy address and amount below, paste into Phantom manually
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/30 space-y-2">
                      <Button
                        onClick={() => {
                          // Open Phantom app - user can then use the scanner
                          const targetUri = phantomDeepLink || phantomUniversalLink || solanaUri
                          if (targetUri) {
                            try {
                              window.open(targetUri, '_blank', 'noopener,noreferrer')
                              toast.success('Opening Phantom... Use the Send → QR scanner to scan the code above', { duration: 5000 })
                            } catch (err) {
                              toast.error('Please open Phantom manually and use the scanner')
                            }
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <QrCode className="mr-2 h-3.5 w-3.5" />
                        Open Phantom & Use Scanner
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        💡 <strong>Best method:</strong> Use iPhone Camera (Option A) for the easiest and most reliable experience.
                      </p>
                    </div>
                  </div>

                  {/* Debug info (dev / debug mode) */}
                  {debugMode && (phantomUniversalLink || solanaUri) && (
                    <div className="w-full space-y-3 rounded-lg border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔍</span>
                        <p className="text-sm font-semibold text-foreground">
                          Debug: QR Code Analysis
                        </p>
                      </div>
                      <div className="space-y-3">
                        {/* QR Code URI Type */}
                        <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              QR Code Format
                            </p>
                            {phantomUniversalLink && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                <span>✓</span>
                                <span>Phantom Universal Link</span>
                              </span>
                            )}
                            {!phantomUniversalLink && solanaUri && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                <span>⚠</span>
                                <span>Solana Pay URI</span>
                              </span>
                            )}
                          </div>
                          <div className="rounded border border-border/30 bg-muted/30 p-2">
                            <code className="break-all text-xs font-mono text-foreground">
                              {phantomUniversalLink || solanaUri}
                            </code>
                          </div>
                          {phantomUniversalLink && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-green-600 dark:text-green-400">
                                ✅ <strong>Optimal format:</strong> Using Phantom universal link format. This is designed specifically for Phantom&apos;s scanner.
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Universal links (<code className="rounded bg-muted px-1 py-0.5 text-[10px]">https://phantom.app/ul/v1/send</code>) are Phantom&apos;s recommended format per <a href="https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android" target="_blank" rel="noopener noreferrer" className="underline">official documentation</a> and work reliably with their built-in scanner.
                              </p>
                            </div>
                          )}
                          {!phantomUniversalLink && solanaUri && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                ⚠️ <strong>Fallback format:</strong> Using Solana Pay URI. Phantom universal link is preferred for best compatibility with Phantom&apos;s scanner.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Parsed Parameters */}
                        <details className="rounded-lg border border-border/50 bg-background/80 p-3">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            📋 View Parsed Parameters
                          </summary>
                          <div className="mt-2 rounded border border-border/30 bg-muted/30 p-2">
                            <pre className="max-h-40 overflow-auto text-xs font-mono">
                              {JSON.stringify(
                                {
                                  uri: phantomUniversalLink || solanaUri,
                                  type: phantomUniversalLink ? 'phantom-universal-link' : 'solana-pay',
                                  params: Object.fromEntries(
                                  new URLSearchParams(
                                      (solanaUri || phantomUniversalLink || '').split('?')[1] || ''
                                  )
                                ),
                                  paymentDetails: {
                                    address: paymentDetails?.payAddress,
                                    amount: paymentDetails?.payAmount,
                                    currency: paymentDetails?.payCurrency,
                                    tier: paymentDetails?.tier,
                                  },
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </details>

                        {/* Test Actions */}
                        <div className="border-t border-border/30 pt-2 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Test Actions (Dev/QA only):
                          </p>
                          <div className="flex flex-col gap-2">
                            {phantomUniversalLink && (
                              <Button
                                onClick={() => {
                                  navigator.clipboard.writeText(phantomUniversalLink)
                                  toast.success('Phantom universal link copied! Test in browser or scanner.')
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Phantom Universal Link (QR Format)
                              </Button>
                            )}
                            {solanaUri && (
                              <Button
                                onClick={() => {
                                  navigator.clipboard.writeText(solanaUri)
                                  toast.success('Solana Pay URI copied! Paste into Phantom or test scanner.')
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Solana Pay URI (Fallback)
                              </Button>
                            )}
                            <p className="text-[10px] text-muted-foreground text-center">
                              💡 Tip: Copy the URI and test it directly in Phantom&apos;s scanner or paste into a browser to verify format
                            </p>
                          </div>
                        </div>

                        {/* iOS Testing Guide */}
                        <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3">
                          <p className="mb-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            📱 iOS Testing Guide
                          </p>
                          <ol className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                            <li className="flex items-start gap-2">
                              <span className="font-bold">1.</span>
                              <span>Open Camera app on iPhone</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">2.</span>
                              <span>Point at QR code - iOS should detect it automatically</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">3.</span>
                              <span>Tap the notification banner - should open Phantom</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">4.</span>
                              <span>Verify address and amount are prepopulated</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-bold">5.</span>
                              <span>Check browser console for debug logs</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : isExpired ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-12">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Payment expired</p>
                  <p className="max-w-sm text-center text-xs text-muted-foreground">
                    This payment link has expired. Please create a new payment from the pricing page to continue.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted/20 p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Generating QR code…</p>
                  {!solanaUri && (
                    <p className="mt-2 text-xs text-destructive">
                      Waiting for payment details…
                    </p>
                  )}
                </div>
              )}

              {/* Payment Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment address</label>
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <code className="flex-1 break-all font-mono text-xs">
                    {paymentDetails.payAddress}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(paymentDetails.payAddress, 'address')}
                    className="h-8 w-8 flex-shrink-0 p-0"
                  >
                    {copied === 'address' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-1 rounded-xl border border-sec-500/25 bg-sec-500/5 p-4">
                <p className="text-sm font-semibold text-sec-300">
                  Upgrading to <span className="uppercase">{paymentDetails.tier}</span> tier
                </p>
                <p className="text-xs text-sec-200">
                  Once the payment confirms on‑chain, your VolSpike account unlocks this tier automatically (usually within a few minutes).
                </p>
              </div>

              {/* Actions */}
            <div className="flex flex-col gap-3">
              {isExpired ? (
                <>
                  {/* Expired state - show message and option to create new payment */}
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-semibold text-destructive">
                          Payment Window Expired
                        </p>
                        <p className="text-xs text-muted-foreground">
                          This payment link has expired. Crypto payment addresses are time-sensitive. Please create a new payment to continue.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const tier = paymentDetails?.tier || 'pro'
                        safeNavigate(`/pricing?tier=${tier}`, 'expired-create-new-payment')
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white"
                      size="lg"
                      type="button"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span>Create New Payment</span>
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Primary: Open in wallet (Solana Pay URI) */}
                  <Button
                    onClick={() => {
                      if (solanaUri) {
                        console.log('[CryptoPaymentPage] Opening Solana Pay URI from button:', {
                          solanaUri,
                          phantomUniversalLink,
                          phantomDeepLink,
                          timestamp: new Date().toISOString(),
                        })
                        
                        // Use window.open instead of window.location.href to avoid blocking navigation.
                        // The OS will route the solana: URI to the user’s preferred Solana wallet (Phantom, etc.)
                        try {
                          const opened = window.open(solanaUri, '_blank', 'noopener,noreferrer')
                          if (!opened) {
                            console.warn('[CryptoPaymentPage] Popup blocked, trying direct navigation', {
                              solanaUri,
                            })
                            window.location.href = solanaUri
                          }
                        } catch (err) {
                          console.error('[CryptoPaymentPage] Error opening wallet via Solana Pay URI:', err)
                          toast.error('Failed to open wallet. Please copy the address manually.')
                        }
                      } else {
                        toast.error('Payment details not available')
                        console.error('[CryptoPaymentPage] No Solana Pay URI available for button click')
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg"
                    size="lg"
                    disabled={!solanaUri || isExpired}
                    type="button"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>Open in Phantom Wallet</span>
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </Button>
                  
                  {/* Secondary: Copy address for manual entry */}
                  <Button
                    onClick={() => {
                      if (paymentDetails?.payAddress) {
                        copyToClipboard(paymentDetails.payAddress, 'address')
                        toast.success('Address copied! Paste it in Phantom wallet manually.')
                      }
                    }}
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={!paymentDetails?.payAddress || isExpired}
                    type="button"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Address (Manual Entry)
                    </span>
                  </Button>
                </>
              )}
              
              <Button
                onClick={() => {
                  safeNavigate('/pricing', 'expired-cancel-payment')
                }}
                variant="ghost"
                className="w-full"
                type="button"
              >
                Cancel Payment
              </Button>
            </div>
            
              {/* Helpful Instructions */}
              <details className="rounded-xl border border-purple-500/20 bg-purple-500/8 p-4 text-xs [&_summary]:list-none [&_summary]:cursor-pointer">
                <summary className="mb-1 text-sm font-semibold text-purple-300">
                  💡 Having trouble with Phantom?
                </summary>
                <ol className="list-decimal list-inside space-y-1 text-purple-200/90 mt-1.5">
                  <li>Confirm Phantom is installed on the device you&apos;re using to scan.</li>
                  <li>If another wallet opens, close it and tap <span className="font-medium">“Open in Phantom Wallet”</span> above.</li>
                  <li>You can always copy the address and amount, then paste them manually into Phantom.</li>
                  <li>On iOS, make sure your browser is allowed to open Phantom.</li>
                </ol>
              </details>

              {/* Status footer */}
              {paymentDetails.paymentStatus && (
                <div className="text-center text-xs text-muted-foreground">
                  Raw status: <span className="font-semibold">{paymentDetails.paymentStatus}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  )
}
