import { Header } from '@/components/header'
import { SessionProvider } from 'next-auth/react'
import { getNextAuthSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Support - VolSpike',
  description: 'Get help and support for VolSpike',
}

export default async function SupportPage() {
  const session = await getNextAuthSession()

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-background">
        <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Support</h1>
          <p className="text-muted-foreground mb-8">
            Need help? We&apos;re here to assist you.
          </p>
          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <p className="text-lg mb-4">
              For support inquiries, please contact us at:
            </p>
            <a 
              href="mailto:support@volspike.com" 
              className="text-brand-600 hover:text-brand-700 font-semibold"
            >
              support@volspike.com
            </a>
          </div>
        </div>
      </main>
    </div>
    </SessionProvider>
  )
}

