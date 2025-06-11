# Data Recovery Runbook

## Overview

This runbook provides procedures for data recovery scenarios including database corruption, accidental deletion, and disaster recovery for MedContractHub microservices.

## Recovery Time Objectives

| Data Type | RTO | RPO | Backup Frequency |
|-----------|-----|-----|------------------|
| PostgreSQL (Primary) | 1 hour | 15 minutes | Continuous + Daily snapshots |
| Redis Cluster | 30 minutes | 1 hour | Hourly AOF + Daily RDB |
| ClickHouse | 2 hours | 1 hour | Hourly incremental |
| Weaviate | 4 hours | 24 hours | Daily full backup |
| Kafka | 1 hour | 30 minutes | Continuous replication |

## PostgreSQL Recovery Procedures

### 1. Point-in-Time Recovery (PITR)

**Scenario**: Need to recover to a specific point before data corruption

```bash
# 1. Stop all applications to prevent new writes
kubectl scale deployment --all --replicas=0 -n medcontract-prod

# 2. Identify recovery target time
RECOVERY_TIME="2024-01-15 14:30:00"

# 3. Create recovery configuration
cat > /tmp/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://medcontract-backups/postgres/wal/%f %p'
recovery_target_time = '${RECOVERY_TIME}'
recovery_target_action = 'promote'
EOF

# 4. Stop PostgreSQL
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  pg_ctl stop -D /var/lib/postgresql/data

# 5. Restore base backup
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  bash -c "rm -rf /var/lib/postgresql/data/* && \
  aws s3 cp s3://medcontract-backups/postgres/base/latest.tar.gz - | \
  tar -xzf - -C /var/lib/postgresql/data"

# 6. Copy recovery configuration
kubectl cp /tmp/recovery.conf medcontract-prod/postgres-primary-0:/var/lib/postgresql/data/

# 7. Start PostgreSQL in recovery mode
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  pg_ctl start -D /var/lib/postgresql/data

# 8. Verify recovery
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -c "SELECT pg_last_wal_replay_lsn();"

# 9. Restart applications
kubectl scale deployment --all --replicas=3 -n medcontract-prod
```

### 2. Restore from Daily Backup

```bash
# 1. List available backups
aws s3 ls s3://medcontract-backups/postgres/daily/ --recursive

# 2. Download specific backup
BACKUP_DATE="2024-01-14"
aws s3 cp s3://medcontract-backups/postgres/daily/backup-${BACKUP_DATE}.sql.gz ./

# 3. Stop applications
kubectl scale deployment --all --replicas=0 -n medcontract-prod

# 4. Drop and recreate database
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -c "DROP DATABASE IF EXISTS medcontracthub;"
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -c "CREATE DATABASE medcontracthub;"

# 5. Restore backup
gunzip -c backup-${BACKUP_DATE}.sql.gz | \
  kubectl exec -i -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres medcontracthub

# 6. Verify data
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -d medcontracthub -c "\dt"

# 7. Restart applications
kubectl scale deployment --all --replicas=3 -n medcontract-prod
```

### 3. Recover Deleted Records

```bash
# 1. Check if records are in event store
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -d medcontracthub -c "
    SELECT * FROM events 
    WHERE aggregate_type = 'opportunity' 
    AND aggregate_id = '<deleted-id>'
    ORDER BY timestamp DESC;"

# 2. Replay events to reconstruct state
kubectl exec -n medcontract-prod deploy/worker-service -- \
  npm run replay:events -- --aggregate-id=<deleted-id> --dry-run

# 3. If satisfied, replay without dry-run
kubectl exec -n medcontract-prod deploy/worker-service -- \
  npm run replay:events -- --aggregate-id=<deleted-id>
```

## Redis Cluster Recovery

### 1. Restore from RDB Snapshot

```bash
# 1. Stop Redis cluster
kubectl scale statefulset redis-cluster --replicas=0 -n medcontract-prod

# 2. Download latest backup
aws s3 cp s3://medcontract-backups/redis/latest-dump.rdb ./

# 3. Copy to each Redis node
for i in {0..5}; do
  kubectl cp latest-dump.rdb medcontract-prod/redis-cluster-$i:/data/dump.rdb
done

# 4. Start Redis cluster
kubectl scale statefulset redis-cluster --replicas=6 -n medcontract-prod

# 5. Verify cluster status
kubectl exec -n medcontract-prod redis-cluster-0 -- redis-cli cluster info
```

### 2. Restore from AOF

```bash
# 1. Check AOF files
kubectl exec -n medcontract-prod redis-cluster-0 -- ls -la /data/*.aof

# 2. Repair corrupted AOF
kubectl exec -n medcontract-prod redis-cluster-0 -- \
  redis-check-aof --fix /data/appendonly.aof

# 3. Restart with AOF
kubectl exec -n medcontract-prod redis-cluster-0 -- \
  redis-server --appendonly yes --appendfilename appendonly.aof
```

## ClickHouse Recovery

### 1. Restore Table from Backup

```bash
# 1. List available backups
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "SELECT * FROM system.backups"

# 2. Restore specific table
TABLE_NAME="analytics.opportunity_events"
BACKUP_NAME="daily-2024-01-14"

kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "
    RESTORE TABLE ${TABLE_NAME} 
    FROM Disk('backups', '${BACKUP_NAME}')
    SETTINGS allow_non_empty_tables=true"

# 3. Verify restoration
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "SELECT count(*) FROM ${TABLE_NAME}"
```

### 2. Rebuild Materialized Views

```bash
# 1. Drop corrupted materialized view
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "DROP TABLE IF EXISTS analytics.opportunity_daily_mv"

# 2. Recreate materialized view
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "
    CREATE MATERIALIZED VIEW analytics.opportunity_daily_mv
    ENGINE = SummingMergeTree()
    ORDER BY (date, opportunity_type)
    AS SELECT
      toDate(timestamp) as date,
      opportunity_type,
      count() as count,
      sum(value) as total_value
    FROM analytics.opportunity_events
    GROUP BY date, opportunity_type"

# 3. Backfill historical data
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "
    INSERT INTO analytics.opportunity_daily_mv
    SELECT
      toDate(timestamp) as date,
      opportunity_type,
      count() as count,
      sum(value) as total_value
    FROM analytics.opportunity_events
    WHERE timestamp < now() - INTERVAL 1 DAY
    GROUP BY date, opportunity_type"
```

## Weaviate Recovery

### 1. Restore from Backup

```bash
# 1. Stop Weaviate
kubectl scale deployment weaviate --replicas=0 -n medcontract-prod

# 2. Download backup
BACKUP_ID="backup-2024-01-14"
aws s3 sync s3://medcontract-backups/weaviate/${BACKUP_ID}/ /tmp/weaviate-restore/

# 3. Clear existing data
kubectl exec -n medcontract-prod weaviate-0 -- rm -rf /var/lib/weaviate/*

# 4. Restore data
kubectl cp /tmp/weaviate-restore/ medcontract-prod/weaviate-0:/var/lib/weaviate/

# 5. Start Weaviate
kubectl scale deployment weaviate --replicas=3 -n medcontract-prod

# 6. Verify schema
kubectl exec -n medcontract-prod deploy/ai-service -- \
  curl -s http://weaviate:8080/v1/schema | jq .
```

### 2. Reindex from Source

```bash
# 1. Trigger reindexing job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: weaviate-reindex-$(date +%s)
  namespace: medcontract-prod
spec:
  template:
    spec:
      containers:
      - name: reindex
        image: medcontracthub/ai-service:latest
        command: ["python", "-m", "scripts.reindex_weaviate"]
        env:
        - name: BATCH_SIZE
          value: "1000"
        - name: SOURCE_DB
          value: "postgresql://postgres:password@postgres-primary:5432/medcontracthub"
      restartPolicy: OnFailure
EOF

# 2. Monitor progress
kubectl logs -f job/weaviate-reindex-* -n medcontract-prod
```

## Kafka Recovery

### 1. Recover Lost Messages

```bash
# 1. Check topic retention
kubectl exec -n medcontract-prod kafka-0 -- \
  kafka-configs.sh --bootstrap-server kafka:9092 \
  --entity-type topics --entity-name contracts.opportunities.events \
  --describe

# 2. Reset consumer group offset
kubectl exec -n medcontract-prod kafka-0 -- \
  kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group analytics-consumer --topic contracts.opportunities.events \
  --reset-offsets --to-datetime 2024-01-14T10:00:00.000 --execute

# 3. Reprocess messages
kubectl scale deployment analytics-service --replicas=5 -n medcontract-prod
```

### 2. Restore Topic from Backup

```bash
# 1. Create new topic
kubectl exec -n medcontract-prod kafka-0 -- \
  kafka-topics.sh --create --bootstrap-server kafka:9092 \
  --topic contracts.opportunities.events.restored \
  --partitions 10 --replication-factor 3

# 2. Restore from S3 backup
kubectl exec -n medcontract-prod kafka-0 -- \
  kafka-mirror-maker.sh \
  --consumer.config /opt/kafka/config/backup-consumer.properties \
  --producer.config /opt/kafka/config/producer.properties \
  --whitelist="contracts.opportunities.events"
```

## Disaster Recovery Procedures

### 1. Complete Cluster Failure

```bash
# 1. Provision new cluster
eksctl create cluster -f k8s/infrastructure/eks-cluster.yaml

# 2. Install prerequisites
./scripts/setup-complete-k8s.sh

# 3. Restore persistent volumes from snapshots
aws ec2 describe-snapshots --filters Name=tag:Name,Values=medcontract-prod-*

# 4. Restore databases in order
./scripts/restore-databases.sh --env=prod --source=dr-backup

# 5. Deploy applications
kubectl apply -k k8s/overlays/prod/

# 6. Verify services
./scripts/verify-k8s-ready.sh --env=prod
```

### 2. Cross-Region Failover

```bash
# 1. Update DNS to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456 \
  --change-batch file://dns-failover.json

# 2. Scale up DR region
kubectl config use-context dr-region
kubectl scale deployment --all --replicas=3 -n medcontract-prod

# 3. Verify data sync status
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# 4. Promote DR database to primary
kubectl exec -n medcontract-prod postgres-replica-0 -- \
  pg_ctl promote -D /var/lib/postgresql/data
```

## Data Validation Procedures

### 1. Post-Recovery Validation

```bash
# 1. Run data integrity checks
kubectl apply -f jobs/data-validation-job.yaml -n medcontract-prod
kubectl wait --for=condition=complete job/data-validation -n medcontract-prod

# 2. Compare record counts
./scripts/validate-recovery.sh --source=backup --target=prod

# 3. Run smoke tests
kubectl apply -f tests/post-recovery-tests.yaml -n medcontract-prod

# 4. Verify business metrics
curl -s https://api.medcontracthub.com/api/health/detailed | jq .
```

### 2. Checksum Verification

```sql
-- PostgreSQL checksum
SELECT 
  tablename,
  pg_size_pretty(pg_relation_size(tablename::regclass)) as size,
  md5(CAST((array_agg(t.* ORDER BY id)) AS text)) as checksum
FROM opportunities t
GROUP BY tablename;

-- ClickHouse checksum
SELECT 
  table,
  sum(rows) as total_rows,
  sum(bytes_on_disk) as total_bytes,
  cityHash64(groupArray(data_hash)) as table_hash
FROM system.parts
WHERE active
GROUP BY table;
```

## Backup Verification

### Weekly Backup Tests

```bash
#!/bin/bash
# backup-test.sh

# 1. Restore to test environment
kubectl config use-context test-cluster
./scripts/restore-databases.sh --env=test --source=prod-backup

# 2. Run validation suite
pytest tests/backup-validation/ -v

# 3. Generate report
python scripts/backup-report.py --env=test --output=backup-test-$(date +%Y%m%d).html

# 4. Clean up test environment
kubectl delete namespace medcontract-test
```

## Prevention Measures

### 1. Automated Backup Monitoring
```yaml
# monitoring/backup-alerts.yaml
- alert: BackupFailed
  expr: time() - backup_last_success_timestamp > 86400
  for: 30m
  labels:
    severity: critical
  annotations:
    summary: "Backup failed for {{ $labels.database }}"
    description: "No successful backup in 24 hours"

- alert: BackupSizeDrop
  expr: |
    (backup_size_bytes - backup_size_bytes offset 1d) / backup_size_bytes offset 1d < -0.1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Backup size dropped significantly"
    description: "Backup size decreased by {{ $value | humanizePercentage }}"
```

### 2. Regular Recovery Drills
- Monthly: Table-level recovery test
- Quarterly: Full database recovery test
- Annually: Complete disaster recovery drill

## References

- [Backup Strategy](../architecture.md#disaster-recovery)
- [Database Architecture](../architecture.md#database-strategy)
- [Monitoring Setup](./monitoring.md)
- [Incident Response](./incident-response.md)
- [Security Procedures](./security.md)