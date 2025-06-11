#!/bin/bash
# Setup script for MedContractHub optimization components

set -e

echo "💰 Setting up MedContractHub Optimization Components..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found. Please install kubectl first.${NC}"
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        echo -e "${RED}Helm not found. Please install Helm first.${NC}"
        exit 1
    fi
}

# Install VPA
install_vpa() {
    echo -e "${GREEN}Installing Vertical Pod Autoscaler...${NC}"
    
    # Clone VPA repo
    git clone https://github.com/kubernetes/autoscaler.git /tmp/autoscaler || true
    cd /tmp/autoscaler/vertical-pod-autoscaler/
    
    # Install VPA
    ./hack/vpa-up.sh
    
    # Apply VPA configurations
    kubectl apply -f /home/locklearwyatt/projects/medcontracthub/k8s/base/optimization/vpa-config.yaml
    
    echo "VPA installed successfully!"
}

# Install Kubecost
install_kubecost() {
    echo -e "${GREEN}Installing Kubecost...${NC}"
    
    # Add Kubecost repo
    helm repo add kubecost https://kubecost.github.io/cost-analyzer/
    helm repo update
    
    # Install Kubecost
    helm install kubecost kubecost/cost-analyzer \
        --namespace kubecost \
        --create-namespace \
        -f /home/locklearwyatt/projects/medcontracthub/k8s/base/optimization/kubecost-values.yaml
    
    # Wait for Kubecost to be ready
    echo "Waiting for Kubecost to be ready..."
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=cost-analyzer -n kubecost --timeout=300s
    
    echo "Kubecost installed successfully!"
    echo "Access Kubecost UI: kubectl port-forward -n kubecost deployment/kubecost-cost-analyzer 9090"
}

# Install Karpenter
install_karpenter() {
    echo -e "${GREEN}Installing Karpenter...${NC}"
    
    # Create Karpenter namespace
    kubectl create namespace karpenter || true
    
    # Install Karpenter CRDs
    kubectl apply -f https://raw.githubusercontent.com/aws/karpenter/v0.31.0/pkg/apis/crds/karpenter.sh_provisioners.yaml
    kubectl apply -f https://raw.githubusercontent.com/aws/karpenter/v0.31.0/pkg/apis/crds/karpenter.sh_awsnodeinstanceprofiles.yaml
    
    # Install Karpenter
    helm repo add karpenter https://charts.karpenter.sh/
    helm repo update
    
    helm install karpenter karpenter/karpenter \
        --namespace karpenter \
        --set settings.aws.clusterName=medcontracthub-prod \
        --set settings.aws.defaultInstanceProfile=MedContractHubNodeInstanceProfile \
        --set settings.aws.interruptionQueueName=medcontracthub-karpenter \
        --set controller.resources.requests.cpu=1 \
        --set controller.resources.requests.memory=1Gi \
        --set webhook.resources.requests.cpu=50m \
        --set webhook.resources.requests.memory=64Mi
    
    # Apply provisioners
    kubectl apply -f /home/locklearwyatt/projects/medcontracthub/k8s/base/optimization/karpenter-provisioners.yaml
    
    echo "Karpenter installed successfully!"
}

# Install Flagger for advanced deployments
install_flagger() {
    echo -e "${GREEN}Installing Flagger...${NC}"
    
    # Add Flagger repo
    helm repo add flagger https://flagger.app
    helm repo update
    
    # Install Flagger
    helm install flagger flagger/flagger \
        --namespace istio-system \
        --set crd.create=true \
        --set meshProvider=istio \
        --set metricsServer=http://prometheus-server.monitoring:9090 \
        --set slack.url=$SLACK_WEBHOOK_URL \
        --set slack.channel=deployments
    
    # Install Flagger load tester
    kubectl create namespace medcontract-prod || true
    helm install flagger-loadtester flagger/loadtester \
        --namespace medcontract-prod \
        --set cmd.timeout=1h
    
    echo "Flagger installed successfully!"
}

# Apply optimization configurations
apply_optimizations() {
    echo -e "${GREEN}Applying optimization configurations...${NC}"
    
    # Apply PDBs
    kubectl apply -f /home/locklearwyatt/projects/medcontracthub/k8s/base/optimization/pod-disruption-budgets.yaml
    
    # Apply multi-region configs (if clusters are available)
    if kubectl config get-contexts | grep -q "us-west-2"; then
        echo "Applying multi-region configurations..."
        kubectl apply -f /home/locklearwyatt/projects/medcontracthub/k8s/base/multi-region/federation-config.yaml
    fi
    
    # Apply deployment strategies
    kubectl apply -f /home/locklearwyatt/projects/medcontracthub/k8s/base/deployment-strategies/
}

# Create cost monitoring dashboard
create_cost_dashboard() {
    echo -e "${GREEN}Creating cost monitoring dashboard...${NC}"
    
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cost-optimization-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "MedContractHub Cost Optimization",
        "panels": [
          {
            "title": "Monthly Spend by Namespace",
            "targets": [{
              "expr": "sum by (namespace) (kubecost_cluster_namespace_hourly_cost) * 730"
            }]
          },
          {
            "title": "Spot vs On-Demand Usage",
            "targets": [{
              "expr": "sum by (instance_type) (karpenter_nodes_allocatable{capacity_type=~\"spot|on-demand\"})"
            }]
          },
          {
            "title": "Resource Efficiency",
            "targets": [{
              "expr": "(sum(rate(container_cpu_usage_seconds_total[5m])) / sum(kube_pod_container_resource_requests{resource=\"cpu\"})) * 100"
            }]
          },
          {
            "title": "Idle Cost %",
            "targets": [{
              "expr": "(kubecost_cluster_idle_cost / kubecost_cluster_total_cost) * 100"
            }]
          }
        ]
      }
    }
EOF
}

# Main installation flow
main() {
    echo -e "${GREEN}=== MedContractHub Optimization Setup ===${NC}"
    echo "This script will install and configure:"
    echo "- Vertical Pod Autoscaler (VPA)"
    echo "- Kubecost for cost monitoring"
    echo "- Karpenter for node autoscaling"
    echo "- Flagger for advanced deployments"
    echo "- Cost optimization policies"
    echo ""
    
    check_prerequisites
    
    # Install components
    install_vpa
    install_kubecost
    install_karpenter
    install_flagger
    apply_optimizations
    create_cost_dashboard
    
    echo -e "${GREEN}✅ Optimization setup completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Access Kubecost: kubectl port-forward -n kubecost deployment/kubecost-cost-analyzer 9090"
    echo "2. Check VPA recommendations: kubectl get vpa -A"
    echo "3. Monitor Karpenter: kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter"
    echo "4. View canary deployments: kubectl get canaries -A"
    echo "5. Check cost dashboard in Grafana"
}

# Run main function
main