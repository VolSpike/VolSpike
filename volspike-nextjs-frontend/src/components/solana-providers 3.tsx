'use client'

import { FC, PropsWithChildren, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect'

const DEFAULT_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'mainnet-beta'
const ENDPOINT = DEFAULT_CLUSTER === 'devnet'
  ? 'https://api.devnet.solana.com'
  : 'https://api.mainnet-beta.solana.com'

export const SolanaProvider: FC<PropsWithChildren> = ({ children }) => {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  // Use an https origin for mobile deep linking callbacks
  const publicUrl = process.env.NEXT_PUBLIC_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://volspike.com')
  const wallets = useMemo(() => {
    // Conditional adapter loading per expert guidance
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const list: any[] = [new PhantomWalletAdapter()]
    // On mobile: Phantom only (avoid WC modal interference)
    // On desktop: include WC as fallback
    if (!isMobile && projectId) {
      list.push(new WalletConnectWalletAdapter({
        network: DEFAULT_CLUSTER as any,
        options: {
          projectId,
          metadata: {
            name: 'VolSpike',
            description: 'VolSpike Auth',
            url: publicUrl,
            icons: ['https://volspike.com/favicon.ico']
          }
        }
      }) as any)
    }
    return list
  }, [projectId, publicUrl])

  // Disable autoConnect - we'll connect manually when user clicks "Sign In with Phantom"
  // autoConnect can interfere with mobile deep linking flow
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(err, adapter) => {
          console.error('[SolanaProvider] Wallet error:', err?.message || err, 'adapter:', adapter?.name)
        }}
      >
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}

