'use client'

// Force dynamic rendering for dashboard layout
export const dynamic = 'force-dynamic'

import { useState } from 'react'
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
  BarChart3,
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
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

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
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          {/* Logo with gradient */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
            <Link href="/dashboard" className="flex items-center">
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
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation with hover effects */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-white")} />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-white animate-pulse" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User section with gradient border */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
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
          </div>
        </div>
      </div>

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
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
    </AuthGuard>
  )
}