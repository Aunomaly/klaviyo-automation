import Link from 'next/link'
import { Mail, Users, Workflow, Zap } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Klaviyo Automation</span>
          </div>
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition"
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Automate Your Klaviyo Setup
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Scrape brand guidelines, generate customized email templates, and deploy 
          complete flows to Klaviyo in minutes instead of hours.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-lg font-medium hover:bg-primary/90 transition"
        >
          <Zap className="h-5 w-5" />
          Get Started
        </Link>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Users className="h-10 w-10" />}
            title="Brand Extraction"
            description="Automatically scrape colors, fonts, and logos from any client website to build a complete brand profile."
          />
          <FeatureCard
            icon={<Mail className="h-10 w-10" />}
            title="Template Generation"
            description="Apply brand customizations to battle-tested email templates optimized for deliverability and engagement."
          />
          <FeatureCard
            icon={<Workflow className="h-10 w-10" />}
            title="Flow Automation"
            description="Deploy complete email flows with split tests and time delays directly to Klaviyo via API."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-primary rounded-2xl p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to automate?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Stop spending hours manually setting up Klaviyo for each client. 
            Let automation do the heavy lifting.
          </p>
          <Link
            href="/dashboard/brands"
            className="inline-flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-lg text-lg font-medium hover:bg-gray-100 transition"
          >
            Add Your First Brand
          </Link>
        </div>
      </section>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
