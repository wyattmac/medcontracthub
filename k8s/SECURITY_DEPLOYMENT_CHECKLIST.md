# Security Deployment Checklist

## Pre-Deployment Requirements
- [ ] Kubernetes cluster running (v1.24+)
- [ ] kubectl configured and connected
- [ ] Helm v3 installed
- [ ] Namespaces created (medcontract-dev, medcontract-staging, medcontract-prod)
- [ ] Admin access to cluster

## Deployment Steps

### 1. Core Security Infrastructure
- [ ] Deploy OPA Gatekeeper
  ```bash
  helm install gatekeeper gatekeeper/gatekeeper -n gatekeeper-system --create-namespace
  ```
- [ ] Apply constraint templates
  ```bash
  kubectl apply -f k8s/base/security/opa-gatekeeper/constraint-templates.yaml
  ```
- [ ] Apply constraints
  ```bash
  kubectl apply -f k8s/base/security/opa-gatekeeper/constraints.yaml
  ```

### 2. Runtime Security
- [ ] Deploy Falco
  ```bash
  helm install falco falcosecurity/falco -n falco --create-namespace
  ```
- [ ] Apply custom Falco rules
  ```bash
  kubectl apply -f k8s/base/security/falco/custom-rules.yaml
  ```

### 3. Network Security
- [ ] Apply default deny-all policies
  ```bash
  kubectl apply -f k8s/base/security/network-policies/deny-all.yaml
  ```
- [ ] Apply application-specific policies
  ```bash
  kubectl apply -f k8s/base/security/network-policies/app-policies.yaml
  ```

### 4. Access Control
- [ ] Apply Pod Security Standards
  ```bash
  kubectl apply -f k8s/base/security/pod-security-standards.yaml
  ```
- [ ] Apply RBAC policies
  ```bash
  kubectl apply -f k8s/base/security/rbac/least-privilege.yaml
  ```

### 5. Secret Management
- [ ] Deploy secret rotation cronjobs
  ```bash
  kubectl apply -f k8s/base/security/secret-rotation/rotation-cronjobs.yaml
  ```
- [ ] Verify service accounts created
- [ ] Configure AWS Secrets Manager integration (if using)

### 6. Compliance
- [ ] Apply HIPAA compliance policies
  ```bash
  kubectl apply -f k8s/base/security/compliance/hipaa-compliance.yaml
  ```
- [ ] Apply FedRAMP compliance policies
  ```bash
  kubectl apply -f k8s/base/security/compliance/fedramp-compliance.yaml
  ```

### 7. Vulnerability Scanning
- [ ] Deploy Trivy Operator
  ```bash
  helm install trivy-operator aqua/trivy-operator -n trivy-system --create-namespace
  ```

## Post-Deployment Validation

### Immediate Checks
- [ ] Run security test script
  ```bash
  ./k8s/scripts/test-security-configs.sh
  ```
- [ ] Verify Gatekeeper is enforcing policies
  ```bash
  kubectl get constraints
  ```
- [ ] Check Falco is receiving events
  ```bash
  kubectl logs -n falco -l app.kubernetes.io/name=falco
  ```

### Configuration Tests
- [ ] Test network policies (try forbidden connections)
- [ ] Attempt to deploy non-compliant pod (should fail)
- [ ] Verify secret rotation jobs scheduled
- [ ] Check audit logs are being collected

### Monitoring Setup
- [ ] Configure alerts for security events
- [ ] Set up Falco UI access
- [ ] Enable compliance report generation
- [ ] Schedule regular security audits

## Troubleshooting Common Issues

### Gatekeeper Not Blocking
1. Check webhook configuration: `kubectl get validatingwebhookconfigurations`
2. Verify constraints are enforced: `kubectl get constraints -o yaml`
3. Check Gatekeeper logs: `kubectl logs -n gatekeeper-system -l app=gatekeeper`

### Falco Missing Events
1. Verify kernel module loaded: `kubectl exec -n falco <falco-pod> -- falco --version`
2. Check eBPF support: `kubectl logs -n falco -l app.kubernetes.io/name=falco | grep eBPF`
3. Review custom rules syntax

### Network Policy Issues
1. Verify CNI supports NetworkPolicy
2. Check policy selectors match pods
3. Test with `kubectl exec` between pods

## Final Steps
- [ ] Document any customizations made
- [ ] Update incident response contacts
- [ ] Schedule security training for team
- [ ] Plan first security audit (within 30 days)