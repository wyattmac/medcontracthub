"""
AI Service Main Application Entry Point
Handles model orchestration, embeddings, and vector search with Weaviate
"""
import asyncio
import signal
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from app.api import health, embeddings, inference, search
from app.config import settings
from app.services.weaviate_client import WeaviateService
from app.services.kafka_consumer import KafkaEventConsumer
from app.services.redis_cache import RedisCache
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

# Setup logger
logger = setup_logger(__name__)

# Global services
weaviate_service: WeaviateService
kafka_consumer: KafkaEventConsumer
redis_cache: RedisCache


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Manage application lifecycle"""
    global weaviate_service, kafka_consumer, redis_cache
    
    logger.info("Starting AI Service...")
    
    try:
        # Initialize Weaviate
        weaviate_service = WeaviateService()
        await weaviate_service.initialize()
        app.state.weaviate = weaviate_service
        
        # Initialize Redis cache
        redis_cache = RedisCache()
        await redis_cache.initialize()
        app.state.redis = redis_cache
        
        # Initialize Kafka consumer
        kafka_consumer = KafkaEventConsumer(
            weaviate_service=weaviate_service,
            redis_cache=redis_cache
        )
        
        # Start background tasks
        asyncio.create_task(kafka_consumer.start())
        
        # Initialize metrics
        metrics_collector.initialize()
        
        logger.info("AI Service started successfully")
        
        yield
        
    finally:
        logger.info("Shutting down AI Service...")
        
        # Cleanup
        if kafka_consumer:
            await kafka_consumer.stop()
        
        if redis_cache:
            await redis_cache.close()
            
        if weaviate_service:
            await weaviate_service.close()
        
        logger.info("AI Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="AI Service",
    description="Hybrid Intelligence AI Service with Weaviate Vector Database",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
app.include_router(inference.router, prefix="/inference", tags=["inference"])
app.include_router(search.router, prefix="/search", tags=["search"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    metrics_collector.increment_error_count("unhandled_exception")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


# Graceful shutdown
def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {sig}, initiating graceful shutdown...")
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "level": "INFO",
                "handlers": ["default"],
            },
        }
    )