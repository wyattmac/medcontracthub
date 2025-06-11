"""
OCR Service - Core document processing logic
Adapted from the monolithic app's Mistral OCR client
"""

from mistralai import Mistral
import structlog
import httpx
import base64
from typing import Optional, Dict, Any, List
import asyncio
from datetime import datetime
import numpy as np
from PIL import Image
import io
import pytesseract
import pypdf
import pdf2image
import os

logger = structlog.get_logger()

class OCRService:
    def __init__(self):
        self.mistral_client = None
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
    def _get_mistral_client(self) -> Mistral:
        """Lazy load Mistral client"""
        if not self.mistral_client:
            api_key = os.environ.get('MISTRAL_API_KEY')
            if not api_key:
                raise ValueError("MISTRAL_API_KEY not configured")
            self.mistral_client = Mistral(api_key=api_key)
        return self.mistral_client
    
    async def check_mistral_connection(self) -> bool:
        """Check if Mistral API is accessible"""
        try:
            client = self._get_mistral_client()
            # Simple API call to check connection
            await asyncio.to_thread(
                client.models.list
            )
            return True
        except Exception as e:
            logger.error("Mistral connection check failed", error=str(e))
            return False
    
    async def process_document_url(
        self, 
        document_url: str, 
        model: str = "pixtral-12b-latest",
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process document from URL"""
        try:
            logger.info("Processing document from URL", url=document_url, model=model)
            
            # Download document
            response = await self.http_client.get(document_url)
            response.raise_for_status()
            
            content = response.content
            content_type = response.headers.get('content-type', '')
            
            # Process based on content type
            if 'pdf' in content_type:
                return await self._process_pdf(content, model, options)
            elif 'image' in content_type:
                return await self._process_image(content, model, options)
            else:
                # Try to detect from content
                return await self._process_auto_detect(content, model, options)
                
        except Exception as e:
            logger.error("Document processing failed", error=str(e), url=document_url)
            raise
    
    async def process_document_buffer(
        self,
        content: bytes,
        filename: Optional[str] = None,
        model: str = "pixtral-12b-latest"
    ) -> Dict[str, Any]:
        """Process document from buffer"""
        try:
            # Detect type from filename or content
            if filename and filename.lower().endswith('.pdf'):
                return await self._process_pdf(content, model)
            else:
                return await self._process_auto_detect(content, model)
                
        except Exception as e:
            logger.error("Buffer processing failed", error=str(e))
            raise
    
    async def _process_pdf(
        self, 
        content: bytes, 
        model: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process PDF document"""
        pages_data = []
        start_time = datetime.utcnow()
        
        try:
            # Convert PDF to images
            images = pdf2image.convert_from_bytes(content)
            
            # Process each page
            for i, image in enumerate(images):
                if options and options.get('max_pages') and i >= options['max_pages']:
                    break
                
                # Convert PIL Image to bytes
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format='PNG')
                img_bytes = img_byte_arr.getvalue()
                
                # Process with selected model
                if model.startswith('pixtral'):
                    page_result = await self._process_with_mistral(img_bytes, 'image/png')
                elif model == 'tesseract-5':
                    page_result = await self._process_with_tesseract(image)
                else:
                    page_result = await self._process_with_mistral(img_bytes, 'image/png')
                
                pages_data.append({
                    "pageNumber": i + 1,
                    "text": page_result['text'],
                    "images": page_result.get('images', []),
                    "tables": page_result.get('tables', [])
                })
            
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return {
                "pages": pages_data,
                "metadata": {
                    "pageCount": len(pages_data),
                    "totalImages": sum(len(p.get('images', [])) for p in pages_data),
                    "totalTables": sum(len(p.get('tables', [])) for p in pages_data),
                    "processingTimeMs": processing_time,
                    "model": model
                }
            }
            
        except Exception as e:
            logger.error("PDF processing failed", error=str(e))
            raise
    
    async def _process_image(
        self,
        content: bytes,
        model: str,
        mime_type: str = 'image/jpeg'
    ) -> Dict[str, Any]:
        """Process single image"""
        start_time = datetime.utcnow()
        
        if model.startswith('pixtral'):
            result = await self._process_with_mistral(content, mime_type)
        elif model == 'tesseract-5':
            image = Image.open(io.BytesIO(content))
            result = await self._process_with_tesseract(image)
        else:
            result = await self._process_with_mistral(content, mime_type)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            "pages": [{
                "pageNumber": 1,
                "text": result['text'],
                "images": result.get('images', []),
                "tables": result.get('tables', [])
            }],
            "metadata": {
                "pageCount": 1,
                "totalImages": len(result.get('images', [])),
                "totalTables": len(result.get('tables', [])),
                "processingTimeMs": processing_time,
                "model": model
            }
        }
    
    async def _process_with_mistral(
        self,
        content: bytes,
        mime_type: str
    ) -> Dict[str, Any]:
        """Process with Mistral Pixtral model"""
        try:
            client = self._get_mistral_client()
            base64_content = base64.b64encode(content).decode('utf-8')
            
            # Call Mistral API in thread pool
            response = await asyncio.to_thread(
                client.chat.complete,
                model="pixtral-12b-latest",
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract all text from this document. Include any tables, forms, or structured data. Maintain the original formatting and structure."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_content}"
                            }
                        }
                    ]
                }],
                temperature=0.1,
                max_tokens=8000
            )
            
            text = response.choices[0].message.content
            
            # Extract tables and structure if present
            tables = self._extract_tables_from_text(text)
            
            return {
                "text": text,
                "tables": tables,
                "images": []  # Mistral doesn't extract images
            }
            
        except Exception as e:
            logger.error("Mistral processing failed", error=str(e))
            raise
    
    async def _process_with_tesseract(self, image: Image) -> Dict[str, Any]:
        """Process with Tesseract OCR"""
        try:
            # Run Tesseract in thread pool
            text = await asyncio.to_thread(
                pytesseract.image_to_string,
                image,
                config='--oem 3 --psm 6'
            )
            
            # Get detailed data for table extraction
            data = await asyncio.to_thread(
                pytesseract.image_to_data,
                image,
                output_type=pytesseract.Output.DICT
            )
            
            tables = self._extract_tables_from_tesseract_data(data)
            
            return {
                "text": text,
                "tables": tables,
                "images": []
            }
            
        except Exception as e:
            logger.error("Tesseract processing failed", error=str(e))
            raise
    
    async def _process_auto_detect(
        self,
        content: bytes,
        model: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Auto-detect document type and process"""
        # Try as PDF first
        try:
            return await self._process_pdf(content, model, options)
        except:
            pass
        
        # Try as image
        try:
            return await self._process_image(content, model)
        except Exception as e:
            logger.error("Auto-detection failed", error=str(e))
            raise ValueError("Unable to process document - unsupported format")
    
    def _extract_tables_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract table structures from text"""
        tables = []
        # Simple table detection logic
        lines = text.split('\n')
        current_table = []
        
        for line in lines:
            # Detect table-like structures (multiple columns separated by spaces/tabs)
            if '\t' in line or '  ' in line:
                columns = [col.strip() for col in line.split('\t' if '\t' in line else '  ') if col.strip()]
                if len(columns) > 1:
                    current_table.append(columns)
            elif current_table:
                # End of table
                if len(current_table) > 1:
                    tables.append({
                        "id": f"table_{len(tables) + 1}",
                        "rows": current_table,
                        "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}
                    })
                current_table = []
        
        # Don't forget last table
        if current_table and len(current_table) > 1:
            tables.append({
                "id": f"table_{len(tables) + 1}",
                "rows": current_table,
                "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}
            })
        
        return tables
    
    def _extract_tables_from_tesseract_data(self, data: Dict) -> List[Dict[str, Any]]:
        """Extract tables from Tesseract detailed data"""
        # This is a simplified implementation
        # In production, you'd use more sophisticated table detection
        return []
    
    async def analyze_document(
        self,
        text: str,
        analysis_type: str = "requirements",
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze extracted text for specific information"""
        try:
            client = self._get_mistral_client()
            
            prompts = {
                "requirements": """
                    Analyze this document and extract:
                    1. Product requirements (name, specifications, quantity)
                    2. Delivery requirements
                    3. Compliance requirements
                    4. Special instructions
                    Format as structured JSON.
                """,
                "medical": """
                    Analyze this medical equipment document and extract:
                    1. Device specifications
                    2. FDA/regulatory requirements
                    3. Safety standards
                    4. Maintenance requirements
                    Format as structured JSON.
                """
            }
            
            prompt = prompts.get(analysis_type, prompts["requirements"])
            
            response = await asyncio.to_thread(
                client.chat.complete,
                model="mistral-large-latest",
                messages=[
                    {"role": "system", "content": "You are a document analysis expert. Extract structured information from documents."},
                    {"role": "user", "content": f"{prompt}\n\nDocument:\n{text[:4000]}"}  # Limit text length
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            # Parse response as JSON
            import json
            result_text = response.choices[0].message.content
            
            try:
                # Try to extract JSON from the response
                start = result_text.find('{')
                end = result_text.rfind('}') + 1
                if start >= 0 and end > start:
                    structured_data = json.loads(result_text[start:end])
                else:
                    structured_data = {"raw_analysis": result_text}
            except:
                structured_data = {"raw_analysis": result_text}
            
            return {
                "analysis_type": analysis_type,
                "structured_data": structured_data,
                "model": "mistral-large-latest"
            }
            
        except Exception as e:
            logger.error("Document analysis failed", error=str(e))
            raise

import os