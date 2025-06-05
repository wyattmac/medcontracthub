/**
 * Settings Page
 * Main settings hub with links to various settings sections
 */

'use client'

import { useRouter } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  User, 
  Building2, 
  CreditCard, 
  Bell, 
  Shield, 
  Key,
  ChevronRight
} from 'lucide-react'

const settingsSections = [
  {
    title: 'Profile',
    description: 'Manage your personal information and preferences',
    icon: User,
    href: '/dashboard/settings/profile',
  },
  {
    title: 'Company',
    description: 'Update company details, NAICS codes, and certifications',
    icon: Building2,
    href: '/dashboard/settings/company',
  },
  {
    title: 'Billing & Subscription',
    description: 'Manage your subscription, payment methods, and invoices',
    icon: CreditCard,
    href: '/dashboard/settings/billing',
  },
  {
    title: 'Notifications',
    description: 'Configure email alerts and notification preferences',
    icon: Bell,
    href: '/dashboard/settings/notifications',
  },
  {
    title: 'Security',
    description: 'Update password and manage security settings',
    icon: Shield,
    href: '/dashboard/settings/security',
  },
  {
    title: 'API Keys',
    description: 'Manage API access and integration settings',
    icon: Key,
    href: '/dashboard/settings/api',
  },
]

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {settingsSections.map((section) => (
          <Card
            key={section.href}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(section.href)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Need help?</h2>
        <p className="text-muted-foreground mb-4">
          Check out our documentation or contact support for assistance.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => window.open('/help', '_blank')}>
            View Documentation
          </Button>
          <Button variant="outline" onClick={() => window.open('mailto:support@medcontracthub.com')}>
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  )
}