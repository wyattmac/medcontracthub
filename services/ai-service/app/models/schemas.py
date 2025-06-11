"""
Event Schemas for AI Processing
Defines data models for Kafka events and API requests/responses
"""
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator
from enum import Enum


# Enums
class DocumentType(str, Enum):
    """Document types"""
    RFP = "rfp"
    SOW = "sow"
    ATTACHMENT = "attachment"
    AMENDMENT = "amendment"
    NOTICE = "notice"
    OTHER = "other"


class RequirementCategory(str, Enum):
    """Requirement categories"""
    TECHNICAL = "technical"
    FUNCTIONAL = "functional"
    PERFORMANCE = "performance"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    DELIVERY = "delivery"
    PRICING = "pricing"
    GENERAL = "general"


class RequirementPriority(str, Enum):
    """Requirement priority levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ProposalStatus(str, Enum):
    """Proposal status"""
    DRAFT = "draft"
    GENERATED = "generated"
    REVIEWED = "reviewed"
    SUBMITTED = "submitted"
    WON = "won"
    LOST = "lost"


# Event Schemas
class DocumentProcessedEvent(BaseModel):
    """Event when a document has been processed"""
    document_id: str = Field(..., description="Unique document identifier")
    opportunity_id: str = Field(..., description="Associated opportunity ID")
    content: str = Field(..., description="Processed document content")
    document_type: DocumentType = Field(..., description="Type of document")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RequirementExtracted(BaseModel):
    """Single extracted requirement"""
    id: str = Field(..., description="Unique requirement ID")
    content: str = Field(..., description="Requirement text")
    category: RequirementCategory = Field(default=RequirementCategory.GENERAL)
    priority: RequirementPriority = Field(default=RequirementPriority.MEDIUM)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source_section: Optional[str] = Field(None, description="Source document section")


class RequirementsExtractedEvent(BaseModel):
    """Event when requirements have been extracted"""
    document_id: str = Field(..., description="Source document ID")
    opportunity_id: str = Field(..., description="Associated opportunity ID")
    requirements: List[RequirementExtracted] = Field(..., description="Extracted requirements")
    total_requirements: int = Field(..., description="Total number of requirements")
    extraction_model: str = Field(..., description="Model used for extraction")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('total_requirements', always=True)
    def set_total_requirements(cls, v, values):
        return len(values.get('requirements', []))


class ProposalRequestedEvent(BaseModel):
    """Event to request proposal generation"""
    opportunity_id: str = Field(..., description="Opportunity ID")
    user_id: str = Field(..., description="Requesting user ID")
    requirements: List[RequirementExtracted] = Field(..., description="Requirements to address")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="User preferences")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ProposalGeneratedEvent(BaseModel):
    """Event when a proposal has been generated"""
    proposal_id: str = Field(..., description="Unique proposal ID")
    opportunity_id: str = Field(..., description="Associated opportunity ID")
    user_id: str = Field(..., description="User who requested the proposal")
    content: str = Field(..., description="Generated proposal content")
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    model_used: str = Field(..., description="AI model used")
    status: ProposalStatus = Field(default=ProposalStatus.GENERATED)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# API Request/Response Models
class EmbeddingRequest(BaseModel):
    """Request to generate embeddings"""
    texts: Union[str, List[str]] = Field(..., description="Text(s) to embed")
    model: Optional[str] = Field(None, description="Embedding model to use")
    batch_size: Optional[int] = Field(None, description="Batch size for processing")


class EmbeddingResponse(BaseModel):
    """Response with generated embeddings"""
    embeddings: Union[List[float], List[List[float]]] = Field(..., description="Generated embeddings")
    model: str = Field(..., description="Model used")
    dimension: int = Field(..., description="Embedding dimension")
    processing_time: float = Field(..., description="Processing time in seconds")


class InferenceRequest(BaseModel):
    """Request for AI inference"""
    prompt: str = Field(..., description="Input prompt")
    model: Optional[str] = Field(None, description="Model to use")
    max_tokens: Optional[int] = Field(None, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    system_prompt: Optional[str] = Field(None, description="System prompt")
    stream: bool = Field(default=False, description="Stream response")
    
    # Advanced options
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    frequency_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    stop_sequences: Optional[List[str]] = Field(None)


class InferenceResponse(BaseModel):
    """Response from AI inference"""
    content: str = Field(..., description="Generated content")
    model: str = Field(..., description="Model used")
    usage: Dict[str, int] = Field(..., description="Token usage statistics")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    processing_time: float = Field(..., description="Processing time in seconds")


class SearchRequest(BaseModel):
    """Request for vector search"""
    query: Union[str, List[float]] = Field(..., description="Query text or embedding")
    class_name: str = Field(..., description="Weaviate class to search")
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    include_embeddings: bool = Field(default=False)
    hybrid: bool = Field(default=False, description="Use hybrid search")
    alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="Hybrid search balance")


class SearchResult(BaseModel):
    """Single search result"""
    id: str = Field(..., description="Result ID")
    score: float = Field(..., description="Relevance score")
    data: Dict[str, Any] = Field(..., description="Result data")
    embedding: Optional[List[float]] = Field(None, description="Result embedding")


class SearchResponse(BaseModel):
    """Response from vector search"""
    results: List[SearchResult] = Field(..., description="Search results")
    total: int = Field(..., description="Total matching results")
    query_embedding: Optional[List[float]] = Field(None)
    processing_time: float = Field(..., description="Processing time in seconds")


class HealthStatus(BaseModel):
    """Service health status"""
    status: str = Field(..., description="Health status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(..., description="Service version")
    services: Dict[str, bool] = Field(..., description="Sub-service statuses")
    metrics: Optional[Dict[str, Any]] = Field(None, description="Performance metrics")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)