/**
 * Error boundary component tests
 */

import { render, screen } from '@testing-library/react'
import { ErrorBoundary, SectionErrorBoundary, withErrorBoundary } from '@/components/ui/error-boundary'

// Mock the logger
jest.mock('@/lib/errors/logger', () => ({
  logger: {
    error: jest.fn()
  }
}))

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test content')).toBeTruthy()
  })

  it('should catch and display error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('should log error to monitoring', () => {
    const { logger } = require('@/lib/errors/logger')
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(logger.error).toHaveBeenCalledWith(
      'React Error Boundary caught error',
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should call custom onError handler', () => {
    const onError = jest.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should render custom fallback', () => {
    const customFallback = <div>Custom error message</div>
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeTruthy()
  })

  it('should show error details in development', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Test error')).toBeTruthy()

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true
    })
  })

  it('should hide error details in production', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy()
    expect(screen.queryByText('Test error')).not.toBeTruthy()

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true
    })
  })
})

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render children when no error', () => {
    render(
      <SectionErrorBoundary name="test-section">
        <div>Section content</div>
      </SectionErrorBoundary>
    )

    expect(screen.getByText('Section content')).toBeTruthy()
  })

  it('should show section-specific error message', () => {
    render(
      <SectionErrorBoundary name="dashboard">
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    )

    expect(screen.getByText('Error loading dashboard')).toBeTruthy()
  })

  it('should log error with section context', () => {
    const { logger } = require('@/lib/errors/logger')
    
    render(
      <SectionErrorBoundary name="analytics">
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    )

    expect(logger.error).toHaveBeenCalledWith(
      'Error in analytics section',
      expect.any(Error),
      expect.objectContaining({
        section: 'analytics'
      })
    )
  })
})

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowError)
    
    render(<WrappedComponent shouldThrow={false} />)
    expect(screen.getByText('No error')).toBeTruthy()
  })

  it('should catch errors in wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowError)
    
    render(<WrappedComponent shouldThrow={true} />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('should use custom fallback', () => {
    const customFallback = <div>HOC error fallback</div>
    const WrappedComponent = withErrorBoundary(ThrowError, customFallback)
    
    render(<WrappedComponent shouldThrow={true} />)
    expect(screen.getByText('HOC error fallback')).toBeTruthy()
  })

  it('should preserve component display name', () => {
    const TestComponent = () => <div>Test</div>
    TestComponent.displayName = 'TestComponent'
    
    const WrappedComponent = withErrorBoundary(TestComponent)
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)')
  })

  it('should handle component without display name', () => {
    const TestComponent = () => <div>Test</div>
    
    const WrappedComponent = withErrorBoundary(TestComponent)
    expect(WrappedComponent.displayName).toContain('withErrorBoundary')
  })
})