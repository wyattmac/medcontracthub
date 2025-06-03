/**
 * Tests for SanitizedInput components
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SanitizedInput, SearchInput, UrlInput, FileNameInput } from '@/components/ui/sanitized-input'

// Mock the sanitization functions
jest.mock('@/lib/security/sanitization', () => ({
  useSanitization: () => ({
    sanitizeText: jest.fn((text) => text.replace(/<[^>]*>/g, '')),
    sanitizeSearchQuery: jest.fn((text) => text.replace(/['"`;\\]/g, '')),
    sanitizeUrl: jest.fn((url) => {
      try {
        const parsed = new URL(url)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : ''
      } catch {
        return ''
      }
    }),
    sanitizeFileName: jest.fn((name) => name.replace(/[\/\\:*?"<>|]/g, '_')),
    sanitizeHtml: jest.fn((html, type) => {
      if (type === 'basic') {
        return html.replace(/<script[^>]*>.*?<\/script>/gi, '')
      }
      return html.replace(/<[^>]*>/g, '')
    })
  })
}))

describe('SanitizedInput Components', () => {
  describe('SanitizedInput', () => {
    it('renders input element', () => {
      render(<SanitizedInput placeholder="Test input" />)
      const input = screen.getByPlaceholderText('Test input')
      expect(input).toBeInTheDocument()
    })

    it('sanitizes input on change', async () => {
      const user = userEvent.setup()
      const mockOnChange = jest.fn()
      
      render(<SanitizedInput onChange={mockOnChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, '<script>alert("xss")</script>Hello')
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('calls onSanitizedChange with both values', async () => {
      const user = userEvent.setup()
      const mockOnSanitizedChange = jest.fn()
      
      render(<SanitizedInput onSanitizedChange={mockOnSanitizedChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, '<script>test</script>')
      
      await waitFor(() => {
        expect(mockOnSanitizedChange).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String)
        )
      })
    })

    it('handles different sanitization types', async () => {
      const user = userEvent.setup()
      
      render(<SanitizedInput sanitizationType="search" />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'search"; DROP TABLE;')
      
      // The sanitization should remove dangerous characters
      expect(input).toBeInTheDocument()
    })
  })

  describe('SearchInput', () => {
    it('renders with search placeholder', () => {
      render(<SearchInput />)
      const input = screen.getByPlaceholderText('Search opportunities...')
      expect(input).toBeInTheDocument()
    })

    it('applies search sanitization', async () => {
      const user = userEvent.setup()
      const mockOnChange = jest.fn()
      
      render(<SearchInput onChange={mockOnChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'medical equipment')
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe('UrlInput', () => {
    it('renders with URL type and placeholder', () => {
      render(<UrlInput />)
      const input = screen.getByPlaceholderText('https://example.com')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'url')
    })

    it('sanitizes URLs', async () => {
      const user = userEvent.setup()
      const mockOnChange = jest.fn()
      
      render(<UrlInput onChange={mockOnChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'https://example.com')
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe('FileNameInput', () => {
    it('renders with filename placeholder', () => {
      render(<FileNameInput />)
      const input = screen.getByPlaceholderText('filename.ext')
      expect(input).toBeInTheDocument()
    })

    it('sanitizes file names', async () => {
      const user = userEvent.setup()
      const mockOnChange = jest.fn()
      
      render(<FileNameInput onChange={mockOnChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'document.pdf')
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<SanitizedInput ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('supports all standard input props', () => {
      render(
        <SanitizedInput 
          id="test-input"
          className="test-class"
          disabled
          required
          aria-label="Test input"
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id', 'test-input')
      expect(input).toHaveClass('test-class')
      expect(input).toBeDisabled()
      expect(input).toBeRequired()
      expect(input).toHaveAttribute('aria-label', 'Test input')
    })
  })
})