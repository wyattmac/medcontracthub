"""
Search API Endpoints
Handles vector and hybrid search operations
"""
from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional, List, Dict, Any, Union
import time

from app.models.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.embedding_service import EmbeddingService
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/vector", response_model=SearchResponse)
async def vector_search(
    request: Request,
    search_request: SearchRequest
) -> SearchResponse:
    """Perform vector similarity search"""
    start_time = time.time()
    
    try:
        weaviate_service = request.app.state.weaviate
        
        # Generate embedding if query is text
        if isinstance(search_request.query, str):
            embedding_service = EmbeddingService()
            query_embedding = await embedding_service.generate_embeddings(
                search_request.query
            )
        else:
            query_embedding = search_request.query
        
        # Perform vector search
        results = await weaviate_service.search_vectors(
            class_name=search_request.class_name,
            vector=query_embedding,
            limit=search_request.limit,
            where_filter=search_request.filters,
            additional_fields=["*"] if search_request.include_embeddings else None
        )
        
        # Format results
        search_results = []
        for result in results:
            search_results.append(SearchResult(
                id=result.get("_additional", {}).get("id", ""),
                score=result.get("_additional", {}).get("certainty", 0.0),
                data=result,
                embedding=result.get("_additional", {}).get("vector") if search_request.include_embeddings else None
            ))
        
        processing_time = time.time() - start_time
        
        metrics_collector.observe_histogram(
            "vector_search_time",
            processing_time,
            tags={"class": search_request.class_name}
        )
        
        return SearchResponse(
            results=search_results,
            total=len(search_results),
            query_embedding=query_embedding if search_request.include_embeddings else None,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hybrid", response_model=SearchResponse)
async def hybrid_search(
    request: Request,
    search_request: SearchRequest
) -> SearchResponse:
    """Perform hybrid search combining keyword and vector search"""
    start_time = time.time()
    
    try:
        if not isinstance(search_request.query, str):
            raise ValueError("Hybrid search requires text query")
        
        weaviate_service = request.app.state.weaviate
        
        # Generate embedding for vector component
        embedding_service = EmbeddingService()
        query_embedding = await embedding_service.generate_embeddings(
            search_request.query
        )
        
        # Perform hybrid search
        results = await weaviate_service.hybrid_search(
            class_name=search_request.class_name,
            query=search_request.query,
            vector=query_embedding,
            alpha=search_request.alpha,
            limit=search_request.limit,
            where_filter=search_request.filters
        )
        
        # Format results
        search_results = []
        for result in results:
            search_results.append(SearchResult(
                id=result.get("_additional", {}).get("id", ""),
                score=result.get("_additional", {}).get("score", 0.0),
                data=result,
                embedding=result.get("_additional", {}).get("vector") if search_request.include_embeddings else None
            ))
        
        processing_time = time.time() - start_time
        
        metrics_collector.observe_histogram(
            "hybrid_search_time",
            processing_time,
            tags={"class": search_request.class_name}
        )
        
        return SearchResponse(
            results=search_results,
            total=len(search_results),
            query_embedding=query_embedding if search_request.include_embeddings else None,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents")
async def search_documents(
    request: Request,
    query: str = Query(..., description="Search query"),
    opportunity_id: Optional[str] = Query(None, description="Filter by opportunity ID"),
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> dict:
    """Search documents with filters"""
    try:
        # Build filters
        filters = {}
        if opportunity_id:
            filters = {
                "path": ["opportunity_id"],
                "operator": "Equal",
                "valueString": opportunity_id
            }
        
        if document_type:
            if filters:
                filters = {
                    "operator": "And",
                    "operands": [
                        filters,
                        {
                            "path": ["document_type"],
                            "operator": "Equal",
                            "valueString": document_type
                        }
                    ]
                }
            else:
                filters = {
                    "path": ["document_type"],
                    "operator": "Equal",
                    "valueString": document_type
                }
        
        # Perform search
        search_req = SearchRequest(
            query=query,
            class_name="Document",
            limit=limit,
            offset=offset,
            filters=filters if filters else None,
            hybrid=True
        )
        
        response = await hybrid_search(request, search_req)
        
        return {
            "documents": [r.data for r in response.results],
            "total": response.total,
            "query": query,
            "filters": {
                "opportunity_id": opportunity_id,
                "document_type": document_type
            }
        }
        
    except Exception as e:
        logger.error(f"Document search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/proposals")
async def search_proposals(
    request: Request,
    query: str = Query(..., description="Search query"),
    opportunity_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(10, ge=1, le=100)
) -> dict:
    """Search proposals with filters"""
    try:
        # Build filters
        filters = []
        
        if opportunity_id:
            filters.append({
                "path": ["opportunity_id"],
                "operator": "Equal",
                "valueString": opportunity_id
            })
        
        if status:
            filters.append({
                "path": ["status"],
                "operator": "Equal",
                "valueString": status
            })
        
        if min_confidence > 0:
            filters.append({
                "path": ["confidence_score"],
                "operator": "GreaterThanEqual",
                "valueNumber": min_confidence
            })
        
        # Combine filters
        combined_filter = None
        if len(filters) == 1:
            combined_filter = filters[0]
        elif len(filters) > 1:
            combined_filter = {
                "operator": "And",
                "operands": filters
            }
        
        # Perform search
        search_req = SearchRequest(
            query=query,
            class_name="Proposal",
            limit=limit,
            filters=combined_filter,
            hybrid=True
        )
        
        response = await hybrid_search(request, search_req)
        
        return {
            "proposals": [r.data for r in response.results],
            "total": response.total,
            "query": query,
            "filters": {
                "opportunity_id": opportunity_id,
                "status": status,
                "min_confidence": min_confidence
            }
        }
        
    except Exception as e:
        logger.error(f"Proposal search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/similar/{class_name}/{id}")
async def find_similar(
    request: Request,
    class_name: str,
    id: str,
    limit: int = Query(10, ge=1, le=100)
) -> dict:
    """Find similar items to a given item"""
    try:
        weaviate_service = request.app.state.weaviate
        
        # Get the item and its vector
        item = await weaviate_service.get_vector(
            class_name=class_name,
            uuid=id,
            include_vector=True
        )
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        vector = item.get("vector")
        if not vector:
            raise HTTPException(status_code=400, detail="Item has no vector")
        
        # Search for similar items (excluding the original)
        results = await weaviate_service.search_vectors(
            class_name=class_name,
            vector=vector,
            limit=limit + 1,  # Get one extra to exclude the original
            where_filter={
                "path": ["id"],
                "operator": "NotEqual",
                "valueString": id
            }
        )
        
        # Take only the requested limit
        results = results[:limit]
        
        return {
            "similar_items": results,
            "total": len(results),
            "original_id": id,
            "class_name": class_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))