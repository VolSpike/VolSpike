import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export const metadata = {
  title: 'System Status - VolSpike',
  description: 'VolSpike system status and uptime',
}

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">System Status</h1>
          <p className="text-muted-foreground mb-8">
            Current operational status of VolSpike services
          </p>
          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <p className="text-lg font-semibold">All Systems Operational</p>
            </div>
            <p className="text-sm text-muted-foreground">
              All services are running normally
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

