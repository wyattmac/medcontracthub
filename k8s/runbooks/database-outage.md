# Runbook: Database Outage

## Alert: PostgreSQLDown

### Overview
Primary PostgreSQL database is not responding. This is a critical outage affecting all platform functionality.

### Impact
- Complete platform outage
- No user authentication
- No data reads/writes
- Revenue loss per minute: ~$500

### Severity: CRITICAL (Page immediately)

## Recovery Steps

### 1. Immediate Assessment (First 2 minutes)

```bash
# Check PostgreSQL pod status
kubectl get pods -n medcontracthub -l app=postgres-primary

# Check recent events
kubectl get events -n medcontracthub --field-selector involvedObject.name=postgres-primary-0

# Attempt connection
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  psql -U postgres -c "SELECT 1"
```

### 2. Quick Recovery Attempts

#### Restart Primary Pod
```bash
# Delete pod to force restart
kubectl delete pod postgres-primary-0 -n medcontracthub

# Monitor restart
kubectl get pod postgres-primary-0 -n medcontracthub -w
```

#### Check Disk Space
```bash
# Check PVC usage
kubectl exec -it postgres-primary-0 -n medcontracthub -- df -h /var/lib/postgresql/data

# If full, clean up
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  psql -U postgres -c "VACUUM FULL"
```

### 3. Failover to Replica (if primary unrecoverable)

```bash
# Promote replica to primary
kubectl exec -it postgres-replica-0 -n medcontracthub -- \
  pg_ctl promote -D /var/lib/postgresql/data

# Update service to point to new primary
kubectl patch service postgres-primary -n medcontracthub \
  -p '{"spec":{"selector":{"statefulset.kubernetes.io/pod-name":"postgres-replica-0"}}}'

# Verify new primary
kubectl exec -it postgres-replica-0 -n medcontracthub -- \
  psql -U postgres -c "SELECT pg_is_in_recovery()"
```

### 4. Connection Recovery

```bash
# Clear connection pools
kubectl rollout restart deployment -n medcontracthub

# Verify connections
kubectl logs -n medcontracthub -l app=medcontracthub-app | tail -50
```

### 5. Data Integrity Checks

```bash
# Check replication lag (if using replicas)
kubectl exec -it postgres-replica-0 -n medcontracthub -- \
  psql -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag"

# Verify critical tables
kubectl exec -it postgres-primary-0 -n medcontracthub -- psql -U postgres <<EOF
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM opportunities;
SELECT COUNT(*) FROM proposals;
SELECT MAX(created_at) FROM audit_logs;
EOF
```

### 6. Restore from Backup (Last Resort)

```bash
# List available backups
./k8s/scripts/backup-restore.sh list

# Restore latest backup
BACKUP_FILE=$(./k8s/scripts/backup-restore.sh list | grep postgres | tail -1)
./k8s/scripts/backup-restore.sh restore postgres $BACKUP_FILE

# Verify restoration
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  psql -U postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
```

## Prevention Measures

1. **Enable automated failover** with Patroni
2. **Increase monitoring frequency** for database health
3. **Set up connection pooling** with PgBouncer
4. **Configure proper resource limits**
5. **Test failover procedures monthly**

## Communication Template

```
Subject: Database Outage - All Services Affected

Current Status: Investigating database connectivity issue
Impact: All platform features temporarily unavailable
ETA: 15 minutes for initial recovery
Updates: Every 5 minutes at https://status.medcontracthub.com

Actions taken:
- Database team engaged
- Failover procedure initiated
- Backup restoration prepared as contingency
```

## Escalation Path

- **0 min**: Primary DBA on-call
- **5 min**: Secondary DBA + Platform lead
- **10 min**: Engineering Manager
- **15 min**: VP Engineering + Customer Success lead
- **20 min**: CEO (if still unresolved)

## Post-Incident Requirements

1. **RCA within 24 hours**
2. **Customer communication** about data integrity
3. **Backup verification** test
4. **Failover drill** scheduled
5. **Monitoring improvements** implemented