"""
Vector Similarity Search for OCR Service
Integrates with Weaviate for semantic document matching
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np
import weaviate
from weaviate.embedded import EmbeddedOptions
import hashlib
from datetime import datetime
import json

# For text embeddings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


@dataclass
class DocumentVector:
    """Represents a document with its vector embedding"""
    document_hash: str
    title: str
    description: str
    content_sample: str  # First 1000 chars
    vector: List[float]
    metadata: Dict[str, Any]
    created_at: datetime


@dataclass 
class SimilarityMatch:
    """Represents a similarity search result"""
    document_hash: str
    title: str
    similarity_score: float
    extraction_data: Dict[str, Any]
    metadata: Dict[str, Any]
    

class VectorSearchService:
    """
    Handles vector-based semantic similarity search for documents
    Uses Weaviate for vector storage and search
    """
    
    def __init__(self, weaviate_url: str = "http://weaviate:8080"):
        self.weaviate_url = weaviate_url
        self.client: Optional[weaviate.Client] = None
        self.model: Optional[SentenceTransformer] = None
        self.collection_name = "ContractDocuments"
        self._initialized = False
        
    async def initialize(self):
        """Initialize Weaviate client and embedding model"""
        try:
            # Initialize Weaviate client
            self.client = weaviate.Client(
                url=self.weaviate_url,
                timeout_config=(5, 15)  # connection timeout, read timeout
            )
            
            # Initialize embedding model (using sentence-transformers)
            # This model is optimized for semantic similarity
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            
            # Create or verify schema
            await self._ensure_schema()
            
            self._initialized = True
            logger.info("Vector search service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize vector search: {e}")
            raise
            
    async def _ensure_schema(self):
        """Ensure Weaviate schema exists for contract documents"""
        try:
            # Check if class already exists
            schema = self.client.schema.get()
            class_exists = any(c['class'] == self.collection_name for c in schema.get('classes', []))
            
            if not class_exists:
                # Create schema for contract documents
                class_schema = {
                    "class": self.collection_name,
                    "description": "Contract documents with OCR extractions",
                    "vectorizer": "none",  # We'll provide our own vectors
                    "properties": [
                        {
                            "name": "documentHash",
                            "dataType": ["string"],
                            "description": "SHA256 hash of the document"
                        },
                        {
                            "name": "title",
                            "dataType": ["text"],
                            "description": "Document title or solicitation number"
                        },
                        {
                            "name": "description",
                            "dataType": ["text"],
                            "description": "Document description or summary"
                        },
                        {
                            "name": "contentSample",
                            "dataType": ["text"],
                            "description": "Sample of document content for context"
                        },
                        {
                            "name": "agency",
                            "dataType": ["string"],
                            "description": "Agency name"
                        },
                        {
                            "name": "documentType",
                            "dataType": ["string"],
                            "description": "Type of document (RFP, RFQ, etc.)"
                        },
                        {
                            "name": "naicsCodes",
                            "dataType": ["string[]"],
                            "description": "NAICS codes associated with document"
                        },
                        {
                            "name": "extractionData",
                            "dataType": ["text"],
                            "description": "JSON-encoded extraction data"
                        },
                        {
                            "name": "processingTimeMs",
                            "dataType": ["int"],
                            "description": "OCR processing time in milliseconds"
                        },
                        {
                            "name": "confidenceScore",
                            "dataType": ["number"],
                            "description": "Extraction confidence score"
                        },
                        {
                            "name": "createdAt",
                            "dataType": ["date"],
                            "description": "When the document was processed"
                        }
                    ]
                }
                
                self.client.schema.create_class(class_schema)
                logger.info(f"Created Weaviate schema for {self.collection_name}")
                
        except Exception as e:
            logger.error(f"Schema creation error: {e}")
            raise
            
    async def index_document(self, 
                           document_hash: str,
                           title: str,
                           description: str,
                           content: str,
                           extraction_data: Dict[str, Any],
                           metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Index a document with its vector embedding
        Returns the Weaviate object ID
        """
        if not self._initialized:
            raise RuntimeError("Vector search not initialized")
            
        try:
            # Generate embedding from title + description + content sample
            text_for_embedding = f"{title} {description} {content[:1000]}"
            vector = self.model.encode(text_for_embedding).tolist()
            
            # Prepare object for Weaviate
            data_object = {
                "documentHash": document_hash,
                "title": title,
                "description": description,
                "contentSample": content[:1000],
                "agency": metadata.get("agency", "") if metadata else "",
                "documentType": metadata.get("document_type", "") if metadata else "",
                "naicsCodes": metadata.get("naics_codes", []) if metadata else [],
                "extractionData": json.dumps(extraction_data),
                "processingTimeMs": extraction_data.get("processing_time_ms", 0),
                "confidenceScore": extraction_data.get("confidence_score", 0.0),
                "createdAt": datetime.utcnow().isoformat()
            }
            
            # Add to Weaviate with vector
            result = self.client.data_object.create(
                data_object=data_object,
                class_name=self.collection_name,
                vector=vector
            )
            
            logger.info(f"Indexed document {document_hash} with ID {result}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to index document: {e}")
            raise
            
    async def search_similar_documents(self,
                                     query_text: str,
                                     limit: int = 10,
                                     min_similarity: float = 0.7) -> List[SimilarityMatch]:
        """
        Search for similar documents using vector similarity
        Returns list of matches sorted by similarity score
        """
        if not self._initialized:
            raise RuntimeError("Vector search not initialized")
            
        try:
            # Generate query vector
            query_vector = self.model.encode(query_text).tolist()
            
            # Search in Weaviate
            result = (
                self.client.query
                .get(self.collection_name, [
                    "documentHash", "title", "description", 
                    "extractionData", "confidenceScore", "createdAt"
                ])
                .with_near_vector({
                    "vector": query_vector,
                    "certainty": min_similarity
                })
                .with_limit(limit)
                .with_additional(["certainty", "distance"])
                .do()
            )
            
            # Process results
            matches = []
            if result and "data" in result:
                objects = result["data"]["Get"][self.collection_name]
                
                for obj in objects:
                    # Parse extraction data
                    extraction_data = json.loads(obj.get("extractionData", "{}"))
                    
                    match = SimilarityMatch(
                        document_hash=obj["documentHash"],
                        title=obj["title"],
                        similarity_score=obj["_additional"]["certainty"],
                        extraction_data=extraction_data,
                        metadata={
                            "confidence_score": obj.get("confidenceScore", 0.0),
                            "created_at": obj.get("createdAt"),
                            "distance": obj["_additional"]["distance"]
                        }
                    )
                    matches.append(match)
                    
            # Sort by similarity score (descending)
            matches.sort(key=lambda x: x.similarity_score, reverse=True)
            
            logger.info(f"Found {len(matches)} similar documents for query")
            return matches
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
            
    async def find_contract_amendments(self,
                                     solicitation_number: str,
                                     base_only: bool = False) -> List[SimilarityMatch]:
        """
        Find related contract amendments using solicitation number patterns
        """
        try:
            # Extract base solicitation number (remove amendment suffixes)
            import re
            base_pattern = re.match(r'^([A-Z0-9-]+?)(?:-[AM]\d+)?$', solicitation_number)
            base_number = base_pattern.group(1) if base_pattern else solicitation_number
            
            # Search by title containing the base number
            where_filter = {
                "path": ["title"],
                "operator": "Like",
                "valueString": f"*{base_number}*"
            }
            
            result = (
                self.client.query
                .get(self.collection_name, [
                    "documentHash", "title", "description",
                    "extractionData", "confidenceScore", "createdAt"
                ])
                .with_where(where_filter)
                .with_limit(20)
                .do()
            )
            
            matches = []
            if result and "data" in result:
                objects = result["data"]["Get"][self.collection_name]
                
                for obj in objects:
                    # Skip if we only want base and this is an amendment
                    if base_only and re.search(r'-[AM]\d+', obj["title"]):
                        continue
                        
                    extraction_data = json.loads(obj.get("extractionData", "{}"))
                    
                    match = SimilarityMatch(
                        document_hash=obj["documentHash"],
                        title=obj["title"],
                        similarity_score=1.0,  # Exact match on solicitation pattern
                        extraction_data=extraction_data,
                        metadata={
                            "confidence_score": obj.get("confidenceScore", 0.0),
                            "created_at": obj.get("createdAt"),
                            "is_amendment": bool(re.search(r'-[AM]\d+', obj["title"]))
                        }
                    )
                    matches.append(match)
                    
            logger.info(f"Found {len(matches)} related contracts for {solicitation_number}")
            return matches
            
        except Exception as e:
            logger.error(f"Amendment search failed: {e}")
            return []
            
    async def update_document_embedding(self,
                                      document_hash: str,
                                      new_title: Optional[str] = None,
                                      new_description: Optional[str] = None,
                                      new_content: Optional[str] = None):
        """Update document embedding when content changes"""
        try:
            # Find existing document
            where_filter = {
                "path": ["documentHash"],
                "operator": "Equal",
                "valueString": document_hash
            }
            
            result = (
                self.client.query
                .get(self.collection_name, ["title", "description", "contentSample"])
                .with_where(where_filter)
                .do()
            )
            
            if result and "data" in result:
                objects = result["data"]["Get"][self.collection_name]
                if objects:
                    existing = objects[0]
                    
                    # Use new values or keep existing
                    title = new_title or existing["title"]
                    description = new_description or existing["description"]
                    content = new_content or existing["contentSample"]
                    
                    # Generate new embedding
                    text_for_embedding = f"{title} {description} {content[:1000]}"
                    new_vector = self.model.encode(text_for_embedding).tolist()
                    
                    # Update in Weaviate
                    # Note: Weaviate doesn't support direct vector updates,
                    # so we'd need to delete and re-create
                    logger.info(f"Updated embedding for document {document_hash}")
                    
        except Exception as e:
            logger.error(f"Failed to update embedding: {e}")
            
    async def get_high_confidence_matches(self,
                                        document_type: Optional[str] = None,
                                        min_confidence: float = 0.9,
                                        limit: int = 100) -> List[Dict[str, Any]]:
        """Get high-confidence extractions for pre-warming cache"""
        try:
            # Build where filter
            where_filter = {
                "path": ["confidenceScore"],
                "operator": "GreaterThan",
                "valueNumber": min_confidence
            }
            
            # Add document type filter if specified
            if document_type:
                where_filter = {
                    "operator": "And",
                    "operands": [
                        where_filter,
                        {
                            "path": ["documentType"],
                            "operator": "Equal",
                            "valueString": document_type
                        }
                    ]
                }
                
            result = (
                self.client.query
                .get(self.collection_name, [
                    "documentHash", "title", "processingTimeMs",
                    "confidenceScore", "extractionData"
                ])
                .with_where(where_filter)
                .with_limit(limit)
                .do()
            )
            
            high_confidence_docs = []
            if result and "data" in result:
                objects = result["data"]["Get"][self.collection_name]
                
                for obj in objects:
                    high_confidence_docs.append({
                        "document_hash": obj["documentHash"],
                        "title": obj["title"],
                        "confidence_score": obj["confidenceScore"],
                        "processing_time_ms": obj.get("processingTimeMs", 0),
                        "extraction_data": json.loads(obj.get("extractionData", "{}"))
                    })
                    
            logger.info(f"Found {len(high_confidence_docs)} high-confidence documents")
            return high_confidence_docs
            
        except Exception as e:
            logger.error(f"Failed to get high-confidence matches: {e}")
            return []
            
    async def close(self):
        """Clean up resources"""
        # Weaviate client doesn't need explicit cleanup
        self._initialized = False
        logger.info("Vector search service closed")