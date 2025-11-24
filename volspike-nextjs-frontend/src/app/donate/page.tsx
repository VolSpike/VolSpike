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
  wallets?: string[]
}

type QrPayload = {
  uri: string
  scheme: 'solana' | 'ethereum' | 'bitcoin' | 'address'
  walletHint: string
  fallbackUri?: string
}

const SOLANA_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const ETH_MAINNET_CHAIN_ID = 1
const ETH_USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const ETH_USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const QR_BEHAVIOR: Record<AssetKey, { scheme: QrPayload['scheme']; walletHint: string; solanaMint?: string; evmContract?: string; chainId?: number }> = {
  BTC: {
    scheme: 'bitcoin',
    walletHint: 'Opens in Muun, BlueWallet, Casa, or any Bitcoin wallet',
  },
  ETH: {
    scheme: 'ethereum',
    walletHint: 'Opens MetaMask, Rainbow, Coinbase Wallet with address pre-filled',
    chainId: ETH_MAINNET_CHAIN_ID,
  },
  USDC_ETH: {
    scheme: 'ethereum',
    walletHint: 'Launches MetaMask (ERC-20 transfer) for USDC on Ethereum',
    evmContract: ETH_USDC_CONTRACT,
    chainId: ETH_MAINNET_CHAIN_ID,
  },
  USDT_ETH: {
    scheme: 'ethereum',
    walletHint: 'Launches MetaMask (ERC-20 transfer) for USDT on Ethereum',
    evmContract: ETH_USDT_CONTRACT,
    chainId: ETH_MAINNET_CHAIN_ID,
  },
  SOL: {
    scheme: 'solana',
    walletHint: 'Opens Phantom, Backpack, Glow, or Solflare with recipient filled in',
  },
  USDT_SOL: {
    scheme: 'solana',
    walletHint: 'Opens Phantom or any Solana wallet with USDT mint selected',
    solanaMint: SOLANA_USDT_MINT,
  },
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
    wallets: ['Muun', 'BlueWallet', 'Zeus'],
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
    wallets: ['MetaMask', 'Rainbow', 'Coinbase Wallet'],
  },
  USDC_ETH: {
    label: 'USDC on ETH',
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
    wallets: ['MetaMask', 'Rainbow', 'Coinbase Wallet'],
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
    wallets: ['MetaMask', 'Rainbow', 'Coinbase Wallet'],
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
    wallets: ['Phantom', 'Backpack', 'Solflare'],
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
    wallets: ['Phantom', 'Backpack', 'Solflare'],
  },
}

const isValidSolanaAddress = (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
const isValidEthereumAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)

const buildQrPayload = (assetKey: AssetKey, asset: AssetInfo): QrPayload => {
  const config = QR_BEHAVIOR[assetKey]
  const defaultPayload: QrPayload = {
    uri: asset.address,
    scheme: 'address',
    walletHint: 'Copy the address manually if the QR cannot open your wallet.',
  }

  if (!config) {
    console.warn('[DonatePage] No QR config found for asset, falling back to plain address', { assetKey })
    return defaultPayload
  }

  if (config.scheme === 'solana') {
    if (!isValidSolanaAddress(asset.address)) {
      console.warn('[DonatePage] Solana address failed validation; QR may still work but verify carefully.', {
        assetKey,
        address: asset.address,
      })
    }
    const params = new URLSearchParams({
      label: 'VolSpike Donation',
      message: `Donate ${asset.label}`,
    })
    if (config.solanaMint) {
      params.set('spl-token', config.solanaMint)
    }
    const uri = `solana:${asset.address}${params.size ? `?${params.toString()}` : ''}`
    console.debug('[DonatePage] Generated Solana QR payload', {
      assetKey,
      uri,
      params: Object.fromEntries(params),
      hasSplToken: params.has('spl-token'),
    })
    return {
      uri,
      scheme: 'solana',
      walletHint: config.walletHint,
    }
  }

  if (config.scheme === 'ethereum') {
    if (!isValidEthereumAddress(asset.address)) {
      console.warn('[DonatePage] Ethereum address failed validation; double-check donation address.', {
        assetKey,
        address: asset.address,
      })
    }
    const chainId = config.chainId || ETH_MAINNET_CHAIN_ID
    let uri: string
    let fallbackUri: string | undefined
    if (config.evmContract) {
      const params = new URLSearchParams({ address: asset.address })
      uri = `https://link.metamask.io/send/${config.evmContract}@${chainId}/transfer?${params.toString()}`
      fallbackUri = `ethereum:${config.evmContract}@${chainId}/transfer?${params.toString()}`
    } else {
      uri = `https://link.metamask.io/send/${asset.address}@${chainId}`
      fallbackUri = `ethereum:${asset.address}@${chainId}`
    }
    console.debug('[DonatePage] Generated Ethereum QR payload', {
      assetKey,
      uri,
      fallbackUri,
      chainId,
      contract: config.evmContract ?? null,
    })
    return {
      uri,
      scheme: 'ethereum',
      walletHint: config.walletHint,
      fallbackUri,
    }
  }

  if (config.scheme === 'bitcoin') {
    const params = new URLSearchParams({ message: 'VolSpike Donation' })
    const uri = `bitcoin:${asset.address}?${params.toString()}`
    console.debug('[DonatePage] Generated Bitcoin QR payload', { assetKey, uri })
    return {
      uri,
      scheme: 'bitcoin',
      walletHint: config.walletHint,
    }
  }

  return defaultPayload
}

function useQrData(urlOrText: string) {
  const [dataUrl, setDataUrl] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        console.debug('[DonatePage] Rendering QR code', {
          payloadPreview: urlOrText.slice(0, 100),
          length: urlOrText.length,
        })
        const u = await QRCode.toDataURL(urlOrText, { width: 240, margin: 1 })
        if (!cancelled) setDataUrl(u)
      } catch (error) {
        console.error('[DonatePage] Failed to render QR code', { payload: urlOrText, error })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [urlOrText])
  return dataUrl
}

function AssetCard({ assetKey, asset }: { assetKey: AssetKey; asset: AssetInfo }) {
  const qrPayload = useMemo(() => buildQrPayload(assetKey, asset), [assetKey, asset])
  const qr = useQrData(qrPayload.uri)
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

  const openWalletLink = (uri: string) => {
    if (!uri) return
    window.open(uri, '_blank', 'noopener,noreferrer')
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
            <span className="inline-flex items-center rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-100 whitespace-nowrap shadow-sm shadow-brand-500/25">
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
        <div className="text-center space-y-2">
          {asset.wallets && (
            <p className="text-xs text-muted-foreground">
              Works with {asset.wallets.join(', ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground/80">{qrPayload.walletHint}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => openWalletLink(qrPayload.uri)}>
              Open in wallet
            </Button>
            {qrPayload.fallbackUri && (
              <Button size="sm" variant="ghost" onClick={() => openWalletLink(qrPayload.fallbackUri!)}>
                Fallback link
              </Button>
            )}
          </div>
          <div className="rounded-md border border-border/50 bg-muted/30 p-2 text-left">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-1">QR payload</p>
            <code className="block text-[11px] leading-relaxed break-all text-muted-foreground">
              {qrPayload.uri}
            </code>
          </div>
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
      { key: 'USDT_ETH' as AssetKey, asset: ASSETS.USDT_ETH },
      { key: 'USDT_SOL' as AssetKey, asset: ASSETS.USDT_SOL },
      { key: 'USDC_ETH' as AssetKey, asset: ASSETS.USDC_ETH },
      { key: 'SOL' as AssetKey, asset: ASSETS.SOL },
      { key: 'BTC' as AssetKey, asset: ASSETS.BTC },
      { key: 'ETH' as AssetKey, asset: ASSETS.ETH },
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
          {items.map(({ key, asset }) => (
            <AssetCard key={key} assetKey={key} asset={asset} />
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
