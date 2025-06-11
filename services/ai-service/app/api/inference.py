"""
Inference API Endpoints
Handles AI model inference and generation
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import time
import json
from typing import AsyncGenerator

from app.models.schemas import InferenceRequest, InferenceResponse
from app.services.model_orchestrator import ModelOrchestrator, ModelType, ModelCapability
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/generate", response_model=InferenceResponse)
async def generate_text(
    request: Request,
    inference_request: InferenceRequest
) -> InferenceResponse:
    """Generate text using AI models"""
    start_time = time.time()
    
    try:
        # Check cache first
        redis_cache = getattr(request.app.state, "redis", None)
        
        if redis_cache:
            cached_response = await redis_cache.get_model_response(
                prompt=inference_request.prompt,
                model=inference_request.model,
                params={
                    "temperature": inference_request.temperature,
                    "max_tokens": inference_request.max_tokens
                }
            )
            
            if cached_response:
                metrics_collector.increment_counter("inference_cache_hits")
                return InferenceResponse(**cached_response)
        
        # Get model orchestrator
        orchestrator = ModelOrchestrator()
        
        # Generate response
        response = await orchestrator.generate(
            prompt=inference_request.prompt,
            model_type=ModelType(inference_request.model) if inference_request.model else None,
            max_tokens=inference_request.max_tokens,
            temperature=inference_request.temperature,
            system_prompt=inference_request.system_prompt,
            top_p=inference_request.top_p,
            frequency_penalty=inference_request.frequency_penalty,
            presence_penalty=inference_request.presence_penalty,
            stop=inference_request.stop_sequences
        )
        
        processing_time = time.time() - start_time
        
        # Create response object
        result = InferenceResponse(
            content=response["content"],
            model=response["model"],
            usage=response.get("usage", {}),
            metadata=response.get("metadata", {}),
            processing_time=processing_time
        )
        
        # Cache response if Redis available
        if redis_cache:
            await redis_cache.set_model_response(
                prompt=inference_request.prompt,
                model=response["model"],
                response=result.dict(),
                params={
                    "temperature": inference_request.temperature,
                    "max_tokens": inference_request.max_tokens
                }
            )
        
        metrics_collector.observe_histogram(
            "inference_generation_time",
            processing_time,
            tags={"model": response["model"]}
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to generate text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_generation(
    request: Request,
    inference_request: InferenceRequest
) -> StreamingResponse:
    """Stream text generation response"""
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            orchestrator = ModelOrchestrator()
            
            # For now, generate full response and stream it
            # TODO: Implement true streaming from models
            response = await orchestrator.generate(
                prompt=inference_request.prompt,
                model_type=ModelType(inference_request.model) if inference_request.model else None,
                max_tokens=inference_request.max_tokens,
                temperature=inference_request.temperature,
                system_prompt=inference_request.system_prompt
            )
            
            # Stream response in chunks
            content = response["content"]
            chunk_size = 20  # characters per chunk
            
            for i in range(0, len(content), chunk_size):
                chunk = content[i:i + chunk_size]
                data = {
                    "content": chunk,
                    "done": i + chunk_size >= len(content)
                }
                yield f"data: {json.dumps(data)}\n\n"
                
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    )


@router.post("/ensemble")
async def ensemble_inference(
    request: Request,
    prompt: str,
    models: list[str] = None,
    voting_method: str = "confidence",
    max_tokens: int = None,
    temperature: float = None
) -> dict:
    """Generate text using ensemble of models"""
    start_time = time.time()
    
    try:
        orchestrator = ModelOrchestrator()
        
        # Convert model names to ModelType
        model_types = None
        if models:
            model_types = [ModelType(m) for m in models]
        
        response = await orchestrator.ensemble_generate(
            prompt=prompt,
            models=model_types,
            voting_method=voting_method,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        processing_time = time.time() - start_time
        
        return {
            "content": response["content"],
            "ensemble_method": response.get("method"),
            "models_used": [r["model"] for r in response.get("ensemble_results", [])],
            "processing_time": processing_time
        }
        
    except Exception as e:
        logger.error(f"Ensemble inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_inference_models() -> dict:
    """List available inference models"""
    return {
        "models": [
            {
                "id": "claude",
                "name": "Claude 3 Opus",
                "provider": "Anthropic",
                "capabilities": ["general", "technical", "analysis", "coding"],
                "max_tokens": 4096,
                "requires_api_key": True
            },
            {
                "id": "gpt4",
                "name": "GPT-4 Turbo",
                "provider": "OpenAI",
                "capabilities": ["general", "creative", "coding"],
                "max_tokens": 4096,
                "requires_api_key": True
            },
            {
                "id": "mistral",
                "name": "Mistral Large",
                "provider": "Mistral AI",
                "capabilities": ["technical", "extraction", "analysis"],
                "max_tokens": 8192,
                "requires_api_key": True
            },
            {
                "id": "llama",
                "name": "Llama 2 70B",
                "provider": "Meta",
                "capabilities": ["general", "technical", "coding"],
                "max_tokens": 4096,
                "requires_api_key": True
            }
        ],
        "voting_methods": ["majority", "confidence", "best_response"]
    }