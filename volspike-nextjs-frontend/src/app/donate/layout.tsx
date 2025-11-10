import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donate Bitcoin, Ethereum, Solana or Stablecoins to VolSpike',
  description:
    'Support VolSpike — fast, borderless crypto donations. Donate Bitcoin, Ethereum, USDC/USDT (ETH), or SOL/USDT (Solana). Thank you for helping us build real-time trading intelligence.',
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  // Server component wrapper just to provide metadata; page is client.
  return <>{children}</>
}


