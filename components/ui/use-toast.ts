/**
 * Toast Hook - Simple toast notification system
 */

import { useState, useCallback } from 'react'

export interface ToastProps {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

// Simple toast implementation - can be enhanced with a more sophisticated library later
export function useToast() {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([])

  const toast = useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...props, id }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, props.duration || 5000)
    
    // Show native notification for now
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(props.title, {
        body: props.description,
        icon: '/favicon.ico'
      })
    } else {
      // Fallback to console for development
      console.log(`Toast: ${props.title}${props.description ? ` - ${props.description}` : ''}`)
    }
  }, [])

  return { toast, toasts }
}