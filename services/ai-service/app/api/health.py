"""
Health Check Endpoints
Provides health status and readiness checks
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import psutil
import torch

from app.models.schemas import HealthStatus
from app.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter()


@router.get("/", response_model=HealthStatus)
async def health_check(request: Request) -> HealthStatus:
    """Basic health check endpoint"""
    try:
        # Get service statuses
        weaviate_healthy = False
        redis_healthy = False
        
        if hasattr(request.app.state, "weaviate"):
            try:
                # Simple connectivity check
                weaviate_healthy = request.app.state.weaviate._initialized
            except:
                pass
        
        if hasattr(request.app.state, "redis"):
            redis_healthy = await request.app.state.redis.health_check()
        
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        # Check GPU if available
        gpu_info = {}
        if settings.USE_GPU and torch.cuda.is_available():
            gpu_info = {
                "available": True,
                "device_count": torch.cuda.device_count(),
                "current_device": torch.cuda.current_device(),
                "device_name": torch.cuda.get_device_name(0)
            }
        
        return HealthStatus(
            status="healthy",
            version="1.0.0",
            services={
                "weaviate": weaviate_healthy,
                "redis": redis_healthy,
                "kafka": True,  # Assumed healthy if service is running
                "models": True
            },
            metrics={
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": memory.available / (1024**3),
                "gpu": gpu_info
            }
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@router.get("/ready")
async def readiness_check(request: Request) -> JSONResponse:
    """Readiness check for Kubernetes"""
    try:
        # Check critical services
        if not hasattr(request.app.state, "weaviate"):
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": "Weaviate not initialized"}
            )
        
        if not hasattr(request.app.state, "redis"):
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": "Redis not initialized"}
            )
        
        # Check Weaviate connection
        if not request.app.state.weaviate._initialized:
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": "Weaviate not connected"}
            )
        
        # Check Redis connection
        if not await request.app.state.redis.health_check():
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": "Redis not connected"}
            )
        
        return JSONResponse(
            status_code=200,
            content={"ready": True}
        )
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"ready": False, "reason": str(e)}
        )


@router.get("/live")
async def liveness_check() -> JSONResponse:
    """Liveness check for Kubernetes"""
    # Simple check - if we can respond, we're alive
    return JSONResponse(
        status_code=200,
        content={"alive": True}
    )