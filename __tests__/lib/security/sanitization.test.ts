/**
 * Sanitization tests
 */

import {
  sanitizeText,
  sanitizeHtml,
  sanitizeForDatabase,
  sanitizeSearchQuery,
  sanitizeUrl,
  sanitizeFileName,
  sanitizeRequestBody
} from '@/lib/security/sanitization'

describe('Sanitization Functions', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello <b>World</b>'
      const result = sanitizeText(input)
      expect(result).toBe('Hello World')
    })

    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('')
      expect(sanitizeText(null as any)).toBe('')
      expect(sanitizeText(undefined as any)).toBe('')
    })

    it('should remove HTML tags', () => {
      const result = sanitizeText('  hello world  ')
      expect(result).toContain('hello world')
    })

    it('should handle special characters', () => {
      const input = 'Price: $100 & tax (10%)'
      const result = sanitizeText(input)
      expect(result).toBe('Price: $100 & tax (10%)')
    })
  })

  describe('sanitizeHtml', () => {
    it('should allow basic text formatting', () => {
      const input = '<b>Bold</b> and <i>italic</i> text'
      const result = sanitizeHtml(input, 'basic')
      expect(result).toContain('Bold')
      expect(result).toContain('italic')
    })

    it('should remove dangerous tags', () => {
      const input = '<script>evil()</script><b>Safe</b>'
      const result = sanitizeHtml(input, 'basic')
      expect(result).not.toContain('<script>')
      expect(result).toContain('Safe')
    })

    it('should handle text mode (no HTML)', () => {
      const input = '<b>Bold</b> text'
      const result = sanitizeHtml(input, 'text')
      expect(result).toBe('Bold text')
    })
  })

  describe('sanitizeForDatabase', () => {
    it('should remove HTML and normalize whitespace', () => {
      const input = '<b>Bold</b>   text   with   spaces'
      const result = sanitizeForDatabase(input)
      expect(result).toBe('Bold text with spaces')
    })

    it('should trim whitespace', () => {
      const input = '   <p>Test</p>   '
      const result = sanitizeForDatabase(input)
      expect(result).toBe('Test')
    })
  })

  describe('sanitizeSearchQuery', () => {
    it('should preserve search terms', () => {
      const input = 'medical supplies'
      const result = sanitizeSearchQuery(input)
      expect(result).toContain('medical')
      expect(result).toContain('supplies')
    })

    it('should remove HTML but keep search terms', () => {
      const input = '<script>alert()</script>medical supplies'
      const result = sanitizeSearchQuery(input)
      expect(result).toContain('medical supplies')
    })
  })

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      const result = sanitizeUrl('https://example.com')
      expect(result).toContain('https://example.com')
    })

    it('should block dangerous protocols', () => {
      const result = sanitizeUrl('javascript:alert()')
      expect(result).toBe('')
    })

    it('should handle empty input', () => {
      expect(sanitizeUrl('')).toBe('')
      expect(sanitizeUrl(null as any)).toBe('')
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      const input = 'file../../../etc/passwd'
      const result = sanitizeFileName(input)
      expect(result).not.toContain('../')
    })

    it('should handle normal filenames', () => {
      const input = 'document-2024_01_15.pdf'
      const result = sanitizeFileName(input)
      expect(result).toContain('document')
      expect(result).toContain('pdf')
    })

    it('should handle empty input', () => {
      expect(sanitizeFileName('')).toBe('')
      expect(sanitizeFileName(null as any)).toBe('')
    })
  })

  describe('sanitizeRequestBody', () => {
    it('should sanitize object properties', () => {
      const input = {
        name: '<script>alert()</script>John Doe',
        description: '<b>Bold text</b>'
      }

      const config = {
        name: 'text' as const,
        description: 'basic' as const
      }

      const result = sanitizeRequestBody(input, config)

      expect(result.name).toContain('John Doe')
      expect(result.description).toContain('Bold text')
    })

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<script>bad</script>Jane'
        }
      }

      const config = {
        'user.name': 'text' as const
      }

      const result = sanitizeRequestBody(input, config)
      expect(result.user.name).toContain('Jane')
    })

    it('should handle arrays', () => {
      const input = {
        tags: ['<script>evil</script>tag1', 'normal tag'],
        items: [
          { name: '<b>Item 1</b>' },
          { name: 'Item 2' }
        ]
      }

      const config = {
        'tags.*': 'text' as const,
        'items.*.name': 'basic' as const
      }

      const result = sanitizeRequestBody(input, config)
      expect(result.tags[0]).toBe('tag1')
      expect(result.tags[1]).toBe('normal tag')
      expect(result.items[0].name).toBe('<b>Item 1</b>')
    })

    it('should return original object when no config provided', () => {
      const input = { name: 'John', age: 30 }
      const result = sanitizeRequestBody(input)
      expect(result).toEqual(input)
    })

    it('should handle non-object inputs', () => {
      expect(sanitizeRequestBody(null)).toBe(null)
      expect(sanitizeRequestBody('string')).toBe('string')
      expect(sanitizeRequestBody(123)).toBe(123)
    })
  })
})