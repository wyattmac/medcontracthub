/**
 * Comprehensive File Upload Security Validation
 * Validates file content, not just MIME types which can be spoofed
 */

import { apiLogger } from '@/lib/errors/logger'

export interface FileValidationResult {
  isValid: boolean
  fileType?: string
  actualMimeType?: string
  securityIssues: string[]
  metadata?: {
    size: number
    extension: string
    detectedType: string
  }
}

export interface FileValidationOptions {
  maxSize: number // bytes
  allowedTypes: string[]
  allowedExtensions: string[]
  validateContent: boolean
  scanForMalware?: boolean
}

// File signature magic bytes for validation
const FILE_SIGNATURES = {
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'application/zip': [
    [0x50, 0x4B, 0x03, 0x04], // ZIP
    [0x50, 0x4B, 0x05, 0x06], // ZIP (empty)
  ]
} as const

// Dangerous file signatures to block
const DANGEROUS_SIGNATURES = [
  [0x4D, 0x5A], // PE/EXE files (MZ)
  [0x7F, 0x45, 0x4C, 0x46], // ELF executables
  [0x50, 0x4B, 0x03, 0x04], // ZIP (could contain malware)
  [0xCA, 0xFE, 0xBA, 0xBE], // Java class files
] as const

/**
 * Default file validation configurations
 */
export const FILE_VALIDATION_CONFIGS = {
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    validateContent: true
  },
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],
    validateContent: true
  },
  upload: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    validateContent: true,
    scanForMalware: true
  }
} as const

/**
 * Validate uploaded file with comprehensive security checks
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions
): Promise<FileValidationResult> {
  const securityIssues: string[] = []
  
  try {
    // Basic file properties
    const fileName = file.name.toLowerCase()
    const reportedType = file.type
    const fileSize = file.size
    const extension = fileName.substring(fileName.lastIndexOf('.'))
    
    apiLogger.info('Validating file upload', {
      fileName: file.name,
      reportedType,
      fileSize,
      extension
    })
    
    // 1. File size validation
    if (fileSize > options.maxSize) {
      securityIssues.push(`File size ${fileSize} exceeds maximum ${options.maxSize} bytes`)
    }
    
    if (fileSize === 0) {
      securityIssues.push('Empty file not allowed')
    }
    
    // 2. Extension validation
    if (!options.allowedExtensions.includes(extension)) {
      securityIssues.push(`File extension ${extension} not allowed`)
    }
    
    // 3. MIME type validation (basic check)
    if (!options.allowedTypes.includes(reportedType)) {
      securityIssues.push(`MIME type ${reportedType} not allowed`)
    }
    
    // 4. Content validation (file signature check)
    let detectedType = 'unknown'
    if (options.validateContent) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      
      // Check for dangerous file signatures
      for (const signature of DANGEROUS_SIGNATURES) {
        if (matchesSignature(bytes, signature)) {
          securityIssues.push('File contains potentially dangerous content')
          break
        }
      }
      
      // Detect actual file type from content
      detectedType = detectFileType(bytes)
      
      if (detectedType === 'unknown') {
        securityIssues.push('Unable to determine file type from content')
      } else if (detectedType !== reportedType) {
        securityIssues.push(`File content (${detectedType}) doesn't match reported type (${reportedType})`)
      }
      
      // Additional PDF-specific validation
      if (reportedType === 'application/pdf') {
        const pdfValidation = validatePDFContent(bytes)
        securityIssues.push(...pdfValidation)
      }
      
      // Image-specific validation
      if (reportedType.startsWith('image/')) {
        const imageValidation = validateImageContent(bytes, reportedType)
        securityIssues.push(...imageValidation)
      }
    }
    
    // 5. Filename security checks
    const filenameIssues = validateFilename(fileName)
    securityIssues.push(...filenameIssues)
    
    // 6. Advanced malware scanning (placeholder for future implementation)
    if (options.scanForMalware) {
      // TODO: Integrate with malware scanning service
      // For now, just perform basic heuristics
      const malwareHeuristics = performBasicMalwareHeuristics(file.name, reportedType)
      securityIssues.push(...malwareHeuristics)
    }
    
    const isValid = securityIssues.length === 0
    
    apiLogger.info('File validation completed', {
      fileName: file.name,
      isValid,
      detectedType,
      securityIssues: securityIssues.length
    })
    
    return {
      isValid,
      fileType: detectedType,
      actualMimeType: detectedType,
      securityIssues,
      metadata: {
        size: fileSize,
        extension,
        detectedType
      }
    }
    
  } catch (error) {
    apiLogger.error('File validation error', error)
    return {
      isValid: false,
      securityIssues: ['File validation failed due to processing error']
    }
  }
}

/**
 * Check if bytes match a file signature
 */
function matchesSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false
  }
  
  return true
}

/**
 * Detect file type from content signatures
 */
function detectFileType(bytes: Uint8Array): string {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (matchesSignature(bytes, signature)) {
        return mimeType
      }
    }
  }
  return 'unknown'
}

/**
 * Validate PDF-specific content
 */
function validatePDFContent(bytes: Uint8Array): string[] {
  const issues: string[] = []
  
  // Check for PDF structure
  const pdfStart = new TextDecoder().decode(bytes.slice(0, 8))
  if (!pdfStart.startsWith('%PDF-')) {
    issues.push('Invalid PDF header')
  }
  
  // Check for embedded JavaScript (security risk)
  const content = new TextDecoder().decode(bytes)
  if (content.includes('/JavaScript') || content.includes('/JS')) {
    issues.push('PDF contains JavaScript (potential security risk)')
  }
  
  // Check for embedded files
  if (content.includes('/EmbeddedFile')) {
    issues.push('PDF contains embedded files (potential security risk)')
  }
  
  return issues
}

/**
 * Validate image-specific content
 */
function validateImageContent(bytes: Uint8Array, mimeType: string): string[] {
  const issues: string[] = []
  
  // Check for EXIF data that might contain malicious content
  if (mimeType === 'image/jpeg') {
    // Look for EXIF marker
    for (let i = 0; i < Math.min(bytes.length - 1, 1000); i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1) {
        // EXIF data found - check for excessive size
        if (i < 100) { // EXIF should not be at the very beginning
          issues.push('Suspicious EXIF data positioning')
        }
        break
      }
    }
  }
  
  // Check for excessive metadata
  if (bytes.length > 100000) { // 100KB threshold for metadata check
    const dataRatio = calculateMetadataRatio(bytes, mimeType)
    if (dataRatio > 0.1) { // More than 10% metadata
      issues.push('Image contains excessive metadata')
    }
  }
  
  return issues
}

/**
 * Calculate ratio of metadata to actual image data
 */
function calculateMetadataRatio(bytes: Uint8Array, mimeType: string): number {
  // Simplified heuristic - in production, use proper image parsing
  if (mimeType === 'image/jpeg') {
    // Find start of scan data (0xFF 0xDA)
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xDA) {
        return i / bytes.length
      }
    }
  }
  return 0
}

/**
 * Validate filename for security issues
 */
function validateFilename(fileName: string): string[] {
  const issues: string[] = []
  
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    issues.push('Filename contains path traversal characters')
  }
  
  // Check for null bytes
  if (fileName.includes('\0')) {
    issues.push('Filename contains null bytes')
  }
  
  // Check for overly long filename
  if (fileName.length > 255) {
    issues.push('Filename too long')
  }
  
  // Check for suspicious characters
  const suspiciousChars = /[<>:"|?*\x00-\x1f]/
  if (suspiciousChars.test(fileName)) {
    issues.push('Filename contains suspicious characters')
  }
  
  // Check for reserved Windows names
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ]
  
  const baseName = fileName.substring(0, fileName.lastIndexOf('.')).toUpperCase()
  if (reservedNames.includes(baseName)) {
    issues.push('Filename uses reserved system name')
  }
  
  return issues
}

/**
 * Basic malware heuristics
 */
function performBasicMalwareHeuristics(fileName: string, mimeType: string): string[] {
  const issues: string[] = []
  
  // Check for double extensions
  const extensionCount = (fileName.match(/\./g) || []).length
  if (extensionCount > 1) {
    issues.push('Multiple file extensions detected (potential malware hiding technique)')
  }
  
  // Check for executable disguised as document
  const executableExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js']
  const lowerFileName = fileName.toLowerCase()
  
  for (const ext of executableExtensions) {
    if (lowerFileName.includes(ext)) {
      issues.push('Filename contains executable extension')
      break
    }
  }
  
  return issues
}

/**
 * Quick file type detection for streaming validation
 */
export function quickFileTypeCheck(fileName: string, mimeType: string): boolean {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  
  const typeMap = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  }
  
  return typeMap[extension as keyof typeof typeMap] === mimeType
}