"""
Embeddings API Endpoints
Handles text embedding generation and management
"""
from fastapi import APIRouter, Request, HTTPException
from typing import Union, List
import time

from app.models.schemas import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import EmbeddingService
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/generate", response_model=EmbeddingResponse)
async def generate_embeddings(
    request: Request,
    embedding_request: EmbeddingRequest
) -> EmbeddingResponse:
    """Generate embeddings for text(s)"""
    start_time = time.time()
    
    try:
        # Get embedding service
        embedding_service = EmbeddingService()
        
        # Check cache if available
        redis_cache = getattr(request.app.state, "redis", None)
        
        # Generate embeddings
        embeddings = await embedding_service.generate_embeddings(
            texts=embedding_request.texts,
            model=embedding_request.model,
            batch_size=embedding_request.batch_size
        )
        
        # Cache embeddings if Redis is available
        if redis_cache and isinstance(embedding_request.texts, str):
            await redis_cache.set_embedding(
                text=embedding_request.texts,
                model=embedding_request.model or "default",
                embedding=embeddings if isinstance(embeddings[0], float) else embeddings[0]
            )
        
        # Get embedding dimension
        dimension = embedding_service.get_embedding_dimension(embedding_request.model)
        
        processing_time = time.time() - start_time
        
        metrics_collector.observe_histogram(
            "embedding_generation_time",
            processing_time
        )
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model=embedding_request.model or "default",
            dimension=dimension,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similarity")
async def calculate_similarity(
    request: Request,
    embedding1: List[float],
    embedding2: List[float]
) -> dict:
    """Calculate cosine similarity between two embeddings"""
    try:
        embedding_service = EmbeddingService()
        
        similarity = embedding_service.cosine_similarity(embedding1, embedding2)
        
        return {
            "similarity": similarity,
            "similarity_percentage": similarity * 100
        }
        
    except Exception as e:
        logger.error(f"Failed to calculate similarity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-similarity")
async def batch_similarity(
    request: Request,
    query_embedding: List[float],
    embeddings: List[List[float]],
    top_k: int = 10,
    threshold: float = 0.7
) -> dict:
    """Find most similar embeddings from a batch"""
    try:
        embedding_service = EmbeddingService()
        
        results = await embedding_service.find_similar(
            query_embedding=query_embedding,
            embeddings=embeddings,
            top_k=top_k,
            threshold=threshold
        )
        
        return {
            "results": results,
            "total_compared": len(embeddings),
            "matches_found": len(results)
        }
        
    except Exception as e:
        logger.error(f"Failed to find similar embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_embedding_models() -> dict:
    """List available embedding models"""
    return {
        "models": [
            {
                "name": "sentence-transformers/all-mpnet-base-v2",
                "dimension": 768,
                "description": "General purpose sentence embeddings",
                "max_sequence_length": 384
            },
            {
                "name": "sentence-transformers/all-MiniLM-L6-v2",
                "dimension": 384,
                "description": "Lightweight sentence embeddings",
                "max_sequence_length": 256
            },
            {
                "name": "text-embedding-ada-002",
                "dimension": 1536,
                "description": "OpenAI's text embedding model",
                "max_sequence_length": 8191,
                "requires_api_key": True
            },
            {
                "name": "text-embedding-3-small",
                "dimension": 1536,
                "description": "OpenAI's latest small embedding model",
                "max_sequence_length": 8191,
                "requires_api_key": True
            },
            {
                "name": "text-embedding-3-large",
                "dimension": 3072,
                "description": "OpenAI's latest large embedding model",
                "max_sequence_length": 8191,
                "requires_api_key": True
            }
        ]
    }