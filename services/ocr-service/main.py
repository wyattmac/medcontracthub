"""
OCR Microservice for MedContractHub
Handles document processing, text extraction, and intelligent analysis
"""

from fastapi import FastAPI, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager
import asyncio
import structlog
from prometheus_client import Counter, Histogram, generate_latest
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import time
from datetime import datetime
from typing import Optional, Dict, Any
import os

from app.config import settings
from app.services.ocr_service import OCRService
from app.services.cache_service import CacheService
from app.services.kafka_producer import KafkaProducer
from app.services.event_consumer import EventConsumer
from app.models import OCRRequest, OCRResponse, HealthCheck
from app.utils.circuit_breaker import CircuitBreaker

# Initialize structured logging
logger = structlog.get_logger()

# Prometheus metrics
ocr_requests_total = Counter('ocr_requests_total', 'Total OCR requests', ['status', 'model'])
ocr_processing_time = Histogram('ocr_processing_seconds', 'OCR processing time')
ocr_cache_hits = Counter('ocr_cache_hits_total', 'OCR cache hits')

# Initialize services
ocr_service = OCRService()
cache_service = CacheService()
kafka_producer = KafkaProducer()
event_consumer = EventConsumer()
circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting OCR microservice", 
                environment=settings.ENVIRONMENT,
                port=settings.PORT)
    
    # Start services
    await kafka_producer.start()
    await cache_service.connect()
    
    # Start event consumer in background
    consumer_task = asyncio.create_task(event_consumer.start())
    
    yield
    
    # Shutdown
    logger.info("Shutting down OCR microservice")
    
    # Stop event consumer
    await event_consumer.stop()
    
    # Cancel consumer task if still running
    if not consumer_task.done():
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
    
    # Stop other services
    await kafka_producer.stop()
    await cache_service.close()
    
    logger.info("OCR microservice stopped")

app = FastAPI(
    title="OCR Microservice",
    description="Document processing and OCR service for MedContractHub",
    version="1.0.0",
    lifespan=lifespan
)

# Enable OpenTelemetry instrumentation
FastAPIInstrumentor.instrument_app(app)

@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Health check endpoint for Kubernetes"""
    checks = {
        "redis": await cache_service.ping(),
        "kafka": kafka_producer.is_connected(),
        "mistral_api": await ocr_service.check_mistral_connection()
    }
    
    is_healthy = all(checks.values())
    
    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "service": "ocr-service",
        "version": "1.0.0",
        "checks": checks,
        "environment": settings.ENVIRONMENT
    }

@app.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes"""
    if not await cache_service.ping():
        raise HTTPException(status_code=503, detail="Cache not ready")
    if not kafka_producer.is_connected():
        raise HTTPException(status_code=503, detail="Kafka not ready")
    
    return {"ready": True}

@app.post("/process/url", response_model=OCRResponse)
async def process_document_url(request: OCRRequest, background_tasks: BackgroundTasks):
    """Process a document from URL"""
    start_time = time.time()
    
    try:
        # Check cache first
        cache_key = f"ocr:{request.document_url}:{request.model}"
        cached_result = await cache_service.get(cache_key)
        
        if cached_result:
            ocr_cache_hits.inc()
            logger.info("OCR cache hit", url=request.document_url)
            return cached_result
        
        # Process with circuit breaker
        result = await circuit_breaker.call(
            ocr_service.process_document_url,
            request.document_url,
            model=request.model,
            options=request.options
        )
        
        # Cache result
        await cache_service.set(cache_key, result, ttl=settings.CACHE_TTL)
        
        # Send event to Kafka
        background_tasks.add_task(
            kafka_producer.send_event,
            "document.processed",
            {
                "document_url": request.document_url,
                "pages": len(result["pages"]),
                "model": result["metadata"]["model"],
                "processing_time": time.time() - start_time
            }
        )
        
        # Update metrics
        ocr_requests_total.labels(status="success", model=request.model).inc()
        ocr_processing_time.observe(time.time() - start_time)
        
        return result
        
    except Exception as e:
        ocr_requests_total.labels(status="error", model=request.model).inc()
        logger.error("OCR processing failed", error=str(e), url=request.document_url)
        
        # Send error event
        background_tasks.add_task(
            kafka_producer.send_event,
            "document.processing.failed",
            {
                "document_url": request.document_url,
                "error": str(e),
                "model": request.model
            }
        )
        
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@app.post("/process/file", response_model=OCRResponse)
async def process_document_file(
    file: UploadFile = File(...),
    model: str = "pixtral-12b-latest",
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Process an uploaded document file"""
    start_time = time.time()
    
    try:
        # Read file content
        content = await file.read()
        
        # Generate cache key from file hash
        import hashlib
        file_hash = hashlib.sha256(content).hexdigest()
        cache_key = f"ocr:file:{file_hash}:{model}"
        
        # Check cache
        cached_result = await cache_service.get(cache_key)
        if cached_result:
            ocr_cache_hits.inc()
            return cached_result
        
        # Process file
        result = await circuit_breaker.call(
            ocr_service.process_document_buffer,
            content,
            filename=file.filename,
            model=model
        )
        
        # Cache result
        await cache_service.set(cache_key, result, ttl=settings.CACHE_TTL)
        
        # Send event
        background_tasks.add_task(
            kafka_producer.send_event,
            "document.processed",
            {
                "filename": file.filename,
                "size": len(content),
                "pages": len(result["pages"]),
                "model": result["metadata"]["model"],
                "processing_time": time.time() - start_time
            }
        )
        
        ocr_requests_total.labels(status="success", model=model).inc()
        ocr_processing_time.observe(time.time() - start_time)
        
        return result
        
    except Exception as e:
        ocr_requests_total.labels(status="error", model=model).inc()
        logger.error("File OCR processing failed", error=str(e), filename=file.filename)
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@app.post("/analyze", response_model=Dict[str, Any])
async def analyze_document(request: Dict[str, Any]):
    """Analyze document for specific information extraction"""
    try:
        result = await ocr_service.analyze_document(
            text=request.get("text", ""),
            analysis_type=request.get("analysis_type", "requirements"),
            options=request.get("options", {})
        )
        
        return result
        
    except Exception as e:
        logger.error("Document analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type="text/plain")

@app.get("/models")
async def list_models():
    """List available OCR models"""
    return {
        "models": [
            {
                "id": "pixtral-12b-latest",
                "name": "Mistral Pixtral 12B",
                "description": "Latest Mistral vision model for OCR",
                "cost_per_page": 0.001
            },
            {
                "id": "tesseract-5",
                "name": "Tesseract 5",
                "description": "Open source OCR engine",
                "cost_per_page": 0
            },
            {
                "id": "layoutlm-v3",
                "name": "LayoutLM v3",
                "description": "Document understanding with layout awareness",
                "cost_per_page": 0.0005
            }
        ]
    }

@app.get("/status/{document_id}")
async def get_document_status(document_id: str):
    """Get processing status for a document"""
    status_key = f"ocr:status:{document_id}"
    status_data = await cache_service.get(status_key)
    
    if not status_data:
        raise HTTPException(status_code=404, detail="Document status not found")
        
    return status_data

@app.post("/process/async")
async def process_document_async(request: OCRRequest):
    """Submit document for asynchronous processing via events"""
    import uuid
    from app.models.events import DocumentProcessingRequest, DocumentSource
    
    # Generate document ID
    document_id = str(uuid.uuid4())
    
    # Create processing request event
    event = DocumentProcessingRequest(
        event_id=str(uuid.uuid4()),
        document_id=document_id,
        document_url=request.document_url,
        document_source=DocumentSource.URL,
        ocr_model=request.model,
        extract_tables=request.options.get("extract_tables", True) if request.options else True,
        extract_requirements=request.options.get("extract_requirements", True) if request.options else True,
        metadata=request.options or {}
    )
    
    # Send event to Kafka
    await kafka_producer.send_event(
        "contracts.document.process_request",
        event.dict()
    )
    
    # Store initial status
    await cache_service.set(
        f"ocr:status:{document_id}",
        {
            "document_id": document_id,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        },
        ttl=3600
    )
    
    return {
        "document_id": document_id,
        "status": "pending",
        "message": "Document submitted for processing",
        "status_url": f"/status/{document_id}"
    }

@app.get("/results/{document_id}")
async def get_processing_results(document_id: str):
    """Get processing results for a document"""
    # Check status first
    status_key = f"ocr:status:{document_id}"
    status_data = await cache_service.get(status_key)
    
    if not status_data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if status_data.get("status") != "completed":
        raise HTTPException(
            status_code=202, 
            detail=f"Document still processing. Status: {status_data.get('status')}"
        )
        
    # Get results from cache
    result_cache_key = status_data.get("result_cache_key")
    if not result_cache_key:
        raise HTTPException(status_code=404, detail="Results not found")
        
    results = await cache_service.get(result_cache_key)
    if not results:
        raise HTTPException(status_code=404, detail="Results expired")
        
    return results

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error("HTTP exception", 
                 status_code=exc.status_code,
                 detail=exc.detail,
                 path=request.url.path)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "service": "ocr-service"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error("Unhandled exception",
                 error=str(exc),
                 path=request.url.path,
                 exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "service": "ocr-service"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)