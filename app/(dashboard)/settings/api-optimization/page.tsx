import { ApiUsageDashboard } from '@/components/dashboard/quota/api-usage-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

export default function ApiOptimizationPage() {
  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">API Optimization</h2>
          <div className="flex items-center space-x-2">
            <Button variant="outline">View Logs</Button>
            <Button>Save Settings</Button>
          </div>
        </div>

        {/* API Usage Dashboard */}
        <ApiUsageDashboard />

        {/* Optimization Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Settings</CardTitle>
            <CardDescription>
              Configure how the application uses the SAM.gov API to minimize quota usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Aggressive Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache search results for 1 hour instead of 5 minutes
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Database-First Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Search local database before calling SAM.gov API
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Batch Sync Operations</Label>
                  <p className="text-sm text-muted-foreground">
                    Combine multiple sync requests into single API calls
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Quota Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically enable when daily quota drops below 200
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Prefetch Popular Searches</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache common NAICS codes during off-peak hours
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Schedule</CardTitle>
            <CardDescription>
              Configure when automatic syncs occur to optimize API usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Syncs are currently scheduled for 2:00 AM EST when API usage is typically lowest.
                  This uses approximately 250-500 API calls per sync.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Daily Sync Time</Label>
                  <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2">
                    <option>2:00 AM EST (Recommended)</option>
                    <option>3:00 AM EST</option>
                    <option>4:00 AM EST</option>
                    <option>5:00 AM EST</option>
                    <option>Disabled</option>
                  </select>
                </div>

                <div>
                  <Label>Sync Frequency</Label>
                  <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2">
                    <option>Daily</option>
                    <option>Every 2 days</option>
                    <option>Weekly</option>
                    <option>Manual only</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle>Best Practices</CardTitle>
            <CardDescription>
              Tips for managing your SAM.gov API quota effectively
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <p>Use filters to narrow searches and reduce result sets</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <p>Enable caching for frequently accessed data</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <p>Schedule syncs during off-peak hours (2-6 AM EST)</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <p>Monitor your daily usage and adjust settings when needed</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <p>Use the local database search when real-time data isn&apos;t critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}