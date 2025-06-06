/**
 * Button component tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('should render basic button', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeTruthy()
    expect(button.textContent).toBe('Click me')
  })

  it('should handle click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should apply variant classes', () => {
    const { rerender } = render(<Button variant="default">Default</Button>)
    let button = screen.getByRole('button')
    expect(button.className).toContain('inline-flex')

    rerender(<Button variant="destructive">Destructive</Button>)
    button = screen.getByRole('button')
    expect(button.className).toContain('inline-flex')

    rerender(<Button variant="outline">Outline</Button>)
    button = screen.getByRole('button')
    expect(button.className).toContain('border')
  })

  it('should apply size classes', () => {
    const { rerender } = render(<Button size="default">Default</Button>)
    let button = screen.getByRole('button')
    expect(button.className).toContain('px-4')

    rerender(<Button size="sm">Small</Button>)
    button = screen.getByRole('button')
    expect(button.className).toContain('px-3')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button')
    expect(button.className).toContain('px-8')
  })

  it('should handle disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    
    expect(button.disabled).toBe(true)
  })

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('custom-class')
  })

  it('should render children correctly', () => {
    render(<Button>Test Content</Button>)
    expect(screen.getByText('Test Content')).toBeTruthy()
  })

  it('should handle different button types', () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.type).toBe('submit')
  })
})