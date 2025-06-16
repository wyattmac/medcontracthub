'use client'

// Force dynamic rendering for dashboard layout
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AuthGuard } from '@/components/auth/auth-guard'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Search,
  Bookmark,
  FileText,
  Settings,
  Menu,
  X,
  ChevronRight
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Opportunities', href: '/opportunities', icon: Search },
  { name: 'Saved', href: '/saved', icon: Bookmark },
  { name: 'Proposals', href: '/proposals', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true) // Start collapsed
  const [isHovering, setIsHovering] = useState(false)
  const [mouseNearLeft, setMouseNearLeft] = useState(false)
  const pathname = usePathname()
  
  const mainContentRef = useRef<HTMLDivElement>(null)
  const mouseLeaveTimer = useRef<NodeJS.Timeout>()

  // Handle mouse position to show/hide sidebar
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (window.innerWidth < 1024) return // Only for desktop
    
    const threshold = 50 // Pixels from left edge to trigger
    const isNearLeft = e.clientX <= threshold
    
    if (isNearLeft && !mouseNearLeft) {
      setMouseNearLeft(true)
      setSidebarCollapsed(false)
      // Clear any pending hide timer
      if (mouseLeaveTimer.current) {
        clearTimeout(mouseLeaveTimer.current)
      }
    } else if (!isNearLeft && mouseNearLeft && !isHovering) {
      setMouseNearLeft(false)
      // Add delay before hiding to prevent flickering
      mouseLeaveTimer.current = setTimeout(() => {
        if (!isHovering) {
          setSidebarCollapsed(true)
        }
      }, 300)
    }
  }, [mouseNearLeft, isHovering])

  // Set up event listeners
  useEffect(() => {
    // Add mouse move listener for left edge detection
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (mouseLeaveTimer.current) {
        clearTimeout(mouseLeaveTimer.current)
      }
    }
  }, [handleMouseMove])

  // Expand sidebar when hovering (desktop only)
  const handleMouseEnter = () => {
    if (window.innerWidth >= 1024) {
      setIsHovering(true)
      // Clear any pending hide timer
      if (mouseLeaveTimer.current) {
        clearTimeout(mouseLeaveTimer.current)
      }
    }
  }

  const handleMouseLeave = () => {
    if (window.innerWidth >= 1024) {
      setIsHovering(false)
      // Only collapse if mouse is not near left edge
      if (!mouseNearLeft) {
        mouseLeaveTimer.current = setTimeout(() => {
          setSidebarCollapsed(true)
        }, 300)
      }
    }
  }

  return (
    <AuthGuard>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar with gradient accent */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed && !isHovering ? "lg:w-20" : "w-72"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          {/* Logo with gradient */}
          <div className={cn(
            "flex h-16 items-center border-b border-gray-200 dark:border-gray-800 transition-all duration-300",
            sidebarCollapsed && !isHovering ? "px-4 justify-center" : "px-6 justify-between"
          )}>
            <Link href="/dashboard" className="flex items-center">
              {sidebarCollapsed && !isHovering ? (
                <span 
                  className="text-2xl font-bold"
                  style={{
                    background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  M
                </span>
              ) : (
                <span 
                  className="text-xl font-bold"
                  style={{
                    background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  MedContractHub
                </span>
              )}
            </Link>
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Navigation with hover effects */}
          <nav className={cn(
            "flex-1 space-y-1 py-4 transition-all duration-300",
            sidebarCollapsed && !isHovering ? "px-2" : "px-3"
          )}>
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                      sidebarCollapsed && !isHovering 
                        ? "justify-center px-2 py-3" 
                        : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0", 
                      isActive && "text-white"
                    )} />
                    {(!sidebarCollapsed || isHovering) && (
                      <>
                        <span className="transition-opacity duration-200">
                          {item.name}
                        </span>
                        {isActive && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-white animate-pulse" />
                        )}
                      </>
                    )}
                  </Link>
                  
                  {/* Tooltip for collapsed sidebar */}
                  {sidebarCollapsed && !isHovering && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                      {item.name}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User section with gradient border */}
          <div className={cn(
            "border-t border-gray-200 dark:border-gray-800 transition-all duration-300",
            sidebarCollapsed && !isHovering ? "p-2" : "p-4"
          )}>
            {sidebarCollapsed && !isHovering ? (
              <div className="flex justify-center">
                <div 
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  }}
                >
                  <span className="text-white text-sm font-bold">D</span>
                </div>
              </div>
            ) : (
              <div 
                className="rounded-lg p-3"
                style={{
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                }}
              >
                <p className="text-sm font-medium text-gray-900">
                  Developer Mode
                </p>
                <p className="text-xs text-gray-500">
                  Authenticated User
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Visual indicator for hover zone (optional - only visible when sidebar is collapsed) */}
      {sidebarCollapsed && !sidebarOpen && (
        <div 
          className="fixed left-0 top-0 h-full w-[50px] hidden lg:block pointer-events-none z-40"
          style={{
            background: 'linear-gradient(to right, rgba(59, 130, 246, 0.05) 0%, transparent 100%)'
          }}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-16 items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb */}
            <div className="hidden lg:flex items-center text-sm">
              <Link 
                href="/dashboard" 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Home
              </Link>
              {pathname !== '/dashboard' && (
                <>
                  <ChevronRight className="mx-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {navigation.find(item => item.href === pathname)?.name || 'Page'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick actions with gradient */}
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              className="border-gray-300 hover:border-gray-400"
            >
              Quick Actions
            </Button>
            <div 
              className="h-8 w-8 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              }}
            />
          </div>
        </header>

        {/* Page content with proper spacing */}
        <main 
          ref={mainContentRef}
          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900"
        >
          <div className="w-full pl-4 pr-8 sm:pl-6 sm:pr-12 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
    </AuthGuard>
  )
}