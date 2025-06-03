import crypto from 'crypto'

/**
 * Secure secrets management utilities
 * Handles encryption and secure storage of sensitive data
 */

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

/**
 * Derives a key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
}

/**
 * Encrypts sensitive data
 */
export function encryptSecret(text: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(password, salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted])
  
  return combined.toString('base64')
}

/**
 * Decrypts sensitive data
 */
export function decryptSecret(encryptedData: string, password: string): string {
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract components
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  
  const key = deriveKey(password, salt)
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])
  
  return decrypted.toString('utf8')
}

/**
 * Generates a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hashes sensitive data (one-way)
 */
export function hashSecret(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
}

/**
 * Compares a plain text secret with a hash (timing-safe)
 */
export function compareSecrets(plain: string, hashed: string): boolean {
  const plainHash = hashSecret(plain)
  return crypto.timingSafeEqual(
    Buffer.from(plainHash),
    Buffer.from(hashed)
  )
}

/**
 * Masks sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length)
  }
  
  const start = data.slice(0, visibleChars)
  const end = data.slice(-visibleChars)
  const masked = '*'.repeat(Math.max(4, data.length - visibleChars * 2))
  
  return `${start}${masked}${end}`
}

/**
 * Validates API key format
 */
export function isValidApiKey(key: string, prefix?: string): boolean {
  if (!key || key.length < 20) return false
  if (prefix && !key.startsWith(prefix)) return false
  
  // Check for common patterns that indicate placeholder keys
  const placeholders = [
    'your_',
    'xxx',
    'placeholder',
    'example',
    'test',
    '123456',
    'abcdef'
  ]
  
  const lowerKey = key.toLowerCase()
  return !placeholders.some(p => lowerKey.includes(p))
}

/**
 * Rotates API keys by generating a new key while keeping old one temporarily active
 */
export interface RotatedKey {
  newKey: string
  oldKey: string
  rotatedAt: Date
  expiresAt: Date
}

export function rotateApiKey(currentKey: string): RotatedKey {
  return {
    newKey: generateSecureToken(48),
    oldKey: currentKey,
    rotatedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
}