/**
 * Pricing Page
 * Display available subscription plans and allow users to subscribe
 */

'use client'

// Force dynamic rendering for client components using context
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useErrorHandler } from '@/lib/hooks/useErrorHandler'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { getPlanPrice } from '@/lib/stripe/client'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  features: string[]
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses getting started',
    price: getPlanPrice('starter'),
    features: [
      '100 opportunities per month',
      '20 AI analyses per month',
      '50 OCR documents per month',
      'Email alerts',
      'CSV exports',
      '1 team member',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing businesses that need more power',
    price: getPlanPrice('professional'),
    features: [
      '1,000 opportunities per month',
      '100 AI analyses per month',
      '200 OCR documents per month',
      'Email alerts',
      'CSV, Excel & PDF exports',
      '5 team members',
      'API access',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited access for large organizations',
    price: getPlanPrice('enterprise'),
    features: [
      'Unlimited opportunities',
      'Unlimited AI analyses',
      'Unlimited OCR documents',
      'Email alerts',
      'All export formats',
      'Unlimited team members',
      'API access',
      'Priority support',
      'Custom integrations',
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { handleError } = useErrorHandler()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      router.push('/login')
      return
    }

    try {
      setLoading(true)
      setSelectedPlan(planId)

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      handleError(error as Error, { showToast: true })
      setLoading(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground">
          Start with a 14-day free trial. No credit card required.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.highlighted
                ? 'border-primary shadow-lg scale-105'
                : ''
            }`}
          >
            {plan.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading}
              >
                {loading && selectedPlan === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Start Free Trial'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-6 text-left">
          <div>
            <h3 className="font-semibold mb-2">Do I need a credit card for the trial?</h3>
            <p className="text-muted-foreground">
              No, you can start your 14-day free trial without a credit card. We&apos;ll only ask for
              payment information when you&apos;re ready to continue after the trial.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
            <p className="text-muted-foreground">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect
              immediately, and we&apos;ll prorate any charges.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What happens to my data if I cancel?</h3>
            <p className="text-muted-foreground">
              Your data is safe. We&apos;ll keep your saved opportunities and data for 90 days after
              cancellation, so you can easily reactivate if you change your mind.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Do you offer discounts for annual billing?</h3>
            <p className="text-muted-foreground">
              Yes, we offer 20% off when you pay annually. Contact our sales team for more
              information about annual plans and volume discounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}