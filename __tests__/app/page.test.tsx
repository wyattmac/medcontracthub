/**
 * Home page tests
 */

import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

// Mock auth hook
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: jest.fn()
  })
}))

describe('Home Page', () => {
  it('should render without crashing', () => {
    render(<HomePage />)
    // Basic smoke test - just ensure it renders
  })

  it('should be a React component', () => {
    expect(typeof HomePage).toBe('function')
  })

  it('should render as a functional component', () => {
    const component = render(<HomePage />)
    expect(component).toBeTruthy()
  })
})