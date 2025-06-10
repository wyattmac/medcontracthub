/**
 * User-friendly error messages for validation
 * Provides consistent, helpful error messages across the application
 */

// Field name mappings for better user experience
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  noticeId: 'Notice ID',
  naicsCodes: 'NAICS Codes',
  setAsideTypes: 'Set-Aside Types',
  responseDeadline: 'Response Deadline',
  postedDate: 'Posted Date',
  valueAmount: 'Contract Value',
  placeOfPerformance: 'Place of Performance',
  dunsNumber: 'DUNS Number',
  cageCode: 'CAGE Code',
  einNumber: 'EIN',
  samRegistrationDate: 'SAM Registration Date',
  samExpirationDate: 'SAM Expiration Date',
  zipCode: 'ZIP Code',
  reminderDate: 'Reminder Date',
  dueDate: 'Due Date',
  submittedAt: 'Submission Date'
}

// Error message templates
export const ERROR_MESSAGES = {
  // Required field errors
  required: (field: string) => `${getFieldDisplayName(field)} is required`,
  requiredSelection: (field: string) => `Please select a ${getFieldDisplayName(field).toLowerCase()}`,
  
  // Format errors
  invalidFormat: (field: string, format?: string) => 
    format 
      ? `${getFieldDisplayName(field)} must be in format: ${format}`
      : `${getFieldDisplayName(field)} has an invalid format`,
  
  // Length errors
  tooShort: (field: string, min: number) => 
    `${getFieldDisplayName(field)} must be at least ${min} characters`,
  tooLong: (field: string, max: number) => 
    `${getFieldDisplayName(field)} must be at most ${max} characters`,
  exactLength: (field: string, length: number) => 
    `${getFieldDisplayName(field)} must be exactly ${length} characters`,
  
  // Number errors
  tooSmall: (field: string, min: number) => 
    `${getFieldDisplayName(field)} must be at least ${min}`,
  tooBig: (field: string, max: number) => 
    `${getFieldDisplayName(field)} must be at most ${max}`,
  notNumber: (field: string) => 
    `${getFieldDisplayName(field)} must be a valid number`,
  notInteger: (field: string) => 
    `${getFieldDisplayName(field)} must be a whole number`,
  
  // Date errors
  invalidDate: (field: string) => 
    `${getFieldDisplayName(field)} must be a valid date`,
  pastDate: (field: string) => 
    `${getFieldDisplayName(field)} must be in the future`,
  futureDate: (field: string) => 
    `${getFieldDisplayName(field)} must be in the past`,
  dateRange: (startField: string, endField: string) => 
    `${getFieldDisplayName(endField)} must be after ${getFieldDisplayName(startField).toLowerCase()}`,
  
  // Email errors
  invalidEmail: () => 'Please enter a valid email address',
  
  // Phone errors
  invalidPhone: () => 'Please enter a valid phone number (10-14 digits)',
  
  // URL errors
  invalidUrl: () => 'Please enter a valid URL starting with http:// or https://',
  
  // Specific field errors
  invalidDuns: () => 'DUNS number must be 9 digits',
  invalidCage: () => 'CAGE code must be 5 alphanumeric characters',
  invalidEin: () => 'EIN must be in format: XX-XXXXXXX',
  invalidNaics: () => 'NAICS code must be 6 digits',
  invalidZip: () => 'ZIP code must be in format: XXXXX or XXXXX-XXXX',
  invalidState: () => 'Please enter a valid 2-letter state code',
  invalidUuid: () => 'Invalid ID format',
  
  // Business rule errors
  valueRangeInvalid: () => 'Maximum value must be greater than minimum value',
  deadlineInPast: () => 'Response deadline cannot be in the past',
  registrationExpired: () => 'SAM registration has expired',
  missingPaymentMethod: () => 'Payment method is required for this plan',
  planDowngradeRestricted: () => 'Cannot downgrade directly from Enterprise to Starter. Please contact support.',
  
  // Array errors
  arrayTooShort: (field: string, min: number) => 
    `Please select at least ${min} ${getFieldDisplayName(field).toLowerCase()}`,
  arrayTooLong: (field: string, max: number) => 
    `Please select at most ${max} ${getFieldDisplayName(field).toLowerCase()}`,
  arrayEmpty: (field: string) => 
    `Please select at least one ${getFieldDisplayName(field).toLowerCase()}`,
  
  // File errors
  fileTooLarge: (maxSize: string) => 
    `File size must be less than ${maxSize}`,
  invalidFileType: (allowedTypes: string[]) => 
    `File type must be one of: ${allowedTypes.join(', ')}`,
  
  // Generic errors
  invalidValue: (field: string) => 
    `${getFieldDisplayName(field)} is invalid`,
  invalidSelection: (field: string, validOptions: string[]) => 
    `${getFieldDisplayName(field)} must be one of: ${validOptions.join(', ')}`,
  
  // Custom validation errors
  custom: (message: string) => message
}

/**
 * Get display name for a field
 */
function getFieldDisplayName(field: string): string {
  return FIELD_DISPLAY_NAMES[field] || 
    field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

/**
 * Get contextual help text for fields
 */
export const FIELD_HELP_TEXT: Record<string, string> = {
  dunsNumber: 'A 9-digit identifier for your business',
  cageCode: 'A 5-character code assigned to suppliers',
  einNumber: 'Your Employer Identification Number (format: XX-XXXXXXX)',
  naicsCodes: 'Select all industry codes that apply to your business',
  setAsideTypes: 'Select certifications your business holds',
  samRegistrationDate: 'Date your SAM.gov registration was approved',
  samExpirationDate: 'Date your SAM.gov registration expires',
  responseDeadline: 'The deadline for submitting proposals',
  reminderDate: 'When you want to be reminded about this opportunity',
  valueAmount: 'Estimated contract value range',
  placeOfPerformance: 'Where the work will be performed'
}

/**
 * Get validation hint for a field
 */
export function getFieldHint(field: string): string | undefined {
  return FIELD_HELP_TEXT[field]
}