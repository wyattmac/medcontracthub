/**
 * Toast Hook - Simple toast notification system
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ToastProps {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

// Simple toast implementation - can be enhanced with a more sophisticated library later
export function useToast() {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([])
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  const toast = useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...props, id }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove toast after duration with cleanup
    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timeoutsRef.current.delete(id)
    }, props.duration || 5000)
    
    timeoutsRef.current.set(id, timeout)
    
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