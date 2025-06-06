import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RemindersWidget } from '@/components/dashboard/reminders/reminders-widget'
import { CompanyRecommendationsWidget } from '@/components/dashboard/ai/company-recommendations-widget'
import { TrendingUp, FileText, Bookmark, DollarSign, ArrowUpRight, Plus, Activity } from 'lucide-react'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="relative">
          <h1 
            className="text-4xl font-bold"
            style={{
              background: 'linear-gradient(to right, #2563eb, #9333ea, #1e40af)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Dashboard
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Welcome back! Here&apos;s your contract opportunities overview
          </p>
        </div>
      </div>
      
      {/* Stats Grid - Enhanced with gradients and animations */}
      <SectionErrorBoundary name="Dashboard Stats">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card 
            className="relative overflow-hidden border-0 hover:shadow-lg transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)'
              }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium" style={{ color: '#1d4ed8' }}>
                Active Opportunities
              </CardTitle>
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#3b82f6' }}
              >
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold" style={{ color: '#1e3a8a' }}>0</div>
              <p className="text-xs flex items-center mt-1" style={{ color: '#2563eb' }}>
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Ready to explore
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="relative overflow-hidden border-0 hover:shadow-lg transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%)'
              }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium" style={{ color: '#15803d' }}>
                Saved Opportunities
              </CardTitle>
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#22c55e' }}
              >
                <Bookmark className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold" style={{ color: '#14532d' }}>0</div>
              <p className="text-xs flex items-center mt-1" style={{ color: '#16a34a' }}>
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Track your interests
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="relative overflow-hidden border-0 hover:shadow-lg transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)'
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, transparent 100%)'
              }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium" style={{ color: '#7c3aed' }}>
                Active Proposals
              </CardTitle>
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#a855f7' }}
              >
                <FileText className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold" style={{ color: '#581c87' }}>0</div>
              <p className="text-xs flex items-center mt-1" style={{ color: '#9333ea' }}>
                <ArrowUpRight className="h-3 w-3 mr-1" />
                In progress
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="relative overflow-hidden border-0 hover:shadow-lg transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)'
              }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium" style={{ color: '#d97706' }}>
                Contract Value
              </CardTitle>
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#f59e0b' }}
              >
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold" style={{ color: '#92400e' }}>$0</div>
              <p className="text-xs flex items-center mt-1" style={{ color: '#d97706' }}>
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Potential value
              </p>
            </CardContent>
          </Card>
        </div>
      </SectionErrorBoundary>

      {/* Main Content Grid - Enhanced styling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
        {/* Recent Activity - Enhanced with better empty state */}
        <div className="lg:col-span-2 xl:col-span-3">
          <SectionErrorBoundary name="Recent Activity">
            <Card className="h-full border-0 shadow-lg">
              <CardHeader 
                className="rounded-t-lg"
                style={{
                  background: 'linear-gradient(to right, #f8fafc, #f1f5f9)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" style={{ color: '#2563eb' }} />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Your latest actions and updates
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="secondary" 
                    style={{ 
                      backgroundColor: '#dbeafe', 
                      color: '#1d4ed8' 
                    }}
                  >
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div 
                    className="h-16 w-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)'
                    }}
                  >
                    <Activity className="h-8 w-8" style={{ color: '#2563eb' }} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      No recent activity
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md">
                      Start exploring opportunities to see your activity here
                    </p>
                  </div>
                  <Button 
                    className="mt-4"
                    style={{
                      background: 'linear-gradient(to right, #2563eb, #9333ea)',
                      color: 'white'
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Explore Opportunities
                  </Button>
                </div>
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </div>

        {/* Right Sidebar - Enhanced styling */}
        <div className="lg:col-span-1 xl:col-span-2 space-y-4 lg:space-y-6">
          <SectionErrorBoundary name="Reminders">
            <div className="transform hover:scale-105 transition-transform duration-300">
              <RemindersWidget />
            </div>
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Company Recommendations">
            <div className="transform hover:scale-105 transition-transform duration-300">
              <CompanyRecommendationsWidget />
            </div>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  )
}