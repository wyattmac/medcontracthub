import { z } from 'zod'

// Email validation with normalization
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim()

// Phone validation - supports US format with optional country code
export const phoneSchema = z
  .string()
  .regex(/^\+?1?\d{10,14}$/, 'Invalid phone number format')
  .transform((val) => {
    // Normalize to consistent format
    const digits = val.replace(/\D/g, '')
    if (digits.length === 10) {
      return `+1${digits}`
    }
    return `+${digits}`
  })

// UUID validation
export const uuidSchema = z.string().uuid('Invalid ID format')

// URL validation with protocol requirement
export const urlSchema = z
  .string()
  .url('Invalid URL')
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'URL must include http:// or https:// protocol',
  })

// Date validation - ISO 8601 datetime
export const dateSchema = z.string().datetime('Invalid date format (use ISO 8601)')

// DUNS number validation (9 digits)
export const dunsSchema = z
  .string()
  .regex(/^\d{9}$/, 'DUNS number must be exactly 9 digits')

// CAGE code validation (5 alphanumeric characters)
export const cageSchema = z
  .string()
  .regex(/^[A-Z0-9]{5}$/, 'CAGE code must be 5 alphanumeric characters')
  .transform((val) => val.toUpperCase())

// EIN validation (XX-XXXXXXX format)
export const einSchema = z
  .string()
  .regex(/^\d{2}-\d{7}$/, 'EIN must be in format: XX-XXXXXXX')

// NAICS code validation (6 digits)
export const naicsSchema = z
  .string()
  .regex(/^\d{6}$/, 'NAICS code must be exactly 6 digits')

// ZIP code validation (5 digits or 5+4 format)
export const zipSchema = z
  .string()
  .regex(/^\d{5}(?:-\d{4})?$/, 'Invalid ZIP code format')

// State code validation (2 letter abbreviation)
export const stateSchema = z
  .string()
  .length(2, 'State must be 2-letter abbreviation')
  .regex(/^[A-Z]{2}$/, 'Invalid state code')
  .transform((val) => val.toUpperCase())

// Currency amount validation
export const currencySchema = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

// Percentage validation (0-100)
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100')

// Pagination schemas
export const limitSchema = z
  .string()
  .transform(Number)
  .pipe(z.number().min(1).max(100))
  .default('25')

export const offsetSchema = z
  .string()
  .transform(Number)
  .pipe(z.number().min(0))
  .default('0')

// Common enum schemas
export const opportunityStatusSchema = z.enum([
  'active',
  'awarded',
  'cancelled',
  'expired',
])

export const proposalStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'awarded',
  'rejected',
])

export const subscriptionPlanSchema = z.enum(['starter', 'pro', 'enterprise'])

// Date range validation
export const dateRangeSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
  })
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: 'End date must be after start date',
  })

// Value range validation (for contract amounts)
export const valueRangeSchema = z
  .object({
    min: currencySchema,
    max: currencySchema,
  })
  .refine((data) => data.min <= data.max, {
    message: 'Maximum value must be greater than or equal to minimum value',
  })

// Address validation schema
export const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: stateSchema,
  zipCode: zipSchema,
})

// Place of performance schema
export const placeOfPerformanceSchema = z.object({
  state: stateSchema,
  city: z.string().optional(),
  zipCode: zipSchema.optional(),
})

// File upload validation
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  type: z.string().regex(/^(image|application)\/(jpeg|jpg|png|pdf|doc|docx)$/i, 'Invalid file type'),
})