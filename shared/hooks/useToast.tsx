/**
 * Shared Toast Hook
 * Provides toast notifications
 */

'use client'

import { toast as sonnerToast } from 'sonner'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default', duration = 5000 } = options
    
    switch (variant) {
      case 'destructive':
        sonnerToast.error(title, {
          description,
          duration,
        })
        break
      case 'success':
        sonnerToast.success(title, {
          description,
          duration,
        })
        break
      default:
        sonnerToast(title, {
          description,
          duration,
        })
    }
  }

  return { toast }
}