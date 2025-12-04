'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QrCode, Copy, Check, AlertCircle, Info, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'

interface SolanaPayQRGeneratorProps {
  /** Initial recipient address */
  defaultRecipient?: string
  /** Initial amount */
  defaultAmount?: string
  /** Initial token mint address */
  defaultToken?: string
  /** Callback when QR code is generated */
  onQRGenerated?: (url: string) => void
  /** Show compact version */
  compact?: boolean
  /** Custom className */
  className?: string
}

const SPL_TOKENS = [
  { value: 'sol', label: 'SOL (Native)', mint: '' },
  { value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', label: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { value: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', label: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { value: 'custom', label: 'Custom SPL Token', mint: '' },
]

export function SolanaPayQRGenerator({
  defaultRecipient = '',
  defaultAmount = '',
  defaultToken = '',
  onQRGenerated,
  compact = false,
  className,
}: SolanaPayQRGeneratorProps) {
  const [recipient, setRecipient] = useState(defaultRecipient)
  const [amount, setAmount] = useState(defaultAmount)
  // Convert empty string to 'sol' for Select component compatibility
  const [selectedToken, setSelectedToken] = useState(defaultToken || 'sol')
  const [customToken, setCustomToken] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [reference, setReference] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Validate Solana address format
  const isValidSolanaAddress = useCallback((address: string): boolean => {
    if (!address) return false
    // Base58 validation: 32-44 characters, alphanumeric excluding 0, O, I, l
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }, [])

  // Generate Solana Pay URL
  const generateSolanaPayURL = useCallback(() => {
    setError(null)

    // Validate recipient
    if (!recipient.trim()) {
      setError('Recipient address is required')
      return null
    }

    if (!isValidSolanaAddress(recipient.trim())) {
      setError('Invalid Solana address format')
      return null
    }

    // Build Solana Pay URL
    // CRITICAL: Amount should come first and always be included if provided
    let url = `solana:${recipient.trim()}`
    const params = new URLSearchParams()

    // Add amount if provided (remove trailing zeros for cleaner URLs)
    if (amount && parseFloat(amount) > 0) {
      const cleanAmount = parseFloat(amount).toString().replace(/\.?0+$/, '')
      params.append('amount', cleanAmount)
    }

    // Add SPL token if selected (skip if SOL native)
    // FIXED: Simplified logic - selectedToken is already 'sol' for native SOL
    const tokenMint = selectedToken === 'custom' ? customToken.trim() : (selectedToken === 'sol' ? '' : selectedToken)
    if (tokenMint && tokenMint !== 'sol') {
      if (!isValidSolanaAddress(tokenMint)) {
        setError('Invalid token mint address format')
        return null
      }
      params.append('spl-token', tokenMint)
    }

    // Add label if provided (URLSearchParams handles encoding)
    if (label.trim()) {
      params.append('label', label.trim())
    }

    // Add message if provided (URLSearchParams handles encoding)
    if (message.trim()) {
      params.append('message', message.trim())
    }

    // Add reference if provided
    // CRITICAL: Reference MUST be a valid Solana public key (base58, 32-44 chars)
    // Invalid references cause Phantom to reject the entire URI
    if (reference.trim()) {
      if (!isValidSolanaAddress(reference.trim())) {
        setError('Invalid reference address format - must be a valid Solana public key (base58, 32-44 characters)')
        return null
      }
      params.append('reference', reference.trim())
    }

    // Construct final URL
    const queryString = params.toString()
    if (queryString) {
      url += '?' + queryString
    }

    // Log generated URL for debugging
    console.log('[SolanaPayQRGenerator] ✅ Generated Solana Pay URL:', {
      url,
      params: Object.fromEntries(params),
      hasAmount: params.has('amount'),
      hasSplToken: params.has('spl-token'),
      hasReference: params.has('reference'),
    })

    return url
  }, [recipient, amount, selectedToken, customToken, label, message, reference, isValidSolanaAddress])

  // Generate QR code
  const generateQR = useCallback(() => {
    const url = generateSolanaPayURL()
    if (!url) return

    setGeneratedUrl(url)
    setError(null)

    // Generate QR code
    QRCode.toDataURL(url, {
      width: compact ? 200 : 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H', // High error correction for better scanning
    })
      .then((dataUrl) => {
        setQrCodeDataUrl(dataUrl)
        onQRGenerated?.(url)
      })
      .catch((err) => {
        console.error('QR code generation error:', err)
        setError('Failed to generate QR code')
        toast.error('Failed to generate QR code')
      })
  }, [generateSolanaPayURL, compact, onQRGenerated])

  // Auto-generate on mount if default values provided
  useEffect(() => {
    if (defaultRecipient && isValidSolanaAddress(defaultRecipient)) {
      generateQR()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Copy URL to clipboard
  const copyToClipboard = useCallback(() => {
    if (!generatedUrl) return

    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    toast.success('URL copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }, [generatedUrl])

  return (
    <Card className={cn('border-border/60 bg-card/50 backdrop-blur-sm shadow-lg', className)}>
      <CardHeader className={compact ? 'pb-4' : 'pb-6'}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sec-500/20 via-purple-500/20 to-transparent">
            <QrCode className="h-5 w-5 text-sec-500 dark:text-sec-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">Solana Pay QR Generator</CardTitle>
            <CardDescription className="mt-1">
              Create QR codes for Phantom, Solflare, and other Solana wallets
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <div className="grid gap-4">
          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient">
              Recipient Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipient"
              type="text"
              placeholder="e.g., 7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={cn(
                'font-mono text-sm',
                recipient && !isValidSolanaAddress(recipient) && 'border-destructive'
              )}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (Optional)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="e.g., 1.5"
              step="0.000000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token">Token (Optional)</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger id="token">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {SPL_TOKENS.map((token) => (
                  <SelectItem key={token.value} value={token.value}>
                    {token.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Token Input */}
          {selectedToken === 'custom' && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <Label htmlFor="customToken">Custom Token Mint Address</Label>
              <Input
                id="customToken"
                type="text"
                placeholder="Enter SPL token mint address"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                className={cn(
                  'font-mono text-sm',
                  customToken && !isValidSolanaAddress(customToken) && 'border-destructive'
                )}
              />
            </div>
          )}

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              type="text"
              placeholder="e.g., Store Purchase"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message/Memo (Optional)</Label>
            <Input
              id="message"
              type="text"
              placeholder="e.g., Order #12345"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">
              Reference (Optional)
              <span className="text-xs text-muted-foreground ml-2 font-normal">
                Must be a valid Solana public key
              </span>
            </Label>
            <Input
              id="reference"
              type="text"
              placeholder="e.g., 8rqoXFKMpCFYeZVvZVVVVVVVVVVVVVVVVVVVVVVVVVVV"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={cn(
                'font-mono text-sm',
                reference && !isValidSolanaAddress(reference) && 'border-destructive'
              )}
            />
            {reference && !isValidSolanaAddress(reference) && (
              <p className="text-xs text-destructive">
                Reference must be a valid Solana public key (base58, 32-44 characters). Invalid references cause Phantom to reject the payment URI.
              </p>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateQR}
          className="w-full bg-gradient-to-r from-sec-600 to-purple-600 hover:from-sec-700 hover:to-purple-700 text-white shadow-lg"
          size="lg"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate QR Code
        </Button>

        {/* QR Code Display */}
        {qrCodeDataUrl && (
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="flex flex-col items-center gap-4">
              <div className="relative rounded-2xl border border-border/60 bg-background/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-sec-500/25 opacity-80 blur-sm" />
                <div className="relative bg-white p-3 rounded-xl border border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="Solana Pay QR Code"
                    className={cn('w-full h-auto', compact ? 'max-w-[200px]' : 'max-w-[256px]')}
                  />
                </div>
              </div>

              {/* URL Display */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Solana Pay URL</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="h-7 px-2"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <code className="break-all text-xs font-mono text-foreground">
                    {generatedUrl}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        {!compact && (
          <Alert className="border-sec-500/25 bg-sec-500/5">
            <Info className="h-4 w-4 text-sec-500" />
            <AlertDescription className="text-sm">
              <strong className="font-semibold">How it works:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-muted-foreground">
                <li>
                  <strong>Format:</strong> solana:&lt;recipient&gt;?amount=&lt;amount&gt;&spl-token=&lt;mint&gt;
                </li>
                <li>
                  <strong>Supported Wallets:</strong> Phantom, Solflare, Backpack, Glow, and more
                </li>
                <li>
                  <strong>Amount:</strong> Optional, in base units (SOL or tokens)
                </li>
                <li>
                  <strong>SPL Token:</strong> Specify mint address for USDC, USDT, or custom tokens
                </li>
                <li>
                  <strong>Reference:</strong> Used for transaction tracking and verification
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

