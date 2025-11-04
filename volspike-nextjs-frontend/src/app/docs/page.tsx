import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export const metadata = {
  title: 'Documentation - VolSpike',
  description: 'VolSpike documentation and guides',
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-muted-foreground mb-8">
            Learn how to make the most of VolSpike
          </p>
          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <p className="text-lg">
              Documentation coming soon. Check back later for comprehensive guides and tutorials.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

