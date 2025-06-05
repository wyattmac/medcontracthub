import Link from 'next/link'

export default function SimpleDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                MedContractHub
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                Dashboard
              </Link>
              <Link href="/dashboard/opportunities" className="text-gray-700 hover:text-blue-600">
                Opportunities
              </Link>
              <Link href="/dashboard/saved" className="text-gray-700 hover:text-blue-600">
                Saved
              </Link>
              <Link href="/dashboard/proposals" className="text-gray-700 hover:text-blue-600">
                Proposals
              </Link>
              <Link href="/dashboard/analytics" className="text-gray-700 hover:text-blue-600">
                Analytics
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}