'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Header } from '@/components/header'
import { BackgroundPattern } from '@/components/ui/background-pattern'

type AssetKey = 'BTC' | 'ETH' | 'USDC_ETH' | 'USDT_ETH' | 'SOL' | 'USDT_SOL'

type AssetInfo = {
  label: string
  address: string
  network: string
  seo: string
  steps: string[]
  badge?: string
}

const ASSETS: Record<AssetKey, AssetInfo> = {
  BTC: {
    label: 'Bitcoin (BTC)',
    address: 'bc1q69rs0qplxwzq0v4rtycn3lklzddz9g29g3n0lv',
    network: 'Bitcoin',
    seo: 'Donate Bitcoin to VolSpike',
    steps: [
      'Install a Bitcoin wallet (e.g., Muun, BlueWallet).',
      'Buy BTC on an exchange and withdraw to your wallet.',
      'Open your wallet, pick BTC, tap Send, and scan the QR code.',
      'Double‑check the address before sending (donations are irreversible).',
    ],
  },
  ETH: {
    label: 'Ethereum (ETH)',
    address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
    network: 'Ethereum Mainnet',
    seo: 'Donate Ethereum to VolSpike',
    steps: [
      'Install MetaMask (or Coinbase Wallet).',
      'Buy ETH on an exchange and send to your wallet.',
      'Open MetaMask → Send → paste the address or scan the QR.',
      'Confirm the network is Ethereum Mainnet.',
    ],
  },
  USDC_ETH: {
    label: 'USD Coin (USDC) on ETH',
    address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
    network: 'ETH mainnet (USDC)',
    seo: 'Donate USDC to VolSpike',
    badge: 'Stablecoin • Preferred',
    steps: [
      'Install MetaMask.',
      'Acquire USDC and add the USDC token in MetaMask if needed.',
      'Send USDC on Ethereum to the address shown.',
      'Stablecoins reduce volatility; thanks for supporting us!',
    ],
  },
  USDT_ETH: {
    label: 'Tether (USDT) on ETH',
    address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
    network: 'ETH mainnet (USDT)',
    seo: 'Donate USDT on Ethereum to VolSpike',
    badge: 'Stablecoin • Preferred',
    steps: [
      'Install MetaMask.',
      'Acquire USDT (ERC‑20).',
      'Send USDT on Ethereum to the address shown.',
      'Prefer stablecoins to avoid market swings.',
    ],
  },
  SOL: {
    label: 'Solana (SOL)',
    address: 'DWDTRqQ2zJn6becjTypRwSAVBqoGEh7v7PoAjvwiJ2PS',
    network: 'Solana',
    seo: 'Donate Solana to VolSpike',
    steps: [
      'Install Phantom wallet.',
      'Buy SOL on an exchange and withdraw to Phantom.',
      'Open Phantom → Send → scan the QR code.',
      'Confirm network is Solana.',
    ],
  },
  USDT_SOL: {
    label: 'Tether (USDT) on SOL',
    address: 'DWDTRqQ2zJn6becjTypRwSAVBqoGEh7v7PoAjvwiJ2PS',
    network: 'Solana (USDT)',
    seo: 'Donate USDT on Solana to VolSpike',
    badge: 'Stablecoin • Preferred',
    steps: [
      'Install Phantom wallet.',
      'Acquire USDT on Solana (via exchange or bridge).',
      'Send USDT (SPL) to the address shown.',
      'Stablecoins reduce volatility; thanks for supporting us!',
    ],
  },
}

function useQrData(urlOrText: string) {
  const [dataUrl, setDataUrl] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const u = await QRCode.toDataURL(urlOrText, { width: 240, margin: 1 })
        if (!cancelled) setDataUrl(u)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [urlOrText])
  return dataUrl
}

function AssetCard({ asset }: { asset: AssetInfo }) {
  const qr = useQrData(asset.address)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asset.address)
      setCopied(true)
      toast.success('Address copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <Card className="border border-purple-500/20 bg-gradient-to-b from-background/40 to-background/10 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">{asset.label}</CardTitle>
            <CardDescription className="text-xs">{asset.network}</CardDescription>
          </div>
          {asset.badge && (
            <span className="inline-flex items-center rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300 whitespace-nowrap">
              {asset.badge}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm break-all select-all">
          {asset.address}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button onClick={copy} variant="outline" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy address'}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <QrCode className="h-4 w-4" />
            Scan QR
          </div>
        </div>
        <div className="flex justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`${asset.label} donation QR`}
              className="h-44 w-44 rounded-lg border border-border/60 bg-background p-2"
            />
          ) : (
            <div className="h-44 w-44 animate-pulse rounded-lg border border-border/60 bg-muted" />
          )}
        </div>
        <details className="group rounded-md border border-border/50 bg-background/30 p-3">
          <summary className="cursor-pointer list-none font-medium group-open:text-foreground/90">
            How to donate {(asset.label.match(/\(([^)]+)\)/)?.[1] ?? asset.label.split(' ')[0])} (quick steps)
          </summary>
          <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            {asset.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  )
}

export default function DonatePage() {
  const items = useMemo(
    () => [
      // Stablecoins first (most practical for donors)
      ASSETS.USDT_ETH,
      ASSETS.USDT_SOL,
      ASSETS.USDC_ETH,
      // Then L1 tokens
      ASSETS.SOL,
      ASSETS.BTC,
      ASSETS.ETH,
    ],
    []
  )

  return (
    <div className="min-h-screen bg-background relative">
        <BackgroundPattern />
        <Header hideWalletConnect />
        <div className="container py-10 relative">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Support VolSpike
          </h1>
          <p className="text-muted-foreground">
            Thank you for considering a donation. Your support helps us build a faster,
            more insightful, and privacy‑preserving trading dashboard. Why crypto? It’s
            fast, borderless, and minimizes overhead so more of your contribution goes
            directly into development.
          </p>
          <div className="rounded-xl border p-4 text-sm text-center 
                          bg-green-50 text-green-800 border-green-200
                          dark:bg-green-500/5 dark:text-green-300 dark:border-green-500/30">
            To donate, open your crypto wallet app, select the asset, and send to the
            address below. Use the QR code for easy scanning.
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <AssetCard key={a.label} asset={a} />
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Card className="bg-gradient-to-b from-background/40 to-background/10">
            <CardHeader>
              <CardTitle>Tips, security and receipts</CardTitle>
              <CardDescription>
                Prefer stablecoins (USDT/USDC) to reduce volatility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-2">
                <li>Use HTTPS (secure site) while donating.</li>
                <li>Donations are irreversible. Double‑check the address.</li>
                <li>
                  For a receipt (optional), email support@volspike.com with the
                  transaction hash and asset.
                </li>
                <li>We never ask for private information or seed phrases.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
  )
}
