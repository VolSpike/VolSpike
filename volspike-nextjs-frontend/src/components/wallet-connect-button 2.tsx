'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Loader2, Wallet, X } from 'lucide-react'
import { useDisconnect } from 'wagmi'

// Lazy-load RainbowKit so SSR doesn't try to render it
const RainbowConnect = dynamic(async () => {
  const mod = await import('@rainbow-me/rainbowkit')
  return { default: mod.ConnectButton.Custom }
}, {
  ssr: false,
  loading: () => (
    <Button
      disabled
      className="w-full border border-green-400/60 bg-transparent text-green-300 hover:bg-green-500/15"
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading wallet...
    </Button>
  )
})

export function WalletConnectButton() {
  const { disconnect } = useDisconnect()

  return (
    <RainbowConnect>
      {({ openConnectModal, account, chain, mounted, authenticationStatus, openChainModal, openAccountModal }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected = ready && account && chain

        if (!connected) {
          return (
            <Button
              type="button"
              onClick={openConnectModal}
              className="w-full border border-green-400/60 bg-transparent text-green-300 hover:bg-green-500/15"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )
        }

        // When connected, show a compact chip with address, network, and disconnect button
        return (
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              onClick={openAccountModal}
              className="flex-1 bg-muted text-foreground hover:bg-muted/80 transition-all duration-150 border border-border/50"
            >
              <Wallet className="mr-2 h-3.5 w-3.5" />
              {account.displayName}
            </Button>
            <Button
              type="button"
              onClick={openChainModal}
              className="bg-muted text-foreground hover:bg-muted/80 transition-all duration-150 text-xs px-3 border border-border/50"
            >
              {chain?.name}
            </Button>
            <Button
              type="button"
              onClick={() => disconnect()}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-all duration-150 px-3"
              title="Disconnect wallet"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      }}
    </RainbowConnect>
  )
}


