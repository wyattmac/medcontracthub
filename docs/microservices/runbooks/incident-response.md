# Incident Response Runbook

## Overview

This runbook defines the incident response process for MedContractHub, including roles, procedures, communication protocols, and post-incident activities.

## Incident Classification

### Severity Levels

| Level | Definition | Examples | Response Time | Leadership |
|-------|------------|----------|---------------|------------|
| SEV1 | Complete outage or data loss | Platform down, data breach, corruption | < 5 min | VP Engineering |
| SEV2 | Major functionality impaired | Payment processing down, auth failures | < 15 min | Engineering Manager |
| SEV3 | Minor functionality impaired | Slow performance, isolated errors | < 30 min | Tech Lead |
| SEV4 | Minimal impact | UI glitches, non-critical bugs | < 2 hours | On-call Engineer |

### Impact Assessment Matrix

| | <100 users | 100-1000 users | >1000 users |
|---|---|---|---|
| **Complete outage** | SEV2 | SEV1 | SEV1 |
| **Feature unavailable** | SEV3 | SEV2 | SEV1 |
| **Degraded performance** | SEV4 | SEV3 | SEV2 |
| **Visual/cosmetic** | SEV4 | SEV4 | SEV4 |

## Incident Response Roles

### Incident Commander (IC)
- Overall incident coordination
- Decision making authority
- External communication
- Resource allocation

### Technical Lead (TL)
- Technical investigation
- Solution implementation
- Team coordination
- Progress updates to IC

### Communications Lead (CL)
- Customer notifications
- Internal updates
- Status page updates
- Stakeholder communication

### Subject Matter Experts (SME)
- Domain-specific expertise
- Technical consultation
- Implementation support

## Initial Response Procedure

### 1. Detection & Alert
```bash
# Alert received via:
# - PagerDuty
# - Monitoring alerts
# - Customer reports
# - Internal discovery
```

### 2. Acknowledge & Assess
```bash
# Acknowledge alert
pd-cli incident acknowledge <incident-id>

# Quick assessment (< 2 minutes)
- What is broken?
- How many users affected?
- Is data at risk?
- What is the business impact?
```

### 3. Declare Incident
```bash
# Create incident channel
/incident declare [SEV1-4] [description]

# This automatically:
# - Creates #incident-YYYYMMDD-#### Slack channel
# - Pages on-call team
# - Creates incident document
# - Starts incident timer
```

### 4. Assemble Response Team
```yaml
SEV1:
  - Incident Commander: VP Engineering or delegate
  - Technical Lead: Senior engineer
  - Communications: Customer Success lead
  - SMEs: As needed

SEV2:
  - Incident Commander: Engineering Manager
  - Technical Lead: On-call engineer
  - Communications: Support lead

SEV3-4:
  - Lead: On-call engineer
  - Support: Team members as needed
```

## Investigation Procedures

### 1. Initial Triage Checklist
```bash
# System status
kubectl get pods -A | grep -v Running
kubectl get nodes
kubectl top nodes

# Recent changes
kubectl get events -A --sort-by='.lastTimestamp' | tail -20
helm history medcontracthub -n medcontract-prod

# Error rates
curl -s http://prometheus:9090/api/v1/query?query='sum(rate(http_requests_total{status=~"5.."}[5m]))' | jq .

# Check dashboards
open https://grafana.medcontracthub.com/d/executive-overview
```

### 2. Service-Specific Investigation

#### Main Application Issues
```bash
# Check app logs
kubectl logs -n medcontract-prod -l app=medcontracthub-app --tail=100

# Check database connectivity
kubectl exec -n medcontract-prod deploy/medcontracthub-app -- npm run db:health

# Check external services
kubectl exec -n medcontract-prod deploy/medcontracthub-app -- curl -s https://api.sam.gov/status
```

#### Microservice Issues
```bash
# Check service health
for service in ocr-service ai-service analytics-service realtime-service worker-service; do
  echo "Checking $service..."
  kubectl exec -n medcontract-prod deploy/${service} -- wget -qO- localhost:8080/health || echo "FAILED"
done

# Check Kafka lag
kubectl exec -n medcontract-prod kafka-0 -- \
  kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --all-groups
```

#### Database Issues
```bash
# PostgreSQL
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"

# Redis
kubectl exec -n medcontract-prod redis-cluster-0 -- redis-cli cluster info

# ClickHouse
kubectl exec -n medcontract-prod clickhouse-0 -- \
  clickhouse-client --query "SELECT * FROM system.clusters"
```

### 3. Data Collection
```bash
# Capture logs
./scripts/collect-incident-logs.sh --incident-id=INC-001 --duration=1h

# Capture metrics
./scripts/export-incident-metrics.sh --start="1 hour ago" --end=now

# Take heap dump if memory issue
kubectl exec -n medcontract-prod <pod-name> -- jmap -dump:format=b,file=/tmp/heap.bin 1
kubectl cp medcontract-prod/<pod-name>:/tmp/heap.bin ./heap-$(date +%s).bin
```

## Mitigation Strategies

### Quick Mitigation Options

#### 1. Circuit Breaker
```bash
# Enable circuit breaker for problematic service
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: circuit-breaker-emergency
  namespace: medcontract-prod
spec:
  host: <service-name>
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 1
      interval: 5s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
EOF
```

#### 2. Traffic Diversion
```bash
# Divert traffic to healthy region/zone
kubectl patch service <service-name> -n medcontract-prod -p \
  '{"spec":{"selector":{"zone":"us-east-1a"}}}'

# Or route to maintenance page
kubectl apply -f emergency/maintenance-page.yaml
```

#### 3. Resource Scaling
```bash
# Emergency scale up
kubectl scale deployment <service-name> --replicas=10 -n medcontract-prod

# Add more nodes if needed
eksctl scale nodegroup --cluster=medcontract-prod --name=workers --nodes=10
```

#### 4. Feature Flags
```bash
# Disable problematic feature
kubectl set env deployment/medcontracthub-app \
  FEATURE_AI_PROPOSALS=false \
  FEATURE_OCR_PROCESSING=false \
  -n medcontract-prod
```

### Rollback Procedures

#### Application Rollback
```bash
# Check rollout history
kubectl rollout history deployment/<service-name> -n medcontract-prod

# Rollback to previous version
kubectl rollout undo deployment/<service-name> -n medcontract-prod

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> --to-revision=5 -n medcontract-prod
```

#### Database Rollback
```bash
# For migrations, see Data Recovery Runbook
./scripts/rollback-migration.sh --version=v1.2.2
```

## Communication Templates

### Initial Customer Notification
```
Subject: MedContractHub Service Disruption

We are currently experiencing issues with [affected service]. Our team has been notified and is actively working on a resolution.

Impact: [Brief description of impact]
Start time: [ISO timestamp]

We will provide updates every 30 minutes at: https://status.medcontracthub.com

We apologize for any inconvenience.
```

### Internal Update Template
```
🚨 INCIDENT UPDATE - [SEV#] - [Time since start]

Current Status: [Investigating/Identified/Monitoring/Resolved]

Summary: [1-2 sentences on current situation]

Recent Actions:
- [Action 1 and result]
- [Action 2 and result]

Next Steps:
- [Planned action 1]
- [Planned action 2]

Need Help With:
- [Specific expertise needed]
- [Resources required]

IC: @person | TL: @person | CL: @person
```

### Resolution Notice
```
Subject: MedContractHub Service Restored

The issue affecting [service] has been resolved. All systems are now operating normally.

Duration: [start time] - [end time] ([total duration])
Root cause: [Brief, non-technical explanation]

We sincerely apologize for the disruption. A detailed post-mortem will be published within 48 hours.

If you continue to experience issues, please contact support@medcontracthub.com
```

## Post-Incident Procedures

### 1. Immediate Actions (within 2 hours)
```bash
# Verify system stability
./scripts/post-incident-validation.sh

# Document timeline while fresh
cat > incidents/INC-001-timeline.md <<EOF
# Incident Timeline INC-001

- 14:32 - First alert received
- 14:33 - On-call engineer acknowledged
- 14:35 - Incident declared SEV2
- ...
EOF

# Preserve evidence
./scripts/preserve-incident-data.sh --incident-id=INC-001
```

### 2. Post-Mortem Process (within 48 hours)

#### Post-Mortem Template
```markdown
# Post-Mortem: [Incident ID] - [Brief Description]

**Date**: [YYYY-MM-DD]
**Authors**: [Names]
**Status**: [Draft/Final]
**Severity**: SEV[1-4]
**Duration**: [Total time]

## Executive Summary
[2-3 sentences summarizing the incident and impact]

## Impact
- **Customer Impact**: [# affected, how they were affected]
- **Revenue Impact**: [$amount or estimate]
- **Data Impact**: [any data loss/corruption]

## Timeline
[Use UTC times]
- HH:MM - Event description
- HH:MM - Event description

## Root Cause
[Technical explanation of what went wrong]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## What Went Well
- [Positive aspect 1]
- [Positive aspect 2]

## What Didn't Go Well
- [Issue 1]
- [Issue 2]

## Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| [Action 1] | @person | YYYY-MM-DD | P0 |
| [Action 2] | @person | YYYY-MM-DD | P1 |

## Lessons Learned
[Key takeaways for the organization]

## Supporting Information
- [Link to logs]
- [Link to graphs]
- [Link to code changes]
```

### 3. Follow-Up Actions

#### Action Item Tracking
```yaml
# Create Jira tickets for each action item
jira create \
  --project=PLATFORM \
  --type=Task \
  --priority=High \
  --summary="[INC-001] Implement automated failover" \
  --description="From incident post-mortem" \
  --labels=incident-followup,sev2
```

#### Process Improvements
- Update runbooks with new findings
- Enhance monitoring for missed signals
- Improve alerting rules
- Update automation scripts

#### Training & Communication
- Share learnings in engineering all-hands
- Update on-call training materials
- Customer communication if needed
- Blog post for significant incidents

## Incident Metrics

### Key Metrics to Track
```sql
-- MTTD (Mean Time To Detect)
SELECT AVG(acknowledged_at - created_at) as mttd
FROM incidents
WHERE created_at > NOW() - INTERVAL '30 days';

-- MTTR (Mean Time To Resolve)
SELECT AVG(resolved_at - created_at) as mttr
FROM incidents
WHERE created_at > NOW() - INTERVAL '30 days';

-- Incident Frequency
SELECT 
  DATE_TRUNC('week', created_at) as week,
  severity,
  COUNT(*) as incidents
FROM incidents
GROUP BY week, severity
ORDER BY week DESC;
```

### SLO Impact Calculation
```bash
# Calculate error budget impact
python scripts/calculate-slo-impact.py \
  --start-time="2024-01-15T14:32:00Z" \
  --end-time="2024-01-15T15:45:00Z" \
  --service="medcontracthub-app"
```

## War Room Setup

### Physical War Room
- Location: Conference Room A
- Equipment: 
  - Large displays for dashboards
  - Whiteboard for timeline
  - Phone for conference bridge
  - Power strips and ethernet

### Virtual War Room
- Slack: #incident-[date]-[number]
- Zoom: Standing incident bridge
- Shared doc: Google Doc for live notes
- Dashboard: Incident-specific Grafana

### War Room Etiquette
1. Mute when not speaking
2. Use thread for side discussions
3. No blame during incident
4. Focus on resolution, not root cause
5. Regular status updates (15-30 min)

## External Resources

### Emergency Contacts
- AWS Support: 1-800-xxx-xxxx (Enterprise Support)
- Stripe Support: support@stripe.com
- SAM.gov Technical: sam-technical@gsa.gov
- Security Team: security@medcontracthub.com

### Escalation Paths
```
On-Call Engineer
    ↓ (5 min)
Tech Lead
    ↓ (10 min)
Engineering Manager
    ↓ (15 min)
VP Engineering
    ↓ (30 min)
CTO/CEO
```

### Vendor Status Pages
- AWS: https://status.aws.amazon.com/
- Stripe: https://status.stripe.com/
- Supabase: https://status.supabase.com/
- Mistral: https://status.mistral.ai/

## References

- [Service Down Runbook](./service-down.md)
- [Data Recovery Runbook](./data-recovery.md)
- [Monitoring Runbook](./monitoring.md)
- [Security Incident Response](./security-incident.md)
- [Communication Guidelines](../communication.md)