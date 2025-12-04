import { HeaderWithBanner } from '@/components/header-with-banner'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Documentation - VolSpike',
  description: 'VolSpike documentation and guides',
}

export default async function DocsPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <HeaderWithBanner />
      <main className="container mx-auto px-4 pt-10 pb-8 md:pt-12 md:pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-muted-foreground mb-8">Learn how to make the most of VolSpike</p>
          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <p className="text-lg">Documentation coming soon. Check back later for comprehensive guides and tutorials.</p>
          </div>
        </div>
      </main>
    </SessionProvider>
  )
}
