/**
 * Tests for sanitization utilities
 */

import {
  sanitizeText,
  sanitizeHtml,
  sanitizeSearchQuery,
  sanitizeUrl,
  sanitizeFileName,
  sanitizeForDatabase,
  sanitizeApiInput
} from '@/lib/security/sanitization'

describe('Sanitization Utils', () => {
  describe('sanitizeText', () => {
    it('should remove all HTML tags', () => {
      const input = '<script>alert("xss")</script><p>Hello World</p>'
      const result = sanitizeText(input)
      expect(result).toBe('Hello World')
    })

    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('')
      expect(sanitizeText(null as any)).toBe('')
      expect(sanitizeText(undefined as any)).toBe('')
    })

    it('should preserve text content', () => {
      const input = '<b>Bold</b> and <i>italic</i> text'
      const result = sanitizeText(input)
      expect(result).toBe('Bold and italic text')
    })
  })

  describe('sanitizeHtml', () => {
    it('should allow basic HTML tags', () => {
      const input = '<p><b>Bold</b> and <i>italic</i></p>'
      const result = sanitizeHtml(input, 'basic')
      expect(result).toContain('<b>Bold</b>')
      expect(result).toContain('<i>italic</i>')
    })

    it('should remove dangerous HTML', () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>'
      const result = sanitizeHtml(input, 'basic')
      expect(result).not.toContain('<script>')
      expect(result).toContain('Safe content')
    })

    it('should remove all tags in text mode', () => {
      const input = '<p><b>Bold</b> text</p>'
      const result = sanitizeHtml(input, 'text')
      expect(result).toBe('Bold text')
    })
  })

  describe('sanitizeSearchQuery', () => {
    it('should remove dangerous characters', () => {
      const input = 'medical supplies"; DROP TABLE users; --'
      const result = sanitizeSearchQuery(input)
      expect(result).not.toContain('"')
      expect(result).not.toContain(';')
      expect(result).not.toContain('--')
    })

    it('should preserve normal search terms', () => {
      const input = 'medical equipment OR surgical supplies'
      const result = sanitizeSearchQuery(input)
      expect(result).toContain('medical equipment')
      expect(result).toContain('surgical supplies')
    })

    it('should limit length', () => {
      const input = 'a'.repeat(1000)
      const result = sanitizeSearchQuery(input)
      expect(result.length).toBeLessThanOrEqual(500)
    })
  })

  describe('sanitizeUrl', () => {
    it('should allow valid HTTPS URLs', () => {
      const input = 'https://example.com/path'
      const result = sanitizeUrl(input)
      expect(result).toBe(input)
    })

    it('should allow valid HTTP URLs', () => {
      const input = 'http://example.com/path'
      const result = sanitizeUrl(input)
      expect(result).toBe(input)
    })

    it('should reject javascript: URLs', () => {
      const input = 'javascript:alert("xss")'
      const result = sanitizeUrl(input)
      expect(result).toBe('')
    })

    it('should reject data: URLs', () => {
      const input = 'data:text/html,<script>alert("xss")</script>'
      const result = sanitizeUrl(input)
      expect(result).toBe('')
    })

    it('should handle invalid URLs', () => {
      const input = 'not-a-url'
      const result = sanitizeUrl(input)
      expect(result).toBe('')
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      const input = '../../../etc/passwd'
      const result = sanitizeFileName(input)
      expect(result).not.toContain('../')
      expect(result).not.toContain('/')
    })

    it('should remove leading dots', () => {
      const input = '...hidden-file.txt'
      const result = sanitizeFileName(input)
      expect(result).toBe('hidden-file.txt')
    })

    it('should preserve normal filenames', () => {
      const input = 'document-2024.pdf'
      const result = sanitizeFileName(input)
      expect(result).toBe(input)
    })

    it('should limit length', () => {
      const input = 'a'.repeat(300) + '.txt'
      const result = sanitizeFileName(input)
      expect(result.length).toBeLessThanOrEqual(255)
    })
  })

  describe('sanitizeForDatabase', () => {
    it('should remove HTML and normalize whitespace', () => {
      const input = '<p>Text   with   extra   spaces</p>'
      const result = sanitizeForDatabase(input)
      expect(result).toBe('Text with extra spaces')
    })

    it('should trim input', () => {
      const input = '  <span>Content</span>  '
      const result = sanitizeForDatabase(input)
      expect(result).toBe('Content')
    })
  })

  describe('sanitizeApiInput', () => {
    it('should sanitize string fields', () => {
      const input = {
        title: '<script>alert("xss")</script>Title',
        description: '<p>Description</p>',
        count: 5
      }
      
      const result = sanitizeApiInput(input)
      
      expect(result.title).toBe('Title')
      expect(result.description).toBe('Description')
      expect(result.count).toBe(5) // Numbers should pass through
    })

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<script>alert("xss")</script>John',
          bio: '<p>Developer</p>'
        },
        settings: {
          theme: 'dark'
        }
      }
      
      const result = sanitizeApiInput(input)
      
      expect(result.user.name).toBe('John')
      expect(result.user.bio).toBe('Developer')
      expect(result.settings.theme).toBe('dark')
    })

    it('should handle arrays', () => {
      const input = {
        tags: ['<script>tag1</script>', 'tag2', '<b>tag3</b>'],
        numbers: [1, 2, 3]
      }
      
      const result = sanitizeApiInput(input)
      
      // Script tags are completely removed by DOMPurify, other tags have content preserved
      expect(result.tags).toEqual(['', 'tag2', 'tag3'])
      expect(result.numbers).toEqual([1, 2, 3])
    })

    it('should use custom field configurations', () => {
      const input = {
        title: '<b>Bold Title</b>',
        description: '<p>Rich <em>content</em></p>',
        searchQuery: 'query"; DROP TABLE;'
      }
      
      const fieldConfig = {
        title: 'basic' as const,
        description: 'rich' as const,
        searchQuery: 'search' as const
      }
      
      const result = sanitizeApiInput(input, fieldConfig)
      
      expect(result.title).toContain('<b>Bold Title</b>')
      expect(result.description).toContain('<em>content</em>')
      expect(result.searchQuery).not.toContain('"')
      expect(result.searchQuery).not.toContain(';')
    })

    it('should handle null and undefined values', () => {
      const input = {
        title: null,
        description: undefined,
        content: 'valid'
      }
      
      const result = sanitizeApiInput(input)
      
      expect(result.title).toBeNull()
      expect(result.description).toBeUndefined()
      expect(result.content).toBe('valid')
    })
  })
})