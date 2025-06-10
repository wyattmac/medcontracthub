// Validation Constants and Patterns

// Regular Expression Patterns
export const REGEX_PATTERNS = {
  PHONE_US: /^\+?1?\d{10,14}$/,
  DUNS: /^\d{9}$/,
  CAGE: /^[A-Z0-9]{5}$/,
  EIN: /^\d{2}-\d{7}$/,
  NAICS: /^\d{6}$/,
  ZIP: /^\d{5}(?:-\d{4})?$/,
  STATE: /^[A-Z]{2}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  SAM_NOTICE_ID: /^[A-Z0-9-]+$/,
  ALPHANUMERIC: /^[A-Z0-9]+$/i,
} as const

// Validation Limits
export const VALIDATION_LIMITS = {
  // Text lengths
  TITLE_MIN: 1,
  TITLE_MAX: 500,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 5000,
  SHORT_TEXT_MAX: 100,
  LONG_TEXT_MAX: 2000,
  
  // Numbers
  PAGINATION_MAX: 100,
  FILE_SIZE_MAX: 10 * 1024 * 1024, // 10MB
  CURRENCY_MAX: 999999999.99,
  
  // Arrays
  TAGS_MAX: 20,
  ATTACHMENTS_MAX: 10,
  NAICS_CODES_MAX: 10,
} as const

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  INVALID: (field: string) => `${field} is invalid`,
  TOO_SHORT: (field: string, min: number) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field: string, max: number) => `${field} must be at most ${max} characters`,
  OUT_OF_RANGE: (field: string, min: number, max: number) => `${field} must be between ${min} and ${max}`,
  INVALID_FORMAT: (field: string, format: string) => `${field} must be in format: ${format}`,
  PAST_DATE: (field: string) => `${field} must be in the future`,
  FUTURE_DATE: (field: string) => `${field} must be in the past`,
  INVALID_ENUM: (field: string, values: string[]) => `${field} must be one of: ${values.join(', ')}`,
} as const

// Valid US State Codes
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', // Washington D.C.
] as const

// Common Set-Aside Types
export const SET_ASIDE_TYPES = [
  'Small Business',
  'Women-Owned Small Business (WOSB)',
  'Economically Disadvantaged WOSB (EDWOSB)',
  'HUBZone Small Business',
  'Service-Disabled Veteran-Owned Small Business (SDVOSB)',
  'Veteran-Owned Small Business (VOSB)',
  '8(a) Business Development',
  'Native American Owned',
  'Total Small Business',
] as const

// Contract Types
export const CONTRACT_TYPES = {
  SUPPLY: 'supply',
  SERVICE: 'service',
  CONSTRUCTION: 'construction',
  RESEARCH: 'research',
} as const

// Certification Types
export const CERTIFICATION_TYPES = [
  'Small Business',
  'WOSB',
  'EDWOSB',
  'HUBZone',
  'SDVOSB',
  'VOSB',
  '8(a)',
  'Native American',
  'ISO 9001',
  'ISO 13485',
  'FDA Registered',
  'GSA Schedule',
] as const

// File Types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const

// All allowed file types combined
export const ALL_ALLOWED_FILE_TYPES = [
  ...ALLOWED_FILE_TYPES.IMAGES,
  ...ALLOWED_FILE_TYPES.DOCUMENTS,
  ...ALLOWED_FILE_TYPES.SPREADSHEETS,
] as const