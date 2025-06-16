#!/usr/bin/env tsx

/**
 * Generate secure secrets for production environment
 */

import crypto from 'crypto'

function generateSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64')
}

function generateHexSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

console.log('🔐 Generating secure secrets for production:\n')

console.log('CSRF_SECRET=' + generateSecret(32))
console.log('SYNC_TOKEN=' + generateHexSecret(32))

console.log('\n📝 Additional secrets you might need:\n')
console.log('# Session secret (if using sessions)')
console.log('SESSION_SECRET=' + generateSecret(32))

console.log('\n# JWT secret (if using custom JWT)')
console.log('JWT_SECRET=' + generateSecret(64))

console.log('\n# Encryption key (for sensitive data)')
console.log('ENCRYPTION_KEY=' + generateHexSecret(32))

console.log('\n⚠️  Remember to:')
console.log('1. Replace the test Stripe keys with production keys')
console.log('2. Set up production Redis URL')
console.log('3. Configure Sentry DSN for error monitoring')
console.log('4. Update NEXT_PUBLIC_APP_URL with your production domain')