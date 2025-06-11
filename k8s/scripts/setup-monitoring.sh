#!/bin/bash

# Monitoring Stack Setup Script for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MedContractHub Monitoring Stack Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v helm &> /dev/null; then
        echo -e "${RED}Error: Helm is not installed${NC}"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Error: kubectl is not connected to a cluster${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites satisfied${NC}"
}

# Setup namespaces
setup_namespaces() {
    echo -e "${YELLOW}Creating namespaces...${NC}"
    
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
    
    # Label for Istio injection
    kubectl label namespace monitoring istio-injection=enabled --overwrite
    kubectl label namespace logging istio-injection=enabled --overwrite
    
    echo -e "${GREEN}✓ Namespaces created${NC}"
}

# Install Prometheus and Grafana
install_prometheus_grafana() {
    echo -e "${YELLOW}Installing Prometheus and Grafana...${NC}"
    
    # Add Prometheus community repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Install kube-prometheus-stack (includes Prometheus, Grafana, AlertManager)
    cat <<EOF > /tmp/prometheus-values.yaml
grafana:
  enabled: true
  adminPassword: MedContract2024!
  ingress:
    enabled: true
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - grafana.medcontracthub.com
    tls:
      - secretName: grafana-tls
        hosts:
          - grafana.medcontracthub.com
  sidecar:
    dashboards:
      enabled: true
      searchNamespace: ALL
  additionalDataSources:
    - name: Loki
      type: loki
      url: http://loki:3100
      access: proxy
    - name: Jaeger
      type: jaeger
      url: http://jaeger-query:16686
      access: proxy
  persistence:
    enabled: true
    size: 10Gi

prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
    additionalScrapeConfigs:
      - job_name: 'medcontracthub-apps'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - medcontracthub
                - medcontract-staging
                - medcontract-prod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            target_label: __metrics_port__
            regex: (.+)

alertmanager:
  config:
    global:
      resolve_timeout: 5m
      slack_api_url: '${SLACK_WEBHOOK_URL}'
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'platform-team'
      routes:
        - match:
            severity: critical
          receiver: pagerduty-critical
        - match:
            severity: warning
          receiver: slack-warnings
    receivers:
      - name: 'platform-team'
        slack_configs:
          - channel: '#platform-alerts'
            title: 'MedContractHub Alert'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'
      - name: 'pagerduty-critical'
        pagerduty_configs:
          - service_key: '${PAGERDUTY_SERVICE_KEY}'
      - name: 'slack-warnings'
        slack_configs:
          - channel: '#platform-warnings'
EOF

    helm upgrade --install prometheus-stack \
        prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values /tmp/prometheus-values.yaml \
        --wait
    
    echo -e "${GREEN}✓ Prometheus and Grafana installed${NC}"
}

# Install Grafana dashboards
install_grafana_dashboards() {
    echo -e "${YELLOW}Installing Grafana dashboards...${NC}"
    
    # Create ConfigMap for dashboards
    kubectl create configmap medcontracthub-dashboards \
        --from-file=k8s/base/monitoring/grafana-dashboards/ \
        --namespace monitoring \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Label it for auto-discovery
    kubectl label configmap medcontracthub-dashboards \
        grafana_dashboard=1 \
        --namespace monitoring
    
    echo -e "${GREEN}✓ Dashboards installed${NC}"
}

# Install Prometheus alerts
install_prometheus_alerts() {
    echo -e "${YELLOW}Installing Prometheus alerts...${NC}"
    
    kubectl apply -f k8s/base/monitoring/prometheus-alerts.yaml
    
    echo -e "${GREEN}✓ Alert rules installed${NC}"
}

# Install ELK Stack
install_elk_stack() {
    echo -e "${YELLOW}Installing ELK Stack...${NC}"
    
    # Add Elastic repo
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    # Install Elasticsearch
    helm upgrade --install elasticsearch elastic/elasticsearch \
        --namespace logging \
        --values k8s/base/logging/elasticsearch-values.yaml \
        --wait \
        --timeout 10m
    
    # Wait for Elasticsearch to be ready
    echo "Waiting for Elasticsearch to be ready..."
    kubectl wait --for=condition=ready pod -l app=elasticsearch-master -n logging --timeout=300s
    
    # Install Logstash
    kubectl apply -f k8s/base/logging/logstash-configmap.yaml
    
    helm upgrade --install logstash elastic/logstash \
        --namespace logging \
        --set replicas=3 \
        --set resources.requests.memory=2Gi \
        --set resources.limits.memory=2Gi \
        --wait
    
    # Install Kibana
    cat <<EOF > /tmp/kibana-values.yaml
elasticsearchHosts: "https://elasticsearch-master:9200"
replicas: 2
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kibana.medcontracthub.com
      paths:
        - path: /
  tls:
    - secretName: kibana-tls
      hosts:
        - kibana.medcontracthub.com
EOF

    helm upgrade --install kibana elastic/kibana \
        --namespace logging \
        --values /tmp/kibana-values.yaml \
        --wait
    
    # Install Filebeat
    kubectl apply -f k8s/base/logging/filebeat-daemonset.yaml
    
    echo -e "${GREEN}✓ ELK Stack installed${NC}"
}

# Install Jaeger for tracing
install_jaeger() {
    echo -e "${YELLOW}Installing Jaeger...${NC}"
    
    # Add Jaeger repo
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    # Install Jaeger with production storage
    cat <<EOF > /tmp/jaeger-values.yaml
provisionDataStore:
  cassandra: false
  elasticsearch: true
  es:
    esIndexPrefix: jaeger
    
storage:
  type: elasticsearch
  elasticsearch:
    host: elasticsearch-master.logging.svc.cluster.local
    port: 9200
    scheme: https
    
query:
  enabled: true
  ingress:
    enabled: true
    className: nginx
    hosts:
      - jaeger.medcontracthub.com
    tls:
      - secretName: jaeger-tls
        hosts:
          - jaeger.medcontracthub.com
          
collector:
  service:
    type: ClusterIP
  resources:
    limits:
      memory: 2Gi
      cpu: 1000m
    requests:
      memory: 1Gi
      cpu: 500m
      
agent:
  enabled: true
  daemonset:
    enabled: true
EOF

    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace monitoring \
        --values /tmp/jaeger-values.yaml \
        --wait
    
    echo -e "${GREEN}✓ Jaeger installed${NC}"
}

# Configure integrations
configure_integrations() {
    echo -e "${YELLOW}Configuring integrations...${NC}"
    
    # Create ServiceMonitors for all services
    for service in medcontracthub-app ai-service ocr-service analytics-service realtime-service worker-service; do
        cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${service}-metrics
  namespace: medcontracthub
spec:
  selector:
    matchLabels:
      app: ${service}
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF
    done
    
    echo -e "${GREEN}✓ Integrations configured${NC}"
}

# Print access information
print_access_info() {
    echo ""
    echo -e "${BLUE}=== Monitoring Stack Deployed ===${NC}"
    echo ""
    echo -e "${GREEN}Grafana:${NC}"
    echo "  URL: https://grafana.medcontracthub.com"
    echo "  Username: admin"
    echo "  Password: MedContract2024!"
    echo ""
    echo -e "${GREEN}Prometheus:${NC}"
    echo "  URL: https://prometheus.medcontracthub.com"
    echo ""
    echo -e "${GREEN}Kibana:${NC}"
    echo "  URL: https://kibana.medcontracthub.com"
    echo ""
    echo -e "${GREEN}Jaeger:${NC}"
    echo "  URL: https://jaeger.medcontracthub.com"
    echo ""
    echo -e "${YELLOW}Note: Update DNS records for the above domains${NC}"
    echo ""
    echo -e "${BLUE}Dashboards available:${NC}"
    echo "  - Business Metrics"
    echo "  - SLI/SLO Dashboard"
    echo "  - Cost Monitoring"
    echo "  - Service Health"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Configure Slack webhook for alerts"
    echo "2. Set up PagerDuty integration"
    echo "3. Create log retention policies"
    echo "4. Test alerting rules"
}

# Main execution
main() {
    check_prerequisites
    setup_namespaces
    install_prometheus_grafana
    install_grafana_dashboards
    install_prometheus_alerts
    install_elk_stack
    install_jaeger
    configure_integrations
    print_access_info
}

# Run main function
main