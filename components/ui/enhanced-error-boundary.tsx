'use client'

import React, { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCcw, Home, Copy, ChevronDown, ChevronUp, Camera, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorReporter } from '@/lib/errors/error-reporter'
import { captureErrorScreenshot, VisualErrorDebugger } from '@/lib/errors/visual-debugger'
import { useToast } from '@/lib/hooks/useToast'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string // Section name for better error tracking
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorReport: any | null
  showDetails: boolean
  visualDebug: any | null
  isCapturingDebug: boolean
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorReport: null,
      showDetails: false,
      visualDebug: null,
      isCapturingDebug: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Create detailed error report
    const errorReport = errorReporter.report(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'UnknownSection',
      url: window.location.href,
      method: 'React Component',
      environment: process.env.NODE_ENV
    })

    // Update state with error report
    this.setState({
      error,
      errorInfo,
      errorReport
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    
    // Capture visual debug in development
    if (process.env.NODE_ENV === 'development') {
      captureErrorScreenshot(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorReport: null,
      showDetails: false,
      visualDebug: null,
      isCapturingDebug: false
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleCopyError = () => {
    if (this.state.errorReport) {
      const errorText = JSON.stringify(this.state.errorReport, null, 2)
      navigator.clipboard.writeText(errorText)
      // Note: useToast won't work in class component, so we'll use alert
      alert('Error details copied to clipboard')
    }
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }
  
  handleCaptureVisualDebug = async () => {
    this.setState({ isCapturingDebug: true })
    
    try {
      const visualDebug = await VisualErrorDebugger.captureErrorContext({
        url: window.location.href,
        error: this.state.error!,
        fullPage: true
      })
      
      this.setState({ visualDebug, isCapturingDebug: false })
      alert('Visual debug captured! Check the details section.')
    } catch (error) {
      console.error('Failed to capture visual debug', error)
      this.setState({ isCapturingDebug: false })
      alert('Failed to capture visual debug')
    }
  }
  
  handleRunDiagnostics = async () => {
    this.setState({ isCapturingDebug: true })
    
    try {
      const diagnostics = await VisualErrorDebugger.runDiagnostics(window.location.href)
      console.group('🔍 Page Diagnostics')
      console.log('Accessibility:', diagnostics.accessibility)
      console.log('Performance:', diagnostics.performance)
      console.log('SEO:', diagnostics.seo)
      console.log('Best Practices:', diagnostics.bestPractices)
      console.groupEnd()
      
      this.setState({ isCapturingDebug: false })
      alert('Diagnostics complete! Check the console.')
    } catch (error) {
      console.error('Failed to run diagnostics', error)
      this.setState({ isCapturingDebug: false })
      alert('Failed to run diagnostics')
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      const { error, errorReport, showDetails } = this.state
      const isDevelopment = process.env.NODE_ENV === 'development'

      // Production error UI
      if (!isDevelopment) {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Something went wrong
                </CardTitle>
                <CardDescription>
                  We encountered an unexpected error. Please try again or contact support if the issue persists.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={this.handleReset} variant="outline" className="flex-1">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      // Development error UI with detailed debugging info
      return (
        <div className="min-h-[400px] p-4">
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Error in {this.props.name || 'Component'}
              </CardTitle>
              <CardDescription className="font-mono text-sm">
                {error?.message || 'Unknown error'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-6">
              {/* Debugging Hint */}
              {errorReport?.debugging?.hint && (
                <Alert>
                  <AlertTitle>💡 Debugging Hint</AlertTitle>
                  <AlertDescription>{errorReport.debugging.hint}</AlertDescription>
                </Alert>
              )}

              {/* Possible Causes */}
              {errorReport?.debugging?.possibleCauses?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-orange-600">Possible Causes:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {errorReport.debugging.possibleCauses.map((cause: string, i: number) => (
                      <li key={i} className="text-muted-foreground">{cause}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Actions */}
              {errorReport?.debugging?.suggestedActions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-green-600">Suggested Actions:</h4>
                  <ul className="list-decimal list-inside text-sm space-y-1">
                    {errorReport.debugging.suggestedActions.map((action: string, i: number) => (
                      <li key={i} className="text-muted-foreground">{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Files */}
              {errorReport?.debugging?.relatedFiles?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-blue-600">Related Files:</h4>
                  <div className="text-sm space-y-1 font-mono">
                    {errorReport.debugging.relatedFiles.map((file: string, i: number) => (
                      <div key={i} className="text-muted-foreground">📄 {file}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details Toggle */}
              <div className="border-t pt-4">
                <Button
                  onClick={this.toggleDetails}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span>Technical Details</span>
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                
                {showDetails && (
                  <div className="mt-4 space-y-4">
                    {/* Stack Trace */}
                    {error?.stack && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Stack Trace:</h4>
                        <pre className="text-xs overflow-auto p-3 bg-muted rounded-md max-h-[200px]">
                          {error.stack}
                        </pre>
                      </div>
                    )}

                    {/* Component Stack */}
                    {errorInfo?.componentStack && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Component Stack:</h4>
                        <pre className="text-xs overflow-auto p-3 bg-muted rounded-md max-h-[200px]">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {/* Full Error Report */}
                    {errorReport && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Full Error Report:</h4>
                        <pre className="text-xs overflow-auto p-3 bg-muted rounded-md max-h-[200px]">
                          {JSON.stringify(errorReport, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {/* Visual Debug Info */}
                    {this.state.visualDebug && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Visual Debug:</h4>
                        <div className="text-sm space-y-1">
                          <p>Screenshot: {this.state.visualDebug.screenshot ? '✅ Captured' : '❌ Failed'}</p>
                          <p>Console Errors: {this.state.visualDebug.consoleErrors?.length || 0}</p>
                          <p>Network Errors: {this.state.visualDebug.networkErrors?.length || 0}</p>
                          {this.state.visualDebug.domState && (
                            <details className="cursor-pointer">
                              <summary className="text-xs">DOM State</summary>
                              <pre className="mt-2 text-xs overflow-auto p-2 bg-muted rounded">
                                {JSON.stringify(this.state.visualDebug.domState, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button onClick={this.handleReload} variant="outline" size="sm">
                  Reload Page
                </Button>
                <Button onClick={this.handleCopyError} variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Error
                </Button>
                <Button 
                  onClick={this.handleCaptureVisualDebug} 
                  variant="outline" 
                  size="sm"
                  disabled={this.state.isCapturingDebug}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {this.state.isCapturingDebug ? 'Capturing...' : 'Capture Debug'}
                </Button>
                <Button 
                  onClick={this.handleRunDiagnostics} 
                  variant="outline" 
                  size="sm"
                  disabled={this.state.isCapturingDebug}
                >
                  <Bug className="mr-2 h-4 w-4" />
                  Run Diagnostics
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" size="sm" className="ml-auto">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to easily wrap components with enhanced error boundary
 */
export function withEnhancedErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  name?: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary name={name}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )
  
  WrappedComponent.displayName = `withEnhancedErrorBoundary(${Component.displayName || Component.name || 'Component'})`
  
  return WrappedComponent
}