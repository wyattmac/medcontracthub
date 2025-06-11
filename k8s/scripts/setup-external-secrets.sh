#!/bin/bash

# External Secrets Operator Setup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MedContractHub External Secrets Operator Setup${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: Helm is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: kubectl is not connected to a cluster${NC}"
    exit 1
fi

# Select secret backend
echo -e "${YELLOW}Select secret backend:${NC}"
echo "1) AWS Secrets Manager"
echo "2) HashiCorp Vault"
echo "3) Google Secret Manager"
echo "4) Azure Key Vault"
read -p "Enter choice (1-4): " choice

# Add External Secrets Helm repository
echo -e "${YELLOW}Adding External Secrets Helm repository...${NC}"
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Create namespace
echo -e "${YELLOW}Creating external-secrets namespace...${NC}"
kubectl apply -f k8s/base/external-secrets/namespace.yaml

# Deploy External Secrets Operator
echo -e "${YELLOW}Deploying External Secrets Operator...${NC}"
helm upgrade --install external-secrets \
  external-secrets/external-secrets \
  --namespace external-secrets \
  --set installCRDs=true \
  --set webhook.port=9443 \
  --wait

# Apply secret store based on choice
case $choice in
    1)
        echo -e "${YELLOW}Configuring AWS Secrets Manager...${NC}"
        
        # Check if running on EKS
        if kubectl get nodes -o jsonpath='{.items[0].spec.providerID}' | grep -q "aws"; then
            echo -e "${GREEN}Detected EKS cluster${NC}"
            
            # Create IRSA policy
            cat <<EOF > /tmp/secrets-policy.json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetResourcePolicy",
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
                "secretsmanager:ListSecretVersionIds"
            ],
            "Resource": "arn:aws:secretsmanager:*:*:secret:medcontracthub/*"
        }
    ]
}
EOF
            
            echo -e "${YELLOW}Create IAM policy with:${NC}"
            echo "aws iam create-policy --policy-name MedContractHubSecretsPolicy --policy-document file:///tmp/secrets-policy.json"
            echo ""
            echo -e "${YELLOW}Then create service account with:${NC}"
            echo "eksctl create iamserviceaccount --name external-secrets-sa --namespace medcontracthub --cluster <cluster-name> --attach-policy-arn <policy-arn>"
        fi
        
        kubectl apply -f k8s/base/external-secrets/aws-secret-store.yaml
        ;;
    2)
        echo -e "${YELLOW}Configuring HashiCorp Vault...${NC}"
        kubectl apply -f k8s/base/external-secrets/vault-secret-store.yaml
        
        echo -e "${YELLOW}Configure Vault with:${NC}"
        echo "vault auth enable kubernetes"
        echo "vault write auth/kubernetes/config \\"
        echo "  kubernetes_host=https://\$KUBERNETES_PORT_443_TCP_ADDR:443 \\"
        echo "  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
        ;;
    3)
        echo -e "${YELLOW}Google Secret Manager configuration not yet implemented${NC}"
        ;;
    4)
        echo -e "${YELLOW}Azure Key Vault configuration not yet implemented${NC}"
        ;;
esac

# Wait for operator to be ready
echo -e "${YELLOW}Waiting for External Secrets Operator to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=external-secrets -n external-secrets --timeout=120s

# Verify installation
echo -e "${YELLOW}Verifying installation...${NC}"
kubectl get pods -n external-secrets
kubectl get secretstores -A
kubectl get externalsecrets -A

echo -e "${GREEN}External Secrets Operator setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Configure your cloud provider credentials"
echo "2. Create secrets in your secret backend"
echo "3. Apply ExternalSecret resources to sync secrets"
echo ""
echo -e "${BLUE}Example secret creation:${NC}"
echo "aws secretsmanager create-secret --name medcontracthub/prod/postgres --secret-string '{\"password\":\"your-password\"}'"