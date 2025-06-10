#!/bin/bash

# Setup script for Sealed Secrets

set -euo pipefail

echo "🔐 Setting up Sealed Secrets for MedContractHub..."

# Function to check if a resource exists
resource_exists() {
    kubectl get "$1" "$2" -n "$3" &> /dev/null
}

# Install Sealed Secrets controller
echo "📦 Installing Sealed Secrets controller..."

# Create namespace if it doesn't exist
if ! resource_exists "namespace" "kube-system" "default"; then
    echo "kube-system namespace already exists"
fi

# Install the controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.5/controller.yaml

echo "⏳ Waiting for Sealed Secrets controller to be ready..."
kubectl wait --for=condition=ready pod -l name=sealed-secrets-controller -n kube-system --timeout=300s

# Install kubeseal CLI tool
echo "📦 Installing kubeseal CLI tool..."
if ! command -v kubeseal &> /dev/null; then
    KUBESEAL_VERSION='0.24.5'
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget "https://github.com/bitnami-labs/sealed-secrets/releases/download/v${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz"
        tar -xvzf "kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz" kubeseal
        sudo install -m 755 kubeseal /usr/local/bin/kubeseal
        rm kubeseal "kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install kubeseal
    else
        echo "⚠️  Please install kubeseal manually for your platform"
        echo "   Visit: https://github.com/bitnami-labs/sealed-secrets/releases"
    fi
else
    echo "✅ kubeseal is already installed"
fi

# Get the public key
echo "🔑 Fetching Sealed Secrets public key..."
kubeseal --fetch-cert > k8s/base/sealed-secrets/public-key.pem

# Create a script to seal secrets
cat > k8s/scripts/seal-secret.sh << 'EOF'
#!/bin/bash

# Script to seal a Kubernetes secret

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <secret-file> <output-file> [namespace]"
    echo "Example: $0 my-secret.yaml my-sealed-secret.yaml medcontracthub"
    exit 1
fi

SECRET_FILE=$1
OUTPUT_FILE=$2
NAMESPACE=${3:-medcontracthub}

echo "Sealing secret from $SECRET_FILE to $OUTPUT_FILE for namespace $NAMESPACE..."

kubeseal \
    --format=yaml \
    --cert=k8s/base/sealed-secrets/public-key.pem \
    --namespace="$NAMESPACE" \
    < "$SECRET_FILE" \
    > "$OUTPUT_FILE"

echo "✅ Secret sealed successfully!"
echo "   You can now commit $OUTPUT_FILE to git"
echo "   Apply it with: kubectl apply -f $OUTPUT_FILE"
EOF

chmod +x k8s/scripts/seal-secret.sh

# Create example sealed secrets
echo "📝 Creating example sealed secrets..."

# Create temporary directory for unsealed secrets
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Create example database secret
cat > "$TEMP_DIR/database-secret.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: medcontracthub
type: Opaque
stringData:
  postgres-password: "$(openssl rand -base64 32)"
  replicator-password: "$(openssl rand -base64 32)"
  clickhouse-default-password: "$(openssl rand -base64 32)"
  clickhouse-analytics-password: "$(openssl rand -base64 32)"
EOF

# Create example API keys secret
cat > "$TEMP_DIR/api-keys-secret.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
  namespace: medcontracthub
type: Opaque
stringData:
  openai-api-key: "sk-example-key"
  anthropic-api-key: "sk-ant-example-key"
  mistral-api-key: "example-mistral-key"
  huggingface-api-key: "hf_example_key"
  sam-gov-api-key: "example-sam-key"
  resend-api-key: "re_example_key"
EOF

# Seal the secrets
./k8s/scripts/seal-secret.sh "$TEMP_DIR/database-secret.yaml" k8s/base/sealed-secrets/database-credentials-sealed.yaml
./k8s/scripts/seal-secret.sh "$TEMP_DIR/api-keys-secret.yaml" k8s/base/sealed-secrets/api-keys-sealed.yaml

echo ""
echo "🎉 Sealed Secrets setup complete!"
echo ""
echo "📚 How to use Sealed Secrets:"
echo "1. Create a regular Secret YAML file (DO NOT commit this)"
echo "2. Seal it: ./k8s/scripts/seal-secret.sh secret.yaml sealed-secret.yaml"
echo "3. Commit the sealed secret to git"
echo "4. Apply it: kubectl apply -f sealed-secret.yaml"
echo ""
echo "The Sealed Secrets controller will automatically decrypt and create"
echo "the actual Secret in the cluster."
echo ""
echo "⚠️  IMPORTANT: Never commit unsealed secrets to git!"
echo "⚠️  IMPORTANT: The public key is stored at: k8s/base/sealed-secrets/public-key.pem"