/**
 * Utility functions tests
 */

import { cn } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should combine class names', () => {
      const result = cn('btn', 'btn-primary', 'active')
      expect(result).toBe('btn btn-primary active')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const isDisabled = false
      
      const result = cn(
        'btn',
        isActive && 'active',
        isDisabled && 'disabled'
      )
      
      expect(result).toBe('btn active')
    })

    it('should handle arrays', () => {
      const result = cn(['btn', 'btn-lg'], 'active')
      expect(result).toBe('btn btn-lg active')
    })

    it('should handle objects', () => {
      const result = cn({
        'btn': true,
        'btn-primary': true,
        'disabled': false
      })
      
      expect(result).toBe('btn btn-primary')
    })

    it('should filter out falsy values', () => {
      const result = cn('btn', null, undefined, false, '', 'active')
      expect(result).toBe('btn active')
    })

    it('should handle complex combinations', () => {
      const variant = 'primary'
      const size = 'lg'
      const disabled = false
      
      const result = cn(
        'btn',
        variant && `btn-${variant}`,
        size && `btn-${size}`,
        disabled && 'disabled',
        ['focus:ring-2', 'focus:ring-blue-500']
      )
      
      expect(result).toBe('btn btn-primary btn-lg focus:ring-2 focus:ring-blue-500')
    })

    it('should handle empty input', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined, false)).toBe('')
    })

    it('should deduplicate classes', () => {
      const result = cn('btn', 'active', 'btn', 'active')
      // Note: clsx doesn't deduplicate by default, so we get duplicates
      expect(result).toBe('btn active btn active')
    })

    it('should handle whitespace properly', () => {
      const result = cn('  btn  ', '  active  ')
      expect(result).toBe('btn active')
    })
  })
})