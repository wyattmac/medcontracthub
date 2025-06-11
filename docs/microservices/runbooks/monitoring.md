# Monitoring and Alerting Runbook

## Overview

This runbook covers monitoring setup, alert response procedures, and dashboard usage for MedContractHub microservices.

## Monitoring Stack Components

### Infrastructure
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Jaeger**: Distributed tracing
- **Loki**: Log aggregation
- **PagerDuty**: On-call management

## Alert Response Procedures

### Alert Severity Levels

| Severity | Response Time | Action Required | Escalation |
|----------|--------------|-----------------|------------|
| Critical | < 5 minutes | Immediate action | Page on-call |
| Warning | < 30 minutes | Investigation | Slack notification |
| Info | < 4 hours | Review | Email summary |

### General Alert Response Process

1. **Acknowledge Alert**
   ```bash
   # Via AlertManager CLI
   amtool alert ack <alert-id> --alertmanager.url=http://alertmanager:9093
   
   # Via PagerDuty
   pd-cli incident ack <incident-id>
   ```

2. **Initial Assessment**
   ```bash
   # Check alert details
   amtool alert query <alert-name> --alertmanager.url=http://alertmanager:9093
   
   # View current metrics
   kubectl port-forward -n monitoring svc/prometheus 9090:9090
   # Open http://localhost:9090
   ```

3. **Gather Context**
   - Check related alerts
   - Review recent deployments
   - Check dependency status
   - Review recent incidents

## Common Alert Responses

### High Error Rate Alert

**Alert**: `HighErrorRate`
**Query**: `rate(http_requests_total{status=~"5.."}[5m]) > 0.05`

**Response Steps**:
1. Identify affected service
   ```bash
   # Check error rates by service
   curl -s http://prometheus:9090/api/v1/query?query='rate(http_requests_total{status=~"5.."}[5m])' | jq .
   ```

2. Check recent logs
   ```bash
   # Tail logs for affected service
   kubectl logs -n medcontract-prod -l app=<service-name> --tail=100 -f
   
   # Search for errors in Loki
   logcli query '{namespace="medcontract-prod",app="<service-name>"} |= "error"' --limit=50
   ```

3. Check deployment status
   ```bash
   kubectl rollout history deployment/<service-name> -n medcontract-prod
   kubectl get events -n medcontract-prod --field-selector involvedObject.name=<service-name>
   ```

### High Latency Alert

**Alert**: `HighResponseTime`
**Query**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2`

**Response Steps**:
1. Identify slow endpoints
   ```bash
   # Query slow endpoints
   curl -G http://prometheus:9090/api/v1/query \
     --data-urlencode 'query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le))'
   ```

2. Check distributed traces
   ```bash
   # Port forward Jaeger
   kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
   # Open http://localhost:16686
   ```

3. Analyze database queries
   ```bash
   # Check slow queries
   kubectl exec -n medcontract-prod postgres-primary-0 -- \
     psql -U postgres -d medcontracthub -c \
     "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
   ```

### Kafka Consumer Lag Alert

**Alert**: `KafkaConsumerLagHigh`
**Query**: `kafka_consumer_lag_sum > 10000`

**Response Steps**:
1. Check consumer group status
   ```bash
   kubectl exec -n medcontract-prod kafka-0 -- \
     kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --all-groups
   ```

2. Scale consumers if needed
   ```bash
   # Scale up consumers
   kubectl scale deployment/<consumer-service> --replicas=5 -n medcontract-prod
   ```

3. Check for poison messages
   ```bash
   # Sample messages from topic
   kubectl exec -n medcontract-prod kafka-0 -- \
     kafka-console-consumer.sh --bootstrap-server kafka:9092 \
     --topic <topic-name> --max-messages 10
   ```

## Dashboard Usage Guide

### Executive Overview Dashboard

**URL**: https://grafana.medcontracthub.com/d/executive-overview

**Key Panels**:
- **System Availability**: Overall platform health (target: >99.9%)
- **Request Rate**: Traffic patterns by service
- **Error Rate Heatmap**: Visual error distribution
- **Resource Usage**: CPU/Memory utilization
- **Cloud Costs**: Real-time spend tracking

**Usage**:
```bash
# Generate executive report
curl -s "https://grafana.medcontracthub.com/api/dashboards/uid/executive-overview" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" | \
  jq '.dashboard.panels[] | {title: .title, value: .targets[0].expr}'
```

### Service Performance Dashboard

**URL**: https://grafana.medcontracthub.com/d/service-performance

**Key Metrics**:
- RED metrics (Rate, Errors, Duration)
- Apdex scores
- Dependency health
- Cache hit rates

### Business Metrics Dashboard

**URL**: https://grafana.medcontracthub.com/d/business-metrics

**Tracked KPIs**:
- Opportunities processed/hour
- Proposal generation success rate
- User engagement metrics
- API usage by customer

## Monitoring Queries Cookbook

### Service Health Queries

```promql
# Service uptime percentage (last 24h)
(1 - avg(rate(up{job="<service-name>"}[24h]) < 1)) * 100

# Request rate by status code
sum(rate(http_requests_total[5m])) by (status, job)

# P95 latency by endpoint
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le)
)

# Error budget remaining
(1 - (sum(increase(http_requests_total{status=~"5.."}[30d])) / 
      sum(increase(http_requests_total[30d])))) * 100
```

### Resource Usage Queries

```promql
# CPU usage by pod
sum(rate(container_cpu_usage_seconds_total[5m])) by (pod, namespace) * 100

# Memory usage percentage
(container_memory_working_set_bytes / container_spec_memory_limit_bytes) * 100

# Disk usage for PVCs
(kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes) * 100

# Network traffic
sum(rate(container_network_receive_bytes_total[5m])) by (pod)
```

### Business Metrics Queries

```promql
# Opportunities processed per hour
sum(increase(opportunities_processed_total[1h]))

# Average proposal generation time
avg(proposal_generation_duration_seconds)

# API quota usage
(api_usage_current / api_usage_quota) * 100

# Revenue impact (estimated)
sum(opportunity_value_total) by (status)
```

## Log Analysis Procedures

### Centralized Logging with Loki

1. **Basic Log Search**
   ```bash
   # Install logcli
   wget https://github.com/grafana/loki/releases/download/v2.9.0/logcli-linux-amd64.zip
   unzip logcli-linux-amd64.zip
   chmod +x logcli-linux-amd64
   
   # Search logs
   ./logcli query '{namespace="medcontract-prod"}' --limit=100
   ```

2. **Advanced Queries**
   ```bash
   # Error logs with context
   ./logcli query '{namespace="medcontract-prod"} |= "error" |~ "(?i)exception|failed|timeout"' \
     --limit=50 --since=1h
   
   # Specific service logs
   ./logcli query '{namespace="medcontract-prod",app="ai-service"} |= "inference"' \
     --limit=20 --output=jsonl
   
   # Performance issues
   ./logcli query '{namespace="medcontract-prod"} |~ "slow|latency|timeout" | json' \
     --limit=30
   ```

3. **Log Export**
   ```bash
   # Export logs for investigation
   ./logcli query '{namespace="medcontract-prod",app="ocr-service"}' \
     --from="2024-01-15T10:00:00Z" \
     --to="2024-01-15T11:00:00Z" \
     --output=jsonl > ocr-service-logs.jsonl
   ```

## Tracing Analysis

### Using Jaeger for Distributed Tracing

1. **Access Jaeger UI**
   ```bash
   kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
   # Open http://localhost:16686
   ```

2. **Trace Analysis Commands**
   ```bash
   # Find slow traces
   curl -s "http://localhost:16686/api/traces?service=ai-service&minDuration=1s&limit=20" | \
     jq '.data[].spans[] | select(.duration > 1000000)'
   
   # Export trace
   curl -s "http://localhost:16686/api/traces/<trace-id>" > trace-analysis.json
   ```

3. **Common Issues to Look For**
   - Sequential calls that could be parallelized
   - N+1 query patterns
   - Unnecessary service hops
   - Slow external API calls

## Alert Configuration Management

### Adding New Alerts

1. **Create Alert Rule**
   ```yaml
   # alerts/new-alert.yaml
   - alert: YourAlertName
     expr: your_prometheus_query > threshold
     for: 5m
     labels:
       severity: warning
       team: platform
     annotations:
       summary: "Alert summary"
       description: "Detailed description with {{ $value }}"
       runbook_url: "https://docs.medcontracthub.com/runbooks/your-alert"
   ```

2. **Test Alert**
   ```bash
   # Validate syntax
   promtool check rules alerts/new-alert.yaml
   
   # Test alert would fire
   promtool test rules alerts/test.yaml
   ```

3. **Deploy Alert**
   ```bash
   kubectl create configmap production-alert-rules \
     --from-file=alerts.yaml \
     -n monitoring --dry-run=client -o yaml | \
     kubectl apply -f -
   ```

### Alert Routing Configuration

```yaml
# alertmanager-config.yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-platform'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty-critical'
  - match:
      severity: warning
    receiver: 'slack-warnings'
  - match:
      team: ai
    receiver: 'team-ai'
```

## Monitoring Maintenance

### Weekly Tasks
- Review alert noise ratio
- Update dashboard annotations
- Archive old logs
- Review SLO compliance

### Monthly Tasks
- Alert rule optimization
- Dashboard performance tuning
- Retention policy review
- Cost analysis

### Quarterly Tasks
- Monitoring stack updates
- Alert response time analysis
- Runbook updates
- Training updates

## Troubleshooting Monitoring Issues

### Prometheus Issues
```bash
# Check Prometheus targets
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Verify scrape configs
kubectl get configmap prometheus-config -n monitoring -o yaml

# Check storage
kubectl exec -n monitoring prometheus-0 -- df -h /prometheus
```

### Grafana Issues
```bash
# Check datasources
curl -s http://grafana:3000/api/datasources -H "Authorization: Bearer $GRAFANA_API_KEY"

# Test query
curl -G http://grafana:3000/api/datasources/proxy/1/api/v1/query \
  --data-urlencode 'query=up' \
  -H "Authorization: Bearer $GRAFANA_API_KEY"
```

### AlertManager Issues
```bash
# Check config
amtool config show --alertmanager.url=http://alertmanager:9093

# Check inhibitions
amtool alert query --inhibited --alertmanager.url=http://alertmanager:9093

# Test notifications
amtool config routes test --config.file=alertmanager.yaml
```

## References

- [Monitoring Architecture](../architecture.md#monitoring--observability)
- [Alert Rules Configuration](../../k8s/base/monitoring/production-alerts.yaml)
- [Grafana Dashboards](../../k8s/base/monitoring/grafana-dashboards/)
- [SLO Definitions](../slos.md)
- [Incident Response](./incident-response.md)