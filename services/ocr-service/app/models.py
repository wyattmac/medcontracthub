"""
Pydantic models for OCR service
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class OCRModel(str, Enum):
    PIXTRAL_12B = "pixtral-12b-latest"
    TESSERACT_5 = "tesseract-5"
    LAYOUTLM_V3 = "layoutlm-v3"

class ProcessingOptions(BaseModel):
    include_images: bool = Field(default=True, description="Extract embedded images")
    include_tables: bool = Field(default=True, description="Extract table structures")
    max_pages: Optional[int] = Field(default=None, description="Maximum pages to process")
    structured_output: bool = Field(default=False, description="Return structured data")
    language: str = Field(default="en", description="Document language")

class OCRRequest(BaseModel):
    document_url: HttpUrl = Field(..., description="URL of the document to process")
    model: OCRModel = Field(default=OCRModel.PIXTRAL_12B, description="OCR model to use")
    options: Optional[ProcessingOptions] = None
    webhook_url: Optional[HttpUrl] = Field(default=None, description="Webhook for async processing")

class ImageInfo(BaseModel):
    id: str
    base64: Optional[str] = None
    bbox: Dict[str, float] = Field(..., description="Bounding box coordinates")

class TableInfo(BaseModel):
    id: str
    rows: List[List[str]]
    bbox: Dict[str, float]
    confidence: Optional[float] = None

class OCRPage(BaseModel):
    page_number: int = Field(..., alias="pageNumber")
    text: str
    images: List[ImageInfo] = []
    tables: List[TableInfo] = []
    confidence: Optional[float] = None

class OCRMetadata(BaseModel):
    page_count: int = Field(..., alias="pageCount")
    total_images: int = Field(..., alias="totalImages")
    total_tables: int = Field(..., alias="totalTables")
    processing_time_ms: float = Field(..., alias="processingTimeMs")
    model: str
    cost: Optional[float] = None

class StructuredData(BaseModel):
    products: Optional[List[Dict[str, Any]]] = None
    delivery_requirements: Optional[str] = Field(None, alias="deliveryRequirements")
    compliance_requirements: Optional[List[str]] = Field(None, alias="complianceRequirements")
    special_instructions: Optional[str] = Field(None, alias="specialInstructions")

class OCRResponse(BaseModel):
    pages: List[OCRPage]
    metadata: OCRMetadata
    structured_data: Optional[StructuredData] = Field(None, alias="structuredData")
    request_id: Optional[str] = Field(None, alias="requestId")
    
class HealthCheck(BaseModel):
    status: str
    service: str
    version: str
    checks: Dict[str, bool]
    environment: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ErrorResponse(BaseModel):
    error: str
    status_code: int
    service: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None

class AnalysisRequest(BaseModel):
    text: str
    analysis_type: str = Field(default="requirements", description="Type of analysis to perform")
    options: Optional[Dict[str, Any]] = None

class AnalysisResponse(BaseModel):
    analysis_type: str
    structured_data: Dict[str, Any]
    model: str
    confidence: Optional[float] = None