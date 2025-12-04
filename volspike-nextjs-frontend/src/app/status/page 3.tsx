import { HeaderWithBanner } from '@/components/header-with-banner'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'System Status - VolSpike',
  description: 'VolSpike system status and uptime',
}

export default async function StatusPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <HeaderWithBanner />
      <main className="container mx-auto px-4 pt-10 pb-8 md:pt-12 md:pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">System Status</h1>
          <p className="text-muted-foreground mb-8">Current operational status of VolSpike services</p>
          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <p className="text-lg font-semibold">All Systems Operational</p>
            </div>
            <p className="text-sm text-muted-foreground">All services are running normally</p>
          </div>
        </div>
      </main>
    </SessionProvider>
  )
}
