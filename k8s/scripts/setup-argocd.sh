#!/bin/bash

# ArgoCD Setup Script for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MedContractHub ArgoCD Setup${NC}"
echo -e "${BLUE}============================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: Helm is not installed${NC}"
    exit 1
fi

# Install ArgoCD
echo -e "${YELLOW}Installing ArgoCD...${NC}"

# Create namespace
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# Add ArgoCD Helm repo
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install ArgoCD with custom values
cat <<EOF > /tmp/argocd-values.yaml
server:
  replicas: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
  ingress:
    enabled: true
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/backend-protocol: HTTPS
      nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    hosts:
      - argocd.medcontracthub.com
    tls:
      - secretName: argocd-tls
        hosts:
          - argocd.medcontracthub.com
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true
  config:
    url: https://argocd.medcontracthub.com
    oidc.config: |
      name: MedContractHub SSO
      issuer: https://auth.medcontracthub.com
      clientId: argocd
      clientSecret: \$oidc.medcontracthub.clientSecret
      requestedScopes: ["openid", "profile", "email", "groups"]
      requestedIDTokenClaims: {"groups": {"essential": true}}
    policy.csv: |
      p, role:admin, applications, *, */*, allow
      p, role:admin, clusters, *, *, allow
      p, role:admin, repositories, *, *, allow
      p, role:admin, certificates, *, *, allow
      p, role:admin, projects, *, *, allow
      g, medcontracthub:platform-team, role:admin
    repositories: |
      - url: https://github.com/medcontracthub/platform
        name: platform
        type: git
      - url: https://prometheus-community.github.io/helm-charts
        name: prometheus-community
        type: helm
      - url: https://grafana.github.io/helm-charts
        name: grafana
        type: helm

redis:
  replicas: 3
  metrics:
    enabled: true

repoServer:
  replicas: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
  metrics:
    enabled: true

applicationSet:
  replicas: 2
  metrics:
    enabled: true

controller:
  replicas: 1
  metrics:
    enabled: true

dex:
  enabled: true
  metrics:
    enabled: true

notifications:
  enabled: true
  argocdUrl: https://argocd.medcontracthub.com
  secret:
    create: false
  cm:
    create: false
EOF

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --values /tmp/argocd-values.yaml \
  --wait

echo -e "${GREEN}✓ ArgoCD installed${NC}"

# Apply ArgoCD configurations
echo -e "${YELLOW}Applying ArgoCD configurations...${NC}"

kubectl apply -f k8s/argocd/projects.yaml
kubectl apply -f k8s/argocd/notifications.yaml

echo -e "${GREEN}✓ Configurations applied${NC}"

# Install ArgoCD CLI
echo -e "${YELLOW}Installing ArgoCD CLI...${NC}"

if ! command -v argocd &> /dev/null; then
    curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
    chmod +x /usr/local/bin/argocd
    echo -e "${GREEN}✓ ArgoCD CLI installed${NC}"
else
    echo -e "${GREEN}✓ ArgoCD CLI already installed${NC}"
fi

# Get initial admin password
echo -e "${YELLOW}Getting initial admin password...${NC}"

ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

echo -e "${GREEN}✓ Initial password retrieved${NC}"

# Port forward for initial setup
echo -e "${YELLOW}Setting up port forwarding...${NC}"

kubectl port-forward svc/argocd-server -n argocd 8080:443 &
FORWARD_PID=$!
sleep 5

# Login to ArgoCD
echo -e "${YELLOW}Logging in to ArgoCD...${NC}"

argocd login localhost:8080 \
  --username admin \
  --password "$ARGOCD_PASSWORD" \
  --insecure

# Change admin password
echo -e "${YELLOW}Changing admin password...${NC}"

NEW_PASSWORD="MedContract2024!"  # Should be stored in secret manager
argocd account update-password \
  --current-password "$ARGOCD_PASSWORD" \
  --new-password "$NEW_PASSWORD"

# Add clusters (if multi-cluster)
echo -e "${YELLOW}Adding clusters...${NC}"

# Add staging cluster (if different from production)
if kubectl config get-contexts | grep -q "staging"; then
    argocd cluster add staging --name staging
fi

# Add production cluster (if different)
if kubectl config get-contexts | grep -q "production"; then
    argocd cluster add production --name production
fi

# Create app-of-apps
echo -e "${YELLOW}Creating app-of-apps...${NC}"

kubectl apply -f k8s/argocd/app-of-apps.yaml

# Sync applications
echo -e "${YELLOW}Syncing applications...${NC}"

argocd app sync medcontracthub-platform --prune

# Kill port forward
kill $FORWARD_PID 2>/dev/null || true

# Print access information
echo ""
echo -e "${BLUE}=== ArgoCD Setup Complete ===${NC}"
echo ""
echo -e "${GREEN}ArgoCD UI:${NC} https://argocd.medcontracthub.com"
echo -e "${GREEN}Username:${NC} admin"
echo -e "${GREEN}Password:${NC} $NEW_PASSWORD"
echo ""
echo -e "${BLUE}CLI Access:${NC}"
echo "argocd login argocd.medcontracthub.com --username admin"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Configure SSO with your identity provider"
echo "2. Set up webhook for automatic syncing"
echo "3. Create RBAC policies for teams"
echo "4. Configure notifications (Slack, PagerDuty)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "argocd app list                    # List all applications"
echo "argocd app sync <app-name>         # Sync an application"
echo "argocd app get <app-name>          # Get application details"
echo "argocd app history <app-name>      # View deployment history"