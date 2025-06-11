import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Service Configuration
  SERVICE_NAME: process.env.SERVICE_NAME || 'integration-adapter',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  PORT: parseInt(process.env.PORT || '8200', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Main App Configuration
  MAIN_APP_URL: process.env.MAIN_APP_URL || 'http://localhost:3000',
  MAIN_APP_TIMEOUT: parseInt(process.env.MAIN_APP_TIMEOUT || '30000', 10),

  // Microservices Configuration
  OCR_SERVICE_URL: process.env.OCR_SERVICE_URL || 'http://localhost:8100',
  OCR_SERVICE_TIMEOUT: parseInt(process.env.OCR_SERVICE_TIMEOUT || '300000', 10),

  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600', 10),

  // Kafka Configuration
  KAFKA_BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'integration-adapter',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'integration-adapter-1',

  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
  CIRCUIT_BREAKER_ERROR_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50', 10),
  CIRCUIT_BREAKER_RESET_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),

  // Monitoring
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090', 10),

  // Mistral API Key (for backward compatibility)
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || ''
};