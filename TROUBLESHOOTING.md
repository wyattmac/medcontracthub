# Troubleshooting Guide - Hybrid Intelligence Platform

**Essential debugging solutions for MedContractHub microservices and distributed systems**

---

## 🔧 Code Quality & Build Issues

### **TypeScript Errors**

**Missing Export Errors:**
```bash
# Error: Module has no exported member 'QuotaExceededError'
# Fix: Add missing exports to lib/errors/types.ts
export class QuotaExceededError extends AppError { ... }
```

**Implicit 'any' Type Errors:**
```bash
# Error: Parameter 'opp' implicitly has an 'any' type
# Fix: Add proper type annotations
function processOpp(opp: OpportunityData) { ... }
```

**Route Handler Type Errors:**
```bash
# Error: 'monitoring' is not assignable to rate limit type
# Fix: Add to enhanced-route-handler.ts
rateLimit?: 'api' | 'auth' | 'search' | 'sync' | 'ai' | 'monitoring'

# Error: Property 'body' does not exist on RouteContext
# Fix: Use sanitizedBody instead
async ({ sanitizedBody }) => { const { action } = sanitizedBody }
```

### **Quick Fix Commands**
```bash
npm run lint -- --fix           # Auto-fix formatting
npm run type-check              # Check TypeScript errors
npm run lint && npm run type-check && npm test  # Pre-commit check
```

---

## ☸️ Kubernetes Issues

### **Pod Startup Failures**
```bash
# Problem: Pods stuck in CrashLoopBackOff
# Debug steps:

# 1. Check pod events
kubectl describe pod <pod-name> -n medcontract-dev

# 2. View init container logs
kubectl logs <pod-name> -c init-migrate -n medcontract-dev

# 3. Check resource limits
kubectl top pods -n medcontract-dev

# 4. Verify ConfigMaps and Secrets
kubectl get configmap -n medcontract-dev
kubectl get secrets -n medcontract-dev

# 5. Common fixes:
# Increase memory limits in deployment yaml
# Check database migrations completed
# Verify service dependencies are ready
```

### **Service Mesh Configuration**
```bash
# Problem: 503 Service Unavailable errors

# 1. Check Istio injection
kubectl label namespace medcontract-dev istio-injection=enabled

# 2. Verify DestinationRules
kubectl get destinationrule -n medcontract-dev

# 3. Check VirtualServices
kubectl get virtualservice -n medcontract-dev

# 4. Debug with Kiali dashboard
kubectl port-forward svc/kiali 20001:20001 -n istio-system
# Open http://localhost:20001
```

### **Horizontal Pod Autoscaler Issues**
```bash
# Problem: HPA not scaling pods

# 1. Check metrics server
kubectl top nodes
kubectl top pods -n medcontract-dev

# 2. Verify HPA status
kubectl get hpa -n medcontract-dev
kubectl describe hpa ai-service-hpa -n medcontract-dev

# 3. Check resource requests are set
kubectl get deployment ai-service -n medcontract-dev -o yaml | grep -A5 resources:

# 4. Monitor custom metrics
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1 | jq .

# 5. Force scale for testing
kubectl scale deployment ai-service --replicas=5 -n medcontract-dev
```

### **Port Conflicts**
```bash
# Problem: "Port 3000 already in use"
# Solutions:
lsof -i :3000                   # Find what's using port
kill -9 $(lsof -t -i:3000)     # Kill process using port
make staging                    # Use port 3001 instead
docker-compose down             # Stop containers first
```

### **Container Build Failures**
```bash
# Nuclear solution:
docker-compose down -v          # Stop and remove volumes
docker system prune -f          # Clean Docker cache
docker-compose up --build      # Fresh build
```

### **Multi-Model AI Troubleshooting**
```bash
# Problem: Model inference timeouts

# 1. Check model pod resources
kubectl top pod -l app=ai-service -n medcontract-dev

# 2. Verify model loaded in memory
kubectl exec -it ai-service-0 -- curl http://localhost:8000/models/status

# 3. Check MLflow tracking server
kubectl port-forward svc/mlflow 5000:5000 -n medcontract-dev
# Open http://localhost:5000

# 4. Monitor model performance
kubectl logs -f deployment/ai-service --tail=100 | grep INFERENCE

# 5. Switch to fallback model
kubectl exec -it ai-service-0 -- curl -X POST http://localhost:8000/models/switch -d '{"model": "gpt-4-turbo"}'
```

---

## 🔧 Microservices Troubleshooting

### **Service Communication Issues**
**Problem**: Service mesh connectivity failures

```bash
# Check Istio sidecar injection
kubectl get pods -n medcontract-dev -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'

# Verify mTLS is working
istioctl authn tls-check <pod-name>.<namespace> <service>.<namespace>.svc.cluster.local

# Debug service-to-service calls
kubectl exec -it <pod-name> -c istio-proxy -- curl -v http://ai-service:8000/health
```

### **Kafka Event Streaming Issues**
**Problem**: Events not being consumed

```bash
# Check Kafka cluster health
kubectl exec -it kafka-0 -- kafka-topics.sh --bootstrap-server kafka:9092 --list

# Monitor consumer lag
kubectl exec -it kafka-0 -- kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group proposal-processor

# Debug event publishing
kubectl logs -f deployment/analytics-service -c analytics | grep EVENT
```

### **Redis Cluster Issues**
**Problem**: Distributed cache inconsistency

```bash
# Check Redis cluster status
kubectl exec -it redis-cluster-0 -- redis-cli cluster info

# Verify all nodes are connected
kubectl exec -it redis-cluster-0 -- redis-cli cluster nodes

# Fix split-brain scenario
kubectl exec -it redis-cluster-0 -- redis-cli cluster meet <node-ip> 6379

# Monitor cache hit rates
kubectl exec -it redis-cluster-0 -- redis-cli info stats | grep keyspace
```

### **Vector Database (Weaviate) Issues**
**Problem**: Semantic search not returning results

```bash
# Check Weaviate cluster health
kubectl exec -it weaviate-0 -- curl http://localhost:8080/v1/nodes

# Verify schema exists
kubectl exec -it weaviate-0 -- curl http://localhost:8080/v1/schema

# Reindex embeddings
kubectl exec -it ai-service-0 -- python scripts/reindex_embeddings.py
```

### **API Route Type Errors**
**Files**: `app/api/monitoring/*`
**Problem**: Missing rate limit types and incorrect context usage

```typescript
// ✅ Fixed route handler options
{
  rateLimit: 'monitoring',  // Added to allowed types
  requireAuth: false
}

// ✅ Fixed context usage
async ({ sanitizedBody, sanitizedQuery }) => {
  const { action } = sanitizedBody  // Not 'body'
  const param = sanitizedQuery?.param  // Not 'searchParams'
}
```

---

## 📊 Quick Diagnostic Commands

```bash
# Health Checks
curl http://localhost:3000/api/health     # API health
docker ps                                # Container status
make health-check                        # All services

# Code Quality
npm run lint                             # ESLint check
npm run type-check                       # TypeScript check
npm test                                 # Test suite

# Docker Debug
docker logs medcontract-dev              # App logs
docker exec medcontract-dev env | grep API  # Environment vars
docker stats                             # Resource usage

# Development Server
make dev                                 # Start Docker (port 3000)
make staging                            # Alternative (port 3001)
npm run dev                             # Local server (fallback)
```

---

## 🐳 Docker Setup Checklist

**Quick troubleshooting checklist for Docker issues:**

1. **Environment Files**
   - [ ] Both `.env.local` AND `.env` exist
   - [ ] Both contain Supabase credentials
   - [ ] `DEVELOPMENT_AUTH_BYPASS=true` is set

2. **WSL Setup (Windows only)**
   - [ ] `export DOCKER_HOST=unix:///var/run/docker.sock` is set
   - [ ] Added to `~/.bashrc` for persistence

3. **Container Status**
   - [ ] All containers running: `docker ps`
   - [ ] App container healthy (wait 60s first)
   - [ ] Redis container running

4. **Verification**
   - [ ] Health check passes: `curl http://localhost:3000/api/health | jq .`
   - [ ] Opportunities loaded: `curl http://localhost:3000/api/opportunities/count | jq .`
   - [ ] No errors in logs: `docker logs medcontract-dev --tail=50`

5. **If Still Failing**
   ```bash
   # Complete reset
   docker-compose down -v
   rm -rf .next node_modules
   cp .env.consolidated .env.local
   cp .env.consolidated .env
   docker-compose up -d --build
   ```

---

**Last Updated**: June 2025 | **Focus**: Docker setup and current development blockers