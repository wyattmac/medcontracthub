/**
 * Billing Settings Page
 * Allows users to manage their subscription, payment methods, and view invoices
 */

'use client'

// Force dynamic rendering for client components using context
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useErrorHandler } from '@/lib/hooks/useErrorHandler'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPrice, getPlanDisplayName } from '@/lib/stripe/client'
import { Loader2, CreditCard, FileText, BarChart3, AlertCircle } from 'lucide-react'

interface Subscription {
  id: string
  status: string
  current_period_end: string
  cancel_at?: string
  trial_end?: string
  subscription_plans?: {
    name: string
    price_cents: number
    interval: string
  }
}

interface UsageSummary {
  [key: string]: {
    limit: number
    used: number
    remaining: number
  }
}

interface Invoice {
  id: string
  amount_cents: number
  status: string
  created_at: string
  invoice_pdf?: string
  hosted_invoice_url?: string
}

export default function BillingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { handleError } = useErrorHandler()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageSummary>({})
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [processingPortal, setProcessingPortal] = useState(false)

  useEffect(() => {
    if (user) {
      fetchBillingData()
    }
  }, [user, fetchBillingData])

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/billing/subscription', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch billing data')
      }

      const data = await response.json()
      setSubscription(data.subscription)
      setUsage(data.usage || {})
      setInvoices(data.invoices || [])
    } catch (error) {
      handleError(error as Error, { showToast: true })
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const handleManageSubscription = async () => {
    try {
      setProcessingPortal(true)
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create billing portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      handleError(error as Error, { showToast: true })
      setProcessingPortal(false)
    }
  }

  const handleUpgradePlan = () => {
    router.push('/pricing')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  const isTrialing = subscription?.status === 'trialing'
  const isCanceled = subscription?.status === 'canceled' || !!subscription?.cancel_at
  const planName = subscription?.subscription_plans?.name || 'Free'

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription, payment methods, and billing information
        </p>
      </div>

      {/* Subscription Status Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your subscription details and status</CardDescription>
            </div>
            <Badge
              variant={
                subscription?.status === 'active' ? 'default' :
                subscription?.status === 'trialing' ? 'secondary' :
                subscription?.status === 'canceled' ? 'destructive' :
                'outline'
              }
            >
              {subscription?.status || 'No Subscription'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{getPlanDisplayName(planName)}</p>
                {subscription?.subscription_plans && (
                  <p className="text-muted-foreground">
                    {formatPrice(subscription.subscription_plans.price_cents)} / {subscription.subscription_plans.interval}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!subscription || subscription.status === 'canceled' ? (
                  <Button onClick={handleUpgradePlan}>
                    Choose a Plan
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleUpgradePlan}>
                      Change Plan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={processingPortal}
                    >
                      {processingPortal ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Manage Subscription'
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isTrialing && subscription.trial_end && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <p className="text-sm text-blue-900">
                    Your free trial ends on {new Date(subscription.trial_end).toLocaleDateString()}.
                    Add a payment method to continue after your trial.
                  </p>
                </div>
              </div>
            )}

            {isCanceled && subscription.cancel_at && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-900">
                    Your subscription will end on {new Date(subscription.cancel_at).toLocaleDateString()}.
                    You can reactivate anytime before this date.
                  </p>
                </div>
              </div>
            )}

            {subscription?.current_period_end && !isCanceled && (
              <p className="text-sm text-muted-foreground">
                Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Usage and Invoices */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">
            <BarChart3 className="h-4 w-4 mr-2" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payment">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Methods
          </TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <CardDescription>
                Your usage for the current billing period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(usage).map(([feature, data]) => {
                  const percentage = data.limit === -1 ? 0 : (data.used / data.limit) * 100
                  const isUnlimited = data.limit === -1
                  
                  return (
                    <div key={feature} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {feature.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {isUnlimited ? (
                            'Unlimited'
                          ) : (
                            `${data.used} / ${data.limit}`
                          )}
                        </span>
                      </div>
                      {!isUnlimited && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              percentage > 80 ? 'bg-red-500' : 
                              percentage > 60 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Your past invoices and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No invoices yet
                </p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="font-medium">
                            {formatPrice(invoice.amount_cents)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={invoice.status === 'paid' ? 'default' : 'destructive'}
                        >
                          {invoice.status}
                        </Badge>
                        {invoice.invoice_pdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.invoice_pdf, '_blank')}
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage your payment methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Manage your payment methods in the billing portal
                </p>
                <Button
                  onClick={handleManageSubscription}
                  disabled={processingPortal}
                >
                  {processingPortal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Open Billing Portal'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}