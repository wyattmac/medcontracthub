'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { logger } from '@/lib/errors/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to monitoring service
    logger.error('Application error boundary caught error', error, {
      digest: error.digest,
      url: window.location.href
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong!</AlertTitle>
          <AlertDescription>
            {process.env.NODE_ENV === 'development' ? (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-sm">{error.message}</p>
                {error.digest && (
                  <p className="text-xs text-gray-500">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            ) : (
              <p>An unexpected error occurred. Our team has been notified.</p>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={reset}
            variant="outline"
            className="flex-1"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="flex-1"
          >
            Go home
          </Button>
        </div>

        {error.digest && (
          <p className="text-center text-xs text-gray-500">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}