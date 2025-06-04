#!/usr/bin/env tsx

/**
 * Production Environment Validation Script
 * Validates all required environment variables are set for production
 */

import { checkProductionReadiness } from '../lib/config/production'
import { validateEnvironment } from '../lib/security/env-validator'
import chalk from 'chalk'

interface ValidationResult {
  variable: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  value?: string
}

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SAM_GOV_API_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'REDIS_URL',
  'CSRF_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'SENTRY_DSN'
]

const recommendedVars = [
  'DB_MAX_CONNECTIONS',
  'DB_MIN_CONNECTIONS',
  'DB_CONNECTION_TIMEOUT',
  'RATE_LIMIT_ENABLED',
  'CACHE_ENABLED',
  'MISTRAL_API_KEY',
  'BRAVE_SEARCH_API_KEY'
]

function validateVariable(name: string, required: boolean = false): ValidationResult {
  const value = process.env[name]
  
  if (!value) {
    return {
      variable: name,
      status: required ? 'fail' : 'warning',
      message: required ? 'Required variable not set' : 'Recommended variable not set'
    }
  }
  
  // Check for placeholder values
  const placeholders = ['your_', 'YOUR_', 'example', 'EXAMPLE', 'placeholder', 'PLACEHOLDER']
  if (placeholders.some(p => value.includes(p))) {
    return {
      variable: name,
      status: 'fail',
      message: 'Variable contains placeholder value',
      value: value.substring(0, 20) + '...'
    }
  }
  
  // Validate specific formats
  if (name === 'NEXT_PUBLIC_SUPABASE_URL' && !value.startsWith('https://')) {
    return {
      variable: name,
      status: 'fail',
      message: 'Supabase URL must start with https://'
    }
  }
  
  if (name === 'REDIS_URL' && !value.startsWith('redis://')) {
    return {
      variable: name,
      status: 'fail',
      message: 'Redis URL must start with redis://'
    }
  }
  
  if (name === 'CSRF_SECRET' && value.length < 32) {
    return {
      variable: name,
      status: 'fail',
      message: 'CSRF secret must be at least 32 characters'
    }
  }
  
  if (name.includes('_KEY') && value.length < 20) {
    return {
      variable: name,
      status: 'warning',
      message: 'API key seems too short'
    }
  }
  
  return {
    variable: name,
    status: 'pass',
    message: 'Variable is set'
  }
}

function validateNumericVar(name: string, min?: number, max?: number): ValidationResult {
  const value = process.env[name]
  
  if (!value) {
    return {
      variable: name,
      status: 'warning',
      message: 'Variable not set'
    }
  }
  
  const numValue = parseInt(value)
  
  if (isNaN(numValue)) {
    return {
      variable: name,
      status: 'fail',
      message: 'Value must be a number',
      value
    }
  }
  
  if (min !== undefined && numValue < min) {
    return {
      variable: name,
      status: 'fail',
      message: `Value must be at least ${min}`,
      value
    }
  }
  
  if (max !== undefined && numValue > max) {
    return {
      variable: name,
      status: 'fail',
      message: `Value must be at most ${max}`,
      value
    }
  }
  
  return {
    variable: name,
    status: 'pass',
    message: 'Variable is valid'
  }
}

async function main() {
  console.log(chalk.blue('\n🔍 Validating Production Environment Configuration\n'))
  
  const results: ValidationResult[] = []
  
  // Check required variables
  console.log(chalk.yellow('Required Variables:'))
  for (const varName of requiredVars) {
    const result = validateVariable(varName, true)
    results.push(result)
    
    const icon = result.status === 'pass' ? '✅' : '❌'
    const color = result.status === 'pass' ? chalk.green : chalk.red
    console.log(`${icon} ${color(varName.padEnd(35))} ${result.message}`)
    if (result.value) {
      console.log(`   ${chalk.gray(`Value: ${result.value}`)}`)
    }
  }
  
  // Check recommended variables
  console.log(chalk.yellow('\n\nRecommended Variables:'))
  for (const varName of recommendedVars) {
    const result = validateVariable(varName, false)
    results.push(result)
    
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌'
    const color = result.status === 'pass' ? chalk.green : result.status === 'warning' ? chalk.yellow : chalk.red
    console.log(`${icon} ${color(varName.padEnd(35))} ${result.message}`)
  }
  
  // Check numeric configurations
  console.log(chalk.yellow('\n\nNumeric Configurations:'))
  const numericChecks = [
    { name: 'DB_MAX_CONNECTIONS', min: 5, max: 100 },
    { name: 'DB_MIN_CONNECTIONS', min: 1, max: 50 },
    { name: 'DB_CONNECTION_TIMEOUT', min: 1000, max: 300000 },
    { name: 'RATE_LIMIT_WINDOW', min: 60, max: 3600 },
    { name: 'RATE_LIMIT_MAX_REQUESTS', min: 10, max: 1000 }
  ]
  
  for (const check of numericChecks) {
    const result = validateNumericVar(check.name, check.min, check.max)
    results.push(result)
    
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌'
    const color = result.status === 'pass' ? chalk.green : result.status === 'warning' ? chalk.yellow : chalk.red
    console.log(`${icon} ${color(check.name.padEnd(35))} ${result.message}`)
  }
  
  // Check production readiness
  console.log(chalk.yellow('\n\nProduction Readiness Check:'))
  const readiness = checkProductionReadiness()
  
  if (readiness.ready) {
    console.log(chalk.green('✅ Environment is ready for production!'))
  } else {
    console.log(chalk.red('❌ Environment is NOT ready for production:'))
    readiness.issues.forEach(issue => {
      console.log(chalk.red(`   - ${issue}`))
    })
  }
  
  // Summary
  const failCount = results.filter(r => r.status === 'fail').length
  const warnCount = results.filter(r => r.status === 'warning').length
  const passCount = results.filter(r => r.status === 'pass').length
  
  console.log(chalk.blue('\n\n📊 Summary:'))
  console.log(chalk.green(`   ✅ Passed: ${passCount}`))
  console.log(chalk.yellow(`   ⚠️  Warnings: ${warnCount}`))
  console.log(chalk.red(`   ❌ Failed: ${failCount}`))
  
  if (failCount > 0) {
    console.log(chalk.red('\n❌ Production environment validation FAILED'))
    console.log(chalk.red('Please fix the failed checks before deploying to production.\n'))
    process.exit(1)
  } else if (warnCount > 0) {
    console.log(chalk.yellow('\n⚠️  Production environment validation passed with warnings'))
    console.log(chalk.yellow('Consider addressing the warnings for optimal production performance.\n'))
  } else {
    console.log(chalk.green('\n✅ Production environment validation PASSED'))
    console.log(chalk.green('Your environment is ready for production deployment!\n'))
  }
}

// Run the validation
main().catch(error => {
  console.error(chalk.red('Error running validation:'), error)
  process.exit(1)
})