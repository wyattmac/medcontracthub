import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values for display
 */
export function formatCurrency(amount: number | null): string {
  if (!amount) return 'Not specified'
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
  
  if (amount >= 1000000) {
    return formatter.format(amount / 1000000) + 'M'
  } else if (amount >= 1000) {
    return formatter.format(amount / 1000) + 'K'
  } else {
    return formatter.format(amount)
  }
}