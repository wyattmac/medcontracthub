import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, TrendingUp, Shield, Zap, BarChart3, Users } from 'lucide-react'
import { redirect } from 'next/navigation'

export default function LandingPage() {
  // Developer bypass - redirect to dashboard in development
  if (process.env.NODE_ENV === 'development') {
    redirect('/dashboard')
  }
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <Link className="flex items-center justify-center" href="/">
          <span className="font-bold text-xl">MedContractHub</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#features">
            Features
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#how-it-works">
            How it Works
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#pricing">
            Pricing
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            Login
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center py-16">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Win More Federal Medical Supply Contracts
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                AI-powered platform that helps medical supply companies discover, analyze, and win federal contracts through SAM.gov integration.
              </p>
            </div>
            <div className="space-x-4">
              <Link href="/signup">
                <Button size="lg">Start 14-Day Free Trial</Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg">See How It Works</Button>
              </Link>
            </div>
            <p className="text-sm text-gray-500">No credit card required • Setup in 5 minutes</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-50">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary">$4.2B+</div>
              <p className="text-sm text-gray-500 mt-2">Federal Medical Contracts Available</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">87%</div>
              <p className="text-sm text-gray-500 mt-2">Win Rate Improvement</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">3.5x</div>
              <p className="text-sm text-gray-500 mt-2">ROI in First Year</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center mb-12">
            Everything You Need to Win Federal Contracts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Real-Time Opportunity Discovery</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatically discover relevant medical supply contracts from SAM.gov matched to your NAICS codes and capabilities.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>AI-Powered Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Get instant insights on requirements, competition, and win probability using advanced AI analysis.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Compliance Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Never miss a requirement with automated compliance checking and deadline reminders.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Team Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Work together on proposals with role-based access and real-time collaboration features.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Proposal Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate winning proposals with AI assistance based on successful past submissions.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle2 className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Success Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor your win rate and optimize your strategy with detailed analytics and insights.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 bg-gray-50">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center mb-12">
            How MedContractHub Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Connect Your Profile</h3>
              <p className="text-sm text-gray-500">
                Add your NAICS codes, certifications, and capabilities
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Discover Opportunities</h3>
              <p className="text-sm text-gray-500">
                AI matches you with relevant federal contracts daily
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Analyze & Decide</h3>
              <p className="text-sm text-gray-500">
                Get AI insights on requirements and competition
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Submit & Win</h3>
              <p className="text-sm text-gray-500">
                Generate proposals and track your success rate
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter">
              Ready to Win More Federal Contracts?
            </h2>
            <p className="mx-auto max-w-[600px] text-gray-500 md:text-lg">
              Join hundreds of medical supply companies using MedContractHub to grow their federal business.
            </p>
            <Link href="/signup">
              <Button size="lg" className="mt-4">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              © 2024 MedContractHub. All rights reserved.
            </p>
            <nav className="flex gap-4 mt-4 md:mt-0">
              <Link className="text-sm text-gray-500 hover:underline" href="/terms">
                Terms
              </Link>
              <Link className="text-sm text-gray-500 hover:underline" href="/privacy">
                Privacy
              </Link>
              <Link className="text-sm text-gray-500 hover:underline" href="/contact">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}