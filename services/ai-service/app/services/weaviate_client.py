"""
Weaviate Vector Database Client
Handles all vector database operations for the AI Service
"""
import asyncio
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import weaviate
from weaviate import Client
from weaviate.exceptions import WeaviateBaseError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)


class WeaviateService:
    """Service for interacting with Weaviate vector database"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._initialized = False
        
    async def initialize(self) -> None:
        """Initialize Weaviate client and create schemas"""
        try:
            # Connect to Weaviate
            self.client = self._create_client()
            
            # Create schemas if they don't exist
            await self._create_schemas()
            
            self._initialized = True
            logger.info("Weaviate service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Weaviate service: {e}")
            raise
    
    def _create_client(self) -> Client:
        """Create Weaviate client with configuration"""
        auth_config = None
        if settings.WEAVIATE_API_KEY:
            auth_config = weaviate.AuthApiKey(api_key=settings.WEAVIATE_API_KEY)
            
        return weaviate.Client(
            url=settings.WEAVIATE_URL,
            auth_client_secret=auth_config,
            timeout_config=(settings.WEAVIATE_TIMEOUT, settings.WEAVIATE_TIMEOUT),
            additional_headers={
                "X-Service-Name": settings.SERVICE_NAME
            }
        )
    
    async def _create_schemas(self) -> None:
        """Create Weaviate schemas for different data types"""
        schemas = [
            self._get_document_schema(),
            self._get_proposal_schema(),
            self._get_requirement_schema(),
            self._get_knowledge_schema()
        ]
        
        for schema in schemas:
            class_name = schema["class"]
            
            # Check if schema exists
            if not self.client.schema.exists(class_name):
                try:
                    self.client.schema.create_class(schema)
                    logger.info(f"Created schema for class: {class_name}")
                except Exception as e:
                    logger.error(f"Failed to create schema for {class_name}: {e}")
                    raise
    
    def _get_document_schema(self) -> Dict[str, Any]:
        """Schema for document embeddings"""
        return {
            "class": "Document",
            "description": "Federal contract documents and attachments",
            "vectorizer": "none",  # We'll provide our own embeddings
            "properties": [
                {
                    "name": "content",
                    "dataType": ["text"],
                    "description": "Document content"
                },
                {
                    "name": "document_id",
                    "dataType": ["string"],
                    "description": "Unique document identifier"
                },
                {
                    "name": "opportunity_id",
                    "dataType": ["string"],
                    "description": "Associated opportunity ID"
                },
                {
                    "name": "document_type",
                    "dataType": ["string"],
                    "description": "Type of document (RFP, SOW, etc.)"
                },
                {
                    "name": "metadata",
                    "dataType": ["object"],
                    "description": "Additional document metadata"
                },
                {
                    "name": "created_at",
                    "dataType": ["date"],
                    "description": "Creation timestamp"
                }
            ]
        }
    
    def _get_proposal_schema(self) -> Dict[str, Any]:
        """Schema for proposal data"""
        return {
            "class": "Proposal",
            "description": "Generated proposals and responses",
            "vectorizer": "none",
            "properties": [
                {
                    "name": "content",
                    "dataType": ["text"],
                    "description": "Proposal content"
                },
                {
                    "name": "proposal_id",
                    "dataType": ["string"],
                    "description": "Unique proposal identifier"
                },
                {
                    "name": "opportunity_id",
                    "dataType": ["string"],
                    "description": "Associated opportunity ID"
                },
                {
                    "name": "confidence_score",
                    "dataType": ["number"],
                    "description": "AI confidence score"
                },
                {
                    "name": "model_used",
                    "dataType": ["string"],
                    "description": "AI model used for generation"
                },
                {
                    "name": "status",
                    "dataType": ["string"],
                    "description": "Proposal status"
                },
                {
                    "name": "created_at",
                    "dataType": ["date"],
                    "description": "Creation timestamp"
                }
            ]
        }
    
    def _get_requirement_schema(self) -> Dict[str, Any]:
        """Schema for extracted requirements"""
        return {
            "class": "Requirement",
            "description": "Extracted contract requirements",
            "vectorizer": "none",
            "properties": [
                {
                    "name": "content",
                    "dataType": ["text"],
                    "description": "Requirement text"
                },
                {
                    "name": "requirement_id",
                    "dataType": ["string"],
                    "description": "Unique requirement identifier"
                },
                {
                    "name": "document_id",
                    "dataType": ["string"],
                    "description": "Source document ID"
                },
                {
                    "name": "category",
                    "dataType": ["string"],
                    "description": "Requirement category"
                },
                {
                    "name": "priority",
                    "dataType": ["string"],
                    "description": "Requirement priority"
                },
                {
                    "name": "extracted_at",
                    "dataType": ["date"],
                    "description": "Extraction timestamp"
                }
            ]
        }
    
    def _get_knowledge_schema(self) -> Dict[str, Any]:
        """Schema for organizational knowledge base"""
        return {
            "class": "Knowledge",
            "description": "Organizational knowledge and best practices",
            "vectorizer": "none",
            "properties": [
                {
                    "name": "content",
                    "dataType": ["text"],
                    "description": "Knowledge content"
                },
                {
                    "name": "title",
                    "dataType": ["string"],
                    "description": "Knowledge title"
                },
                {
                    "name": "category",
                    "dataType": ["string"],
                    "description": "Knowledge category"
                },
                {
                    "name": "source",
                    "dataType": ["string"],
                    "description": "Knowledge source"
                },
                {
                    "name": "tags",
                    "dataType": ["string[]"],
                    "description": "Associated tags"
                },
                {
                    "name": "created_at",
                    "dataType": ["date"],
                    "description": "Creation timestamp"
                }
            ]
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def insert_vector(
        self,
        class_name: str,
        data: Dict[str, Any],
        vector: List[float]
    ) -> str:
        """Insert a single vector with data"""
        try:
            with metrics_collector.timer("weaviate_insert"):
                result = await asyncio.to_thread(
                    self.client.data_object.create,
                    data_object=data,
                    class_name=class_name,
                    vector=vector
                )
                
                metrics_collector.increment_counter("vectors_inserted")
                return result
                
        except Exception as e:
            logger.error(f"Failed to insert vector: {e}")
            metrics_collector.increment_error_count("weaviate_insert_error")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def batch_insert_vectors(
        self,
        class_name: str,
        data_objects: List[Dict[str, Any]],
        vectors: List[List[float]]
    ) -> List[str]:
        """Batch insert multiple vectors"""
        try:
            with metrics_collector.timer("weaviate_batch_insert"):
                # Prepare batch
                with self.client.batch as batch:
                    batch.batch_size = settings.MAX_BATCH_SIZE
                    
                    uuids = []
                    for data, vector in zip(data_objects, vectors):
                        uuid = batch.add_data_object(
                            data_object=data,
                            class_name=class_name,
                            vector=vector
                        )
                        uuids.append(uuid)
                
                metrics_collector.increment_counter("vectors_inserted", len(uuids))
                return uuids
                
        except Exception as e:
            logger.error(f"Failed to batch insert vectors: {e}")
            metrics_collector.increment_error_count("weaviate_batch_insert_error")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def search_vectors(
        self,
        class_name: str,
        vector: List[float],
        limit: int = 10,
        where_filter: Optional[Dict[str, Any]] = None,
        additional_fields: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        try:
            with metrics_collector.timer("weaviate_search"):
                # Build query
                query = (
                    self.client.query
                    .get(class_name, additional_fields or ["*"])
                    .with_near_vector({"vector": vector})
                    .with_limit(limit)
                    .with_additional(["id", "distance", "certainty"])
                )
                
                # Add filter if provided
                if where_filter:
                    query = query.with_where(where_filter)
                
                # Execute search
                result = await asyncio.to_thread(query.do)
                
                metrics_collector.increment_counter("vector_searches")
                
                # Extract results
                return result.get("data", {}).get("Get", {}).get(class_name, [])
                
        except Exception as e:
            logger.error(f"Failed to search vectors: {e}")
            metrics_collector.increment_error_count("weaviate_search_error")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def hybrid_search(
        self,
        class_name: str,
        query: str,
        vector: Optional[List[float]] = None,
        alpha: float = 0.5,
        limit: int = 10,
        where_filter: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search combining keyword and vector search"""
        try:
            with metrics_collector.timer("weaviate_hybrid_search"):
                # Build hybrid query
                hybrid_query = (
                    self.client.query
                    .get(class_name, ["*"])
                    .with_hybrid(
                        query=query,
                        vector=vector,
                        alpha=alpha  # Balance between keyword (0) and vector (1) search
                    )
                    .with_limit(limit)
                    .with_additional(["id", "score", "explainScore"])
                )
                
                # Add filter if provided
                if where_filter:
                    hybrid_query = hybrid_query.with_where(where_filter)
                
                # Execute search
                result = await asyncio.to_thread(hybrid_query.do)
                
                metrics_collector.increment_counter("hybrid_searches")
                
                return result.get("data", {}).get("Get", {}).get(class_name, [])
                
        except Exception as e:
            logger.error(f"Failed to perform hybrid search: {e}")
            metrics_collector.increment_error_count("weaviate_hybrid_search_error")
            raise
    
    async def update_vector(
        self,
        class_name: str,
        uuid: str,
        data: Dict[str, Any],
        vector: Optional[List[float]] = None
    ) -> None:
        """Update an existing vector"""
        try:
            with metrics_collector.timer("weaviate_update"):
                await asyncio.to_thread(
                    self.client.data_object.update,
                    uuid=uuid,
                    class_name=class_name,
                    data_object=data,
                    vector=vector
                )
                
                metrics_collector.increment_counter("vectors_updated")
                
        except Exception as e:
            logger.error(f"Failed to update vector: {e}")
            metrics_collector.increment_error_count("weaviate_update_error")
            raise
    
    async def delete_vector(self, class_name: str, uuid: str) -> None:
        """Delete a vector by UUID"""
        try:
            with metrics_collector.timer("weaviate_delete"):
                await asyncio.to_thread(
                    self.client.data_object.delete,
                    uuid=uuid,
                    class_name=class_name
                )
                
                metrics_collector.increment_counter("vectors_deleted")
                
        except Exception as e:
            logger.error(f"Failed to delete vector: {e}")
            metrics_collector.increment_error_count("weaviate_delete_error")
            raise
    
    async def get_vector(
        self,
        class_name: str,
        uuid: str,
        include_vector: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Get a vector by UUID"""
        try:
            with metrics_collector.timer("weaviate_get"):
                result = await asyncio.to_thread(
                    self.client.data_object.get_by_id,
                    uuid=uuid,
                    class_name=class_name,
                    with_vector=include_vector
                )
                
                return result
                
        except Exception as e:
            logger.error(f"Failed to get vector: {e}")
            metrics_collector.increment_error_count("weaviate_get_error")
            raise
    
    async def close(self) -> None:
        """Close Weaviate connection"""
        if self.client:
            # Weaviate client doesn't have an explicit close method
            self.client = None
            self._initialized = False
            logger.info("Weaviate service closed")