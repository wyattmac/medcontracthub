import { AlertCircle, Home, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function ErrorPage({
  searchParams,
}: {
  searchParams: { code?: string; message?: string }
}) {
  const errorCode = searchParams.code || 'unknown'
  const errorMessage = searchParams.message

  const errorDetails = getErrorDetails(errorCode)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {errorDetails.title}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {errorMessage || errorDetails.description}
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Code: {errorCode.toUpperCase()}</AlertTitle>
          <AlertDescription>
            {errorDetails.technicalDetails}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {errorDetails.actions.map((action, index) => (
            <div key={index}>
              {action.type === 'link' ? (
                <Link href={action.href} className="block">
                  <Button variant="outline" className="w-full">
                    {action.icon}
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.label}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            If this problem persists, please{' '}
            <a
              href="mailto:support@medcontracthub.com"
              className="text-blue-600 hover:underline"
            >
              contact support
            </a>
          </p>
          <p className="mt-1">
            Reference ID: {generateReferenceId()}
          </p>
        </div>
      </div>
    </div>
  )
}

function getErrorDetails(code: string) {
  const errors: Record<string, any> = {
    config: {
      title: 'Configuration Error',
      description: 'The application is not properly configured. Please contact your administrator.',
      technicalDetails: 'Missing or invalid environment variables detected.',
      actions: [
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    },
    middleware: {
      title: 'Access Error',
      description: 'There was a problem processing your request. Please try again.',
      technicalDetails: 'Middleware encountered an error while processing the request.',
      actions: [
        {
          type: 'button',
          onClick: () => window.location.reload(),
          label: 'Reload Page',
          icon: <RefreshCcw className="mr-2 h-4 w-4" />
        },
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    },
    auth: {
      title: 'Authentication Error',
      description: 'You need to be logged in to access this page.',
      technicalDetails: 'Your session may have expired or you are not authorized.',
      actions: [
        {
          type: 'link',
          href: '/login',
          label: 'Log In',
          icon: null
        },
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    },
    404: {
      title: 'Page Not Found',
      description: 'The page you are looking for does not exist.',
      technicalDetails: 'The requested resource could not be found on this server.',
      actions: [
        {
          type: 'button',
          onClick: () => window.history.back(),
          label: 'Go Back',
          icon: null
        },
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    },
    500: {
      title: 'Server Error',
      description: 'Something went wrong on our end. Please try again later.',
      technicalDetails: 'An internal server error occurred while processing your request.',
      actions: [
        {
          type: 'button',
          onClick: () => window.location.reload(),
          label: 'Try Again',
          icon: <RefreshCcw className="mr-2 h-4 w-4" />
        },
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    },
    unknown: {
      title: 'Unexpected Error',
      description: 'An unexpected error occurred. Please try again.',
      technicalDetails: 'The application encountered an unknown error.',
      actions: [
        {
          type: 'button',
          onClick: () => window.location.reload(),
          label: 'Reload Page',
          icon: <RefreshCcw className="mr-2 h-4 w-4" />
        },
        {
          type: 'link',
          href: '/',
          label: 'Go to Homepage',
          icon: <Home className="mr-2 h-4 w-4" />
        }
      ]
    }
  }

  return errors[code] || errors.unknown
}

function generateReferenceId() {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
}