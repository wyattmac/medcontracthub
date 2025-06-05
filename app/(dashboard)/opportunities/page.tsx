'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Download, TrendingUp, Calendar, Building2, DollarSign } from 'lucide-react'

export default function OpportunitiesPage() {
  return (
    <div className="space-y-8">
      {/* Page Header with Gradient */}
      <div className="text-center space-y-4">
        <h1 
          className="text-4xl font-bold"
          style={{
            background: 'linear-gradient(to right, #2563eb, #059669, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Contract Opportunities
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Discover federal medical supply contracts from SAM.gov tailored to your company&apos;s capabilities. 
          Our AI analyzes over 22,000+ active opportunities to find the best matches for you.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardDescription>Total Opportunities</CardDescription>
            <CardTitle className="text-3xl font-bold">22,847</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-sm text-muted-foreground">
              <TrendingUp className="inline h-4 w-4 text-green-500" /> +12% this month
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardDescription>Your Matches</CardDescription>
            <CardTitle className="text-3xl font-bold">1,234</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-sm text-muted-foreground">Based on your NAICS codes</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardDescription>Saved</CardDescription>
            <CardTitle className="text-3xl font-bold">47</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-sm text-muted-foreground">Ready for proposals</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-3xl font-bold">$2.4B</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-sm text-muted-foreground">Potential contracts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>Find opportunities that match your capabilities</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search opportunities..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sample Opportunities */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Opportunities</h2>
        
        {/* Sample Opportunity Cards */}
        {[
          {
            title: "Medical Equipment Supply Contract - VA Hospital System",
            agency: "Department of Veterans Affairs",
            value: "$2.5M - $5M",
            deadline: "Jan 15, 2025",
            naics: "339112",
            match: "94%",
            description: "Comprehensive medical equipment supply contract for VA facilities across the Southeast region."
          },
          {
            title: "Surgical Instruments and Supplies",
            agency: "Department of Defense - DLA",
            value: "$1.8M - $3.2M",
            deadline: "Jan 22, 2025",
            naics: "339113",
            match: "87%",
            description: "Supply of surgical instruments and disposable medical supplies for military medical facilities."
          },
          {
            title: "Laboratory Equipment and Diagnostics",
            agency: "Department of Health and Human Services",
            value: "$3.2M - $4.5M",
            deadline: "Feb 1, 2025",
            naics: "334516",
            match: "91%",
            description: "Laboratory equipment, reagents, and diagnostic supplies for federal health facilities."
          }
        ].map((opp, idx) => (
          <Card key={idx} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{opp.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {opp.agency}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {opp.value}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due: {opp.deadline}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{opp.description}</p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">NAICS: {opp.naics}</Badge>
                    <Badge variant="default" className="bg-green-500">
                      {opp.match} Match
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <Button size="sm">View Details</Button>
                  <Button size="sm" variant="outline">Save</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading State Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 mb-2">🔄 SAM.gov Integration Status</h3>
          <p className="text-blue-800">
            The opportunities data will be loaded from SAM.gov API when the integration is fully configured.
            Currently showing sample data to demonstrate the interface.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}