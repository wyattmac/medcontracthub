# AI Service

AI Service for the MedContractHub Hybrid Intelligence Platform. This service handles all AI/ML operations including embeddings, inference, and vector search using Weaviate as the vector database.

## Features

- **Multi-Model Support**: Claude, GPT-4, Mistral, and Llama models
- **Vector Database**: Weaviate for embeddings and similarity search
- **Event-Driven**: Kafka integration for asynchronous processing
- **Caching**: Redis for response and embedding caching
- **GPU Support**: Optional GPU acceleration for embeddings
- **Ensemble Methods**: Combine multiple models for better results
- **Monitoring**: Prometheus metrics and health checks

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   AI Service    │────▶│    Weaviate     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          │
                        ┌─────────────────┐              │
                        │     Kafka       │◀─────────────┘
                        └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │     Redis       │
                        └─────────────────┘
```

## API Endpoints

### Health
- `GET /health/` - Health status
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Embeddings
- `POST /embeddings/generate` - Generate text embeddings
- `POST /embeddings/similarity` - Calculate similarity between embeddings
- `POST /embeddings/batch-similarity` - Batch similarity search
- `GET /embeddings/models` - List available embedding models

### Inference
- `POST /inference/generate` - Generate text using AI models
- `POST /inference/stream` - Stream text generation
- `POST /inference/ensemble` - Ensemble model generation
- `GET /inference/models` - List available inference models

### Search
- `POST /search/vector` - Vector similarity search
- `POST /search/hybrid` - Hybrid search (keyword + vector)
- `GET /search/documents` - Search documents
- `GET /search/proposals` - Search proposals
- `GET /search/similar/{class_name}/{id}` - Find similar items

## Environment Variables

```bash
# Service Configuration
PORT=8200
DEBUG=false
LOG_LEVEL=INFO

# Weaviate
WEAVIATE_URL=http://weaviate:8080
WEAVIATE_API_KEY=your-api-key
WEAVIATE_TIMEOUT=30

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_PASSWORD=your-password
CACHE_TTL=3600

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_CONSUMER_GROUP=ai-service-consumer
KAFKA_TOPICS=document-processed,requirements-extracted,proposal-requested

# AI Model API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
MISTRAL_API_KEY=your-mistral-key
HUGGINGFACE_API_KEY=your-huggingface-key

# Model Configuration
DEFAULT_EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
DEFAULT_INFERENCE_MODEL=claude-3-opus-20240229
MAX_TOKENS=4096
TEMPERATURE=0.7

# GPU Configuration
USE_GPU=false
CUDA_VISIBLE_DEVICES=0

# Performance
MAX_BATCH_SIZE=32
EMBEDDING_BATCH_SIZE=16
REQUEST_TIMEOUT=60
MAX_RETRIES=3
```

## Development

### Local Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python main.py

# Run with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8200
```

### Docker
```bash
# Build image
docker build -t ai-service .

# Run container
docker run -p 8200:8200 --env-file .env ai-service
```

### Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Type checking
mypy app/
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
  namespace: medcontract-dev
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
    spec:
      containers:
      - name: ai-service
        image: medcontracthub/ai-service:latest
        ports:
        - containerPort: 8200
        env:
        - name: WEAVIATE_URL
          value: "http://weaviate:8080"
        - name: REDIS_URL
          value: "redis://redis:6379"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

## Monitoring

### Prometheus Metrics
- Request counts and latencies
- Model inference times
- Embedding generation times
- Cache hit/miss rates
- Error rates by type

### Grafana Dashboards
- Service health overview
- Model performance comparison
- Search query analytics
- Resource utilization

## Troubleshooting

### Common Issues

1. **Weaviate Connection Failed**
   - Check WEAVIATE_URL is correct
   - Verify Weaviate is running and accessible
   - Check network policies in Kubernetes

2. **Model API Errors**
   - Verify API keys are set correctly
   - Check rate limits
   - Monitor token usage

3. **Out of Memory**
   - Reduce batch sizes
   - Enable GPU if available
   - Scale horizontally

4. **Slow Inference**
   - Use caching for repeated queries
   - Choose appropriate model size
   - Enable GPU acceleration

## Performance Optimization

1. **Caching Strategy**
   - Cache embeddings for common texts
   - Cache model responses for identical prompts
   - Use Redis TTL appropriately

2. **Batch Processing**
   - Group embedding requests
   - Process Kafka events in batches
   - Optimize Weaviate batch inserts

3. **Model Selection**
   - Use fast models for real-time needs
   - Reserve large models for complex tasks
   - Leverage ensemble methods wisely

## Security

- All API keys stored as environment variables
- TLS encryption for external connections
- Input validation and sanitization
- Rate limiting per client
- Audit logging for all operations