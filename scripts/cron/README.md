# Automated Opportunity Sync Setup

This directory contains scripts and documentation for setting up automated opportunity synchronization from SAM.gov.

## Quick Setup

### 1. Environment Variables

Add these to your production environment:

```bash
# Required
SYNC_TOKEN=your-secure-random-token-here
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional (these should already be set)
SAM_GOV_API_KEY=your-sam-gov-api-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
```

### 2. Cron Job Setup

Add this to your server's crontab to run sync every 6 hours:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM daily)
0 */6 * * * /path/to/medcontracthub/scripts/cron/sync-opportunities.sh --limit 500 >> /var/log/medcontracthub-cron.log 2>&1
```

### 3. Manual Testing

Test the sync script manually:

```bash
# Basic sync
./scripts/cron/sync-opportunities.sh

# Force full sync with higher limit
./scripts/cron/sync-opportunities.sh --force --limit 1000

# Test with different limits
./scripts/cron/sync-opportunities.sh --limit 100
```

## Deployment Options

### Option 1: Traditional Cron (Recommended for VPS/Dedicated Servers)

1. Deploy your Next.js app to your server
2. Set environment variables
3. Add cron job as shown above
4. Monitor logs at `/tmp/medcontracthub-sync.log`

### Option 2: Vercel Cron Jobs

For Vercel deployments, use Vercel Cron:

1. Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

2. Update the sync API route to handle direct cron calls

### Option 3: GitHub Actions (CI/CD Approach)

Create `.github/workflows/sync-opportunities.yml`:

```yaml
name: Sync Opportunities
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SYNC_TOKEN }}" \
            "${{ secrets.APP_URL }}/api/sync?limit=500"
```

### Option 4: External Cron Services

Use services like:
- **EasyCron**: Web-based cron service
- **Cronhub**: Cron monitoring and execution
- **Zapier**: Scheduled webhooks

Configure them to POST to: `https://your-domain.com/api/sync`

## Monitoring & Maintenance

### Log Files

- **Local logs**: `/tmp/medcontracthub-sync.log`
- **Application logs**: Check your application's logging service
- **Database logs**: Monitor the `audit_logs` table for sync events

### Health Checks

The sync script includes health checks. Monitor these endpoints:
- `GET /api/health` - Application health
- `GET /api/sync/status` - Sync status and statistics

### Troubleshooting

#### Common Issues:

1. **Authentication Errors**
   - Check `SYNC_TOKEN` environment variable
   - Verify API endpoints are accessible

2. **SAM.gov API Limits**
   - Reduce `--limit` parameter
   - Check SAM.gov API quota
   - Implement exponential backoff

3. **Database Errors**
   - Check Supabase connection
   - Monitor database performance
   - Review RLS policies

4. **Memory Issues**
   - Reduce batch sizes
   - Implement pagination for large syncs
   - Monitor server resources

#### Debug Commands:

```bash
# Check if cron job is running
ps aux | grep sync-opportunities

# View recent sync logs
tail -f /tmp/medcontracthub-sync.log

# Manual sync with verbose output
NEXT_PUBLIC_APP_URL=http://localhost:3000 ./scripts/cron/sync-opportunities.sh --limit 10

# Check sync status via API
curl "https://your-domain.com/api/sync/status"
```

## Performance Tuning

### Recommended Settings by Environment:

#### Development
- Limit: 50-100 opportunities
- Frequency: Manual or hourly for testing
- Full sync: Weekly

#### Production
- Limit: 500-1000 opportunities
- Frequency: Every 6 hours
- Full sync: Daily during off-peak hours

#### High-Volume Production
- Limit: 1000+ opportunities
- Frequency: Every 2-4 hours
- Multiple NAICS-specific syncs
- Dedicated sync server

### Optimization Tips:

1. **NAICS Filtering**: Sync only relevant industry codes
2. **Date Filtering**: Focus on recent opportunities
3. **Batch Processing**: Process in smaller chunks
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Monitoring**: Set up alerts for sync failures

## Security Considerations

1. **Secure Tokens**: Use strong, unique `SYNC_TOKEN`
2. **Environment Variables**: Never commit tokens to version control
3. **Network Security**: Restrict API access to known IPs if possible
4. **Logging**: Avoid logging sensitive information
5. **Monitoring**: Set up alerts for suspicious activity

## Scaling Considerations

For high-volume operations:

1. **Queue System**: Implement Redis/RabbitMQ for sync jobs
2. **Multiple Workers**: Run parallel sync processes
3. **Database Optimization**: Use read replicas for queries
4. **Caching**: Implement Redis for frequently accessed data
5. **Load Balancing**: Distribute sync load across multiple servers