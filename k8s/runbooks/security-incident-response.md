# Security Incident Response Runbook

## Overview
This runbook provides procedures for responding to security incidents in the MedContractHub platform.

## Incident Classification

### Severity Levels
- **P1 (Critical)**: Active data breach, ransomware, complete system compromise
- **P2 (High)**: Unauthorized access detected, critical vulnerabilities exploited
- **P3 (Medium)**: Suspicious activity, policy violations, non-critical vulnerabilities
- **P4 (Low)**: Failed login attempts, minor policy violations

## Response Procedures

### 1. Immediate Response (First 15 minutes)

#### P1/P2 Incidents
```bash
# 1. Isolate affected components
kubectl cordon <affected-nodes>
kubectl drain <affected-nodes> --ignore-daemonsets --delete-emptydir-data

# 2. Capture forensic data
kubectl get events -A > /tmp/k8s-events-$(date +%Y%m%d-%H%M%S).log
kubectl logs -n <namespace> <pod> --previous > /tmp/pod-logs-$(date +%Y%m%d-%H%M%S).log

# 3. Check Falco alerts
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=1000 | grep -E "Critical|Warning"

# 4. Review audit logs
kubectl logs -n logging logstash-0 | grep -E "VIOLATION|BREACH|UNAUTHORIZED"
```

#### Notify Stakeholders
- Security Team Lead: Immediately
- CTO: Within 5 minutes for P1
- Legal/Compliance: Within 15 minutes for data breaches

### 2. Containment (15-60 minutes)

#### Network Isolation
```bash
# Apply emergency network policy
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-isolation
  namespace: <affected-namespace>
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes:
  - Ingress
  - Egress
EOF

# Label affected pods
kubectl label pod <pod-name> quarantine=true
```

#### Revoke Access
```bash
# Suspend user accounts
kubectl patch user <username> --type='json' -p='[{"op": "add", "path": "/spec/suspended", "value": true}]'

# Rotate compromised credentials
kubectl delete secret <compromised-secret>
kubectl create secret generic <compromised-secret> --from-literal=password=$(openssl rand -base64 32)

# Force pod restart to pick up new credentials
kubectl rollout restart deployment <affected-deployment>
```

### 3. Investigation (1-4 hours)

#### Collect Evidence
```bash
# Export pod descriptions
kubectl describe pods -A > /forensics/pod-descriptions-$(date +%Y%m%d).txt

# Collect container images for analysis
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}' > /forensics/container-images.txt

# Check for persistence mechanisms
kubectl get cronjobs,jobs,daemonsets -A -o yaml > /forensics/scheduled-workloads.yaml

# Review RBAC changes
kubectl get events -A | grep -E "rbac|role|binding" > /forensics/rbac-events.log
```

#### Analyze Attack Vector
```bash
# Check recent deployments
kubectl get deployments -A --sort-by='.metadata.creationTimestamp' | tail -20

# Review service account usage
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.spec.serviceAccount}{"\n"}{end}' | grep -v default

# Examine network connections
kubectl exec -n monitoring prometheus-0 -- promtool query instant 'rate(container_network_receive_bytes_total[5m]) > 1000000'
```

### 4. Eradication (2-8 hours)

#### Remove Threat
```bash
# Delete malicious resources
kubectl delete <resource-type> <resource-name> -n <namespace>

# Clean up persistence
kubectl delete cronjob,job -l malicious=true -A

# Patch vulnerabilities
kubectl set image deployment/<deployment> <container>=<patched-image>
```

#### Verify Clean State
```bash
# Run security scan
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: security-scan-$(date +%Y%m%d)
spec:
  template:
    spec:
      containers:
      - name: scanner
        image: aquasec/trivy:latest
        command: ["trivy", "k8s", "--report", "all", "--severity", "CRITICAL,HIGH"]
      restartPolicy: Never
EOF

# Check for remaining indicators
kubectl get all -A | grep -i <indicator-pattern>
```

### 5. Recovery (4-24 hours)

#### Restore Services
```bash
# Gradually restore network access
kubectl label pod <pod-name> quarantine-

# Scale up services
kubectl scale deployment <deployment> --replicas=<normal-count>

# Verify functionality
./scripts/health-check-all-services.sh
```

#### Monitor for Recurrence
```bash
# Set up enhanced monitoring
kubectl apply -f k8s/monitoring/enhanced-security-alerts.yaml

# Watch logs
kubectl logs -f -n falco -l app.kubernetes.io/name=falco | grep -E "Critical|Warning"
```

### 6. Post-Incident (24-72 hours)

#### Documentation
- Complete incident report template
- Update security policies
- Document lessons learned

#### Improvements
```bash
# Apply additional security measures
kubectl apply -f k8s/security/post-incident-hardening.yaml

# Update OPA policies
kubectl apply -f k8s/security/opa-gatekeeper/enhanced-policies.yaml
```

## Quick Reference Commands

### Check Security Status
```bash
# Falco alerts
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=100

# OPA violations
kubectl get constraints -A

# Pod Security violations
kubectl get events -A | grep -i "violates PodSecurity"

# Failed authentications
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx | grep "401\|403"
```

### Emergency Contacts
- Security Team Lead: security-lead@medcontracthub.com
- On-Call SRE: +1-XXX-XXX-XXXX
- Incident Hotline: +1-XXX-XXX-XXXX
- Legal Team: legal@medcontracthub.com

### External Resources
- CVE Database: https://cve.mitre.org/
- NIST Incident Handling Guide: https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-61r2.pdf
- HIPAA Breach Notification: https://www.hhs.gov/hipaa/for-professionals/breach-notification/