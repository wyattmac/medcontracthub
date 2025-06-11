"""
Event schemas for OCR Service
Defines Kafka event structures for document processing
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class ProcessingStatus(str, Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class DocumentSource(str, Enum):
    """Document source types"""
    URL = "url"
    S3 = "s3"
    UPLOAD = "upload"
    SAM_GOV = "sam_gov"


class DocumentType(str, Enum):
    """Document types"""
    PDF = "pdf"
    IMAGE = "image"
    DOCX = "docx"
    TEXT = "text"
    UNKNOWN = "unknown"


# Event Schemas

class DocumentProcessingRequest(BaseModel):
    """Event schema for document processing requests"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.process_request")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Document details
    document_id: str = Field(..., description="Unique document ID")
    document_url: Optional[str] = Field(None, description="URL to download document")
    document_s3_key: Optional[str] = Field(None, description="S3 key for document")
    document_source: DocumentSource = Field(..., description="Source of document")
    document_type: DocumentType = Field(DocumentType.UNKNOWN, description="Type of document")
    
    # Processing options
    ocr_model: str = Field(default="pixtral-12b-latest", description="OCR model to use")
    extract_tables: bool = Field(default=True, description="Extract tables from document")
    extract_requirements: bool = Field(default=True, description="Extract requirements")
    language: str = Field(default="en", description="Document language")
    
    # Context
    opportunity_id: Optional[str] = Field(None, description="Associated opportunity ID")
    user_id: Optional[str] = Field(None, description="User requesting processing")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    
    # Metadata
    priority: int = Field(default=5, ge=1, le=10, description="Processing priority (1-10)")
    callback_url: Optional[str] = Field(None, description="Webhook URL for results")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentProcessingStarted(BaseModel):
    """Event when document processing starts"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.processing_started")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    document_id: str = Field(..., description="Document being processed")
    processor_id: str = Field(..., description="ID of processor handling document")
    estimated_duration_seconds: Optional[int] = Field(None, description="Estimated processing time")


class DocumentProcessingProgress(BaseModel):
    """Event for processing progress updates"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.processing_progress")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    document_id: str = Field(..., description="Document being processed")
    progress_percentage: int = Field(..., ge=0, le=100, description="Progress percentage")
    current_step: str = Field(..., description="Current processing step")
    pages_processed: Optional[int] = Field(None, description="Number of pages processed")
    total_pages: Optional[int] = Field(None, description="Total number of pages")


class ExtractedText(BaseModel):
    """Extracted text from a page"""
    page_number: int
    text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    word_count: int
    language: str


class ExtractedTable(BaseModel):
    """Extracted table data"""
    page_number: int
    table_index: int
    headers: List[str]
    rows: List[List[str]]
    confidence: float = Field(..., ge=0.0, le=1.0)


class ExtractedRequirement(BaseModel):
    """Extracted requirement"""
    text: str
    category: str
    page_number: int
    confidence: float = Field(..., ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentProcessingCompleted(BaseModel):
    """Event when document processing completes successfully"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.processing_completed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Document info
    document_id: str = Field(..., description="Processed document ID")
    document_url: Optional[str] = Field(None, description="Original document URL")
    
    # Processing results
    status: ProcessingStatus = Field(ProcessingStatus.COMPLETED)
    processing_duration_seconds: float = Field(..., description="Total processing time")
    
    # Extracted data
    total_pages: int = Field(..., description="Total number of pages")
    total_words: int = Field(..., description="Total word count")
    extracted_text: List[ExtractedText] = Field(default_factory=list)
    extracted_tables: List[ExtractedTable] = Field(default_factory=list)
    extracted_requirements: List[ExtractedRequirement] = Field(default_factory=list)
    
    # Storage
    result_s3_key: Optional[str] = Field(None, description="S3 key for full results")
    result_cache_key: str = Field(..., description="Redis cache key for results")
    cache_ttl_seconds: int = Field(default=3600, description="Cache TTL")
    
    # Metadata
    ocr_model: str = Field(..., description="OCR model used")
    processing_metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Context
    opportunity_id: Optional[str] = Field(None)
    user_id: Optional[str] = Field(None)
    organization_id: Optional[str] = Field(None)


class DocumentProcessingFailed(BaseModel):
    """Event when document processing fails"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.processing_failed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Document info
    document_id: str = Field(..., description="Document that failed")
    document_url: Optional[str] = Field(None)
    
    # Error details
    status: ProcessingStatus = Field(ProcessingStatus.FAILED)
    error_code: str = Field(..., description="Error code")
    error_message: str = Field(..., description="Error message")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
    # Retry info
    retry_count: int = Field(default=0, description="Number of retries attempted")
    max_retries: int = Field(default=3, description="Maximum retries allowed")
    will_retry: bool = Field(default=True, description="Whether retry will be attempted")
    next_retry_at: Optional[datetime] = Field(None, description="Next retry timestamp")
    
    # Context
    ocr_model: str = Field(..., description="OCR model attempted")
    processing_step: Optional[str] = Field(None, description="Step where failure occurred")
    opportunity_id: Optional[str] = Field(None)
    user_id: Optional[str] = Field(None)


class DocumentProcessingRetrying(BaseModel):
    """Event when retrying document processing"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.processing_retrying")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    document_id: str = Field(..., description="Document being retried")
    retry_attempt: int = Field(..., description="Current retry attempt number")
    previous_error: str = Field(..., description="Previous error message")
    retry_delay_seconds: int = Field(..., description="Delay before retry")


# Status Query/Response Events

class DocumentStatusRequest(BaseModel):
    """Request for document processing status"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.status_request")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    document_id: str = Field(..., description="Document to check status")
    request_id: str = Field(..., description="ID for correlating response")


class DocumentStatusResponse(BaseModel):
    """Response with document processing status"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.status_response")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    request_id: str = Field(..., description="Original request ID")
    document_id: str = Field(..., description="Document ID")
    status: ProcessingStatus = Field(..., description="Current status")
    progress_percentage: Optional[int] = Field(None, description="Progress if processing")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    result_available: bool = Field(default=False, description="Whether results are ready")
    result_cache_key: Optional[str] = Field(None, description="Cache key if available")
    error_message: Optional[str] = Field(None, description="Error if failed")


# Batch Processing Events

class DocumentBatchRequest(BaseModel):
    """Request to process multiple documents"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.batch_request")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    batch_id: str = Field(..., description="Unique batch ID")
    documents: List[DocumentProcessingRequest] = Field(..., description="Documents to process")
    priority: int = Field(default=5, ge=1, le=10, description="Batch priority")
    parallel_processing: bool = Field(default=True, description="Process documents in parallel")


class DocumentBatchCompleted(BaseModel):
    """Event when batch processing completes"""
    event_id: str = Field(..., description="Unique event ID")
    event_type: str = Field(default="contracts.document.batch_completed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    batch_id: str = Field(..., description="Batch ID")
    total_documents: int = Field(..., description="Total documents in batch")
    successful_documents: int = Field(..., description="Successfully processed documents")
    failed_documents: int = Field(..., description="Failed documents")
    processing_duration_seconds: float = Field(..., description="Total batch processing time")
    document_results: Dict[str, ProcessingStatus] = Field(..., description="Status by document ID")