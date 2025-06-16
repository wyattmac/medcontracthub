"""
Data models for OCR Service
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ProcessingOptions(BaseModel):
    """Options for document processing"""
    extract_tables: bool = True
    extract_images: bool = False
    extract_requirements: bool = True
    language: str = "en"
    dpi: int = 300
    enhance_quality: bool = True
    check_community: bool = True
    share_to_community: bool = False
    minimum_confidence: float = 0.75


class OCRRequest(BaseModel):
    """Request model for OCR processing"""
    document_url: str = Field(..., description="URL of the document to process")
    model: str = Field(default="pixtral-12b-latest", description="OCR model to use")
    options: Optional[ProcessingOptions] = None


class PageContent(BaseModel):
    """Content extracted from a single page"""
    page_number: int
    text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    word_count: int
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OCRMetadata(BaseModel):
    """Metadata about the OCR processing"""
    model: str
    model_version: Optional[str] = None
    processing_time: float
    pages_processed: int
    total_words: int
    average_confidence: float
    language: str = "en"


class OCRResponse(BaseModel):
    """Response model for OCR processing"""
    document_id: Optional[str] = None
    status: str = "completed"
    pages: List[PageContent]
    full_text: str
    metadata: OCRMetadata
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    requirements: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    community_match: Optional['CommunityMatch'] = None
    
class CommunityMatch(BaseModel):
    """Information about a matched community extraction"""
    extraction_id: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    usage_count: int
    time_saved_ms: int
    api_cost_saved: float

class CommunitySearchRequest(BaseModel):
    """Request model for searching community extractions"""
    text_sample: str = Field(..., min_length=50, description="Sample text to search for similar documents")
    document_type: Optional[str] = None
    similarity_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=50)

class CommunityContributionRequest(BaseModel):
    """Request model for contributing an extraction to the community"""
    document_id: str
    confirm_anonymized: bool = Field(..., description="User confirms data has been reviewed and is safe to share")
    
class CommunityStats(BaseModel):
    """Statistics about community OCR sharing"""
    unique_documents: int
    total_extractions: int
    average_usage_per_extraction: float
    total_uses: int
    document_types: int
    total_reuses: int
    time_saved_hours: float
    cost_saved: float
    deduplication_rate: float


class HealthCheck(BaseModel):
    """Health check response model"""
    status: str
    service: str
    version: str
    checks: Dict[str, bool]
    environment: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)