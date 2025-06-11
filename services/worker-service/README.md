# Worker Service

Background job processing service for MedContractHub platform.

## Features

- **Email Processing**: Send notifications, reminders, and reports
- **Document Generation**: Create PDFs, Excel files, and CSVs
- **Data Synchronization**: Sync with SAM.gov and other external sources
- **Scheduled Jobs**: Automated tasks with cron-like scheduling
- **Queue Management**: BullMQ-based job queues with Redis
- **Monitoring**: Prometheus metrics and Bull Board UI

## Architecture

```
Worker Service
├── Email Queue
│   ├── Welcome emails
│   ├── Opportunity reminders
│   ├── Proposal notifications
│   └── Weekly summaries
├── Document Queue
│   ├── Report generation
│   ├── Data exports
│   ├── Attachment processing
│   └── Compliance matrices
├── Sync Queue
│   ├── SAM.gov opportunities
│   ├── Entity data
│   ├── Analytics refresh
│   └── Data cleanup
└── Scheduled Jobs
    ├── Daily reminders
    ├── SAM.gov sync
    ├── Data cleanup
    └── Weekly reports
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

```env
# Service Configuration
SERVICE_NAME=worker-service
PORT=8500
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=worker-service
KAFKA_GROUP_ID=worker-service-group

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Email
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@medcontracthub.com
SENDGRID_API_KEY=your-api-key

# SAM.gov
SAM_GOV_API_KEY=your-api-key
SAM_GOV_BASE_URL=https://api.sam.gov

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

## Queue Management

### Bull Board UI

Access the queue management UI at: `http://localhost:8500/admin/queues`

### Adding Jobs

```typescript
// Email job
await queueManager.addJob('email', 'send-reminder', {
  type: 'opportunity-reminder',
  data: {
    userId: 'user-123',
    email: 'user@example.com',
    opportunities: [...]
  }
});

// Document job
await queueManager.addJob('document', 'generate-report', {
  type: 'generate-report',
  data: {
    userId: 'user-123',
    reportType: 'analytics',
    format: 'pdf'
  }
});

// Sync job
await queueManager.addJob('sync', 'sam-gov-sync', {
  type: 'sam-gov-opportunities',
  data: {
    fullSync: false,
    dateRange: { start: '2024-01-01', end: '2024-01-31' }
  }
});
```

## Scheduled Jobs

Configured in `config/index.ts`:

- **Email Reminders**: Daily at 9 AM
- **SAM.gov Sync**: Every 6 hours
- **Data Cleanup**: Daily at 2 AM
- **Report Generation**: Weekly on Monday at 8 AM

## Monitoring

### Health Check
```bash
curl http://localhost:8500/health
```

### Metrics
```bash
curl http://localhost:8500/metrics
```

### Key Metrics
- `worker_jobs_processed_total`: Total jobs processed
- `worker_job_duration_seconds`: Job processing time
- `worker_active_jobs`: Currently processing jobs
- `worker_queue_size`: Jobs waiting in queue
- `worker_emails_sent_total`: Emails sent
- `worker_sync_operations_total`: Sync operations completed

## Error Handling

- Automatic retries with exponential backoff
- Dead letter queues for failed jobs
- Sentry integration for error tracking
- Structured logging with correlation IDs

## Deployment

```bash
# Build Docker image
docker build -t medcontracthub/worker-service:latest .

# Run with Docker
docker run -d \
  --name worker-service \
  -p 8500:8500 \
  --env-file .env \
  medcontracthub/worker-service:latest
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```