'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Filter, Settings2, ChevronLeft, ChevronRight } from 'lucide-react'
import { OpportunitiesFilters } from './opportunities-filters'

interface OpportunitiesLayoutProps {
  children: React.ReactNode
  searchParams?: any
}

export function OpportunitiesLayout({ children, searchParams }: OpportunitiesLayoutProps) {
  const [isFiltersSidebarOpen, setIsFiltersSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  
  return (
    <div className="flex h-full gap-6">
      {/* Desktop Filters Sidebar */}
      <div className={`hidden lg:block transition-all duration-300 flex-shrink-0 ${
        isDesktopSidebarCollapsed ? 'w-16' : 'w-80'
      }`}>
        <div className="sticky top-6">
          <Card className="h-fit">
            {!isDesktopSidebarCollapsed && (
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-5 w-5 text-blue-600" />
                    <span 
                      style={{
                        background: 'linear-gradient(to right, #2563eb, #059669)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}
                    >
                      Search & Filters
                    </span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDesktopSidebarCollapsed(true)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Refine your opportunity search with advanced filters
                </p>
              </CardHeader>
            )}
            
            {isDesktopSidebarCollapsed ? (
              <CardContent className="p-4 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDesktopSidebarCollapsed(false)}
                  className="h-10 w-10 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            ) : (
              <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <OpportunitiesFilters searchParams={searchParams} />
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        {/* Mobile Filters Button */}
        <div className="lg:hidden mb-4">
          <Dialog open={isFiltersSidebarOpen} onOpenChange={setIsFiltersSidebarOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto"
              >
                <Filter className="mr-2 h-4 w-4" />
                Search & Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-blue-600" />
                  Search & Filters
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <OpportunitiesFilters searchParams={searchParams} />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Opportunities Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  )
}