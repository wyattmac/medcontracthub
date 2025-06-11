"""
Kafka Event Consumer for OCR Service
Handles document processing requests from Kafka topics
"""

import asyncio
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import structlog
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError
import hashlib
import traceback

from app.config import settings
from app.models.events import (
    DocumentProcessingRequest,
    DocumentProcessingStarted,
    DocumentProcessingProgress,
    DocumentProcessingCompleted,
    DocumentProcessingFailed,
    DocumentProcessingRetrying,
    ProcessingStatus,
    DocumentSource
)
from app.services.ocr_service import OCRService
from app.services.cache_service import CacheService
from app.services.kafka_producer import KafkaProducer
from app.utils.circuit_breaker import CircuitBreaker

logger = structlog.get_logger()


class EventConsumer:
    """Kafka event consumer for document processing"""
    
    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.producer: Optional[AIOKafkaProducer] = None
        self.ocr_service = OCRService()
        self.cache_service = CacheService()
        self.kafka_producer = KafkaProducer()
        self.circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)
        
        self.topics = [
            "contracts.document.process_request",
            "contracts.attachment.process_request",
            "contracts.document.batch_request"
        ]
        
        self.processing_tasks: Dict[str, asyncio.Task] = {}
        self.is_running = False
        self.processor_id = f"ocr-processor-{settings.HOSTNAME}"
        
    async def start(self):
        """Start the event consumer"""
        try:
            logger.info("Starting OCR event consumer", 
                       topics=self.topics,
                       processor_id=self.processor_id)
            
            # Initialize consumer
            self.consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id="ocr-service-consumer-group",
                client_id=self.processor_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                auto_commit_interval_ms=5000,
                max_poll_records=10,
                session_timeout_ms=30000,
                heartbeat_interval_ms=3000,
                connections_max_idle_ms=300000,
                retry_backoff_ms=100,
                request_timeout_ms=30000,
            )
            
            # Initialize producer for status events
            self.producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                client_id=f"{self.processor_id}-producer",
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                compression_type='snappy',
                acks='all',
                retries=5,
                max_in_flight_requests_per_connection=5,
                request_timeout_ms=30000,
            )
            
            await self.consumer.start()
            await self.producer.start()
            await self.cache_service.connect()
            
            self.is_running = True
            
            # Start consuming events
            await self.consume_events()
            
        except Exception as e:
            logger.error("Failed to start event consumer", error=str(e))
            raise
            
    async def stop(self):
        """Stop the event consumer gracefully"""
        logger.info("Stopping OCR event consumer")
        self.is_running = False
        
        # Cancel all processing tasks
        for task_id, task in self.processing_tasks.items():
            if not task.done():
                logger.info(f"Cancelling processing task {task_id}")
                task.cancel()
                
        # Wait for tasks to complete
        if self.processing_tasks:
            await asyncio.gather(*self.processing_tasks.values(), return_exceptions=True)
            
        # Close connections
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        await self.cache_service.close()
        
        logger.info("OCR event consumer stopped")
        
    async def consume_events(self):
        """Main event consumption loop"""
        async for msg in self.consumer:
            if not self.is_running:
                break
                
            try:
                event_data = msg.value
                topic = msg.topic
                
                logger.info("Received event", 
                           topic=topic,
                           event_type=event_data.get('event_type'),
                           document_id=event_data.get('document_id'))
                
                # Route event to appropriate handler
                if topic == "contracts.document.process_request":
                    await self.handle_processing_request(event_data)
                elif topic == "contracts.attachment.process_request":
                    await self.handle_attachment_request(event_data)
                elif topic == "contracts.document.batch_request":
                    await self.handle_batch_request(event_data)
                    
            except Exception as e:
                logger.error("Error processing event", 
                            error=str(e),
                            topic=msg.topic,
                            traceback=traceback.format_exc())
                
                # Send to DLQ
                await self.send_to_dlq(msg, str(e))
                
    async def handle_processing_request(self, event_data: Dict[str, Any]):
        """Handle document processing request"""
        try:
            # Parse event
            request = DocumentProcessingRequest(**event_data)
            
            # Check if already processing
            if request.document_id in self.processing_tasks:
                logger.warn("Document already being processed", 
                           document_id=request.document_id)
                return
                
            # Create processing task
            task = asyncio.create_task(
                self.process_document(request)
            )
            self.processing_tasks[request.document_id] = task
            
            # Clean up completed tasks
            self.cleanup_completed_tasks()
            
        except Exception as e:
            logger.error("Failed to handle processing request", 
                        error=str(e),
                        event_data=event_data)
            
    async def process_document(self, request: DocumentProcessingRequest):
        """Process a single document"""
        start_time = datetime.utcnow()
        
        try:
            # Send processing started event
            await self.send_event(DocumentProcessingStarted(
                event_id=f"{request.document_id}-started-{start_time.timestamp()}",
                document_id=request.document_id,
                processor_id=self.processor_id,
                estimated_duration_seconds=60  # Default estimate
            ))
            
            # Update status in cache
            await self.update_processing_status(
                request.document_id,
                ProcessingStatus.PROCESSING,
                progress=0
            )
            
            # Download document if needed
            document_content = await self.get_document_content(request)
            
            # Process with OCR
            result = await self.circuit_breaker.call(
                self.ocr_service.process_document_buffer,
                document_content,
                filename=f"doc-{request.document_id}",
                model=request.ocr_model
            )
            
            # Extract additional data if requested
            if request.extract_requirements:
                requirements = await self.extract_requirements(result)
            else:
                requirements = []
                
            # Calculate processing duration
            processing_duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Store results in cache
            cache_key = f"ocr:result:{request.document_id}"
            await self.cache_service.set(cache_key, result, ttl=3600)
            
            # Send completion event
            await self.send_event(DocumentProcessingCompleted(
                event_id=f"{request.document_id}-completed-{datetime.utcnow().timestamp()}",
                document_id=request.document_id,
                document_url=request.document_url,
                status=ProcessingStatus.COMPLETED,
                processing_duration_seconds=processing_duration,
                total_pages=len(result.get("pages", [])),
                total_words=sum(p.get("word_count", 0) for p in result.get("pages", [])),
                extracted_text=[{
                    "page_number": i + 1,
                    "text": page.get("text", ""),
                    "confidence": page.get("confidence", 0.0),
                    "word_count": page.get("word_count", 0),
                    "language": page.get("language", "en")
                } for i, page in enumerate(result.get("pages", []))],
                extracted_tables=result.get("tables", []),
                extracted_requirements=requirements,
                result_cache_key=cache_key,
                cache_ttl_seconds=3600,
                ocr_model=request.ocr_model,
                processing_metadata={
                    "processor_id": self.processor_id,
                    "processing_time": processing_duration,
                    "model_version": result.get("metadata", {}).get("model_version")
                },
                opportunity_id=request.opportunity_id,
                user_id=request.user_id,
                organization_id=request.organization_id
            ))
            
            # Update status to completed
            await self.update_processing_status(
                request.document_id,
                ProcessingStatus.COMPLETED,
                progress=100,
                result_cache_key=cache_key
            )
            
            # Call webhook if provided
            if request.callback_url:
                await self.send_webhook(request.callback_url, {
                    "document_id": request.document_id,
                    "status": "completed",
                    "cache_key": cache_key
                })
                
            logger.info("Document processed successfully",
                       document_id=request.document_id,
                       duration=processing_duration,
                       pages=len(result.get("pages", [])))
                       
        except Exception as e:
            # Handle processing failure
            await self.handle_processing_failure(request, e)
            
        finally:
            # Remove from processing tasks
            self.processing_tasks.pop(request.document_id, None)
            
    async def handle_processing_failure(self, request: DocumentProcessingRequest, error: Exception):
        """Handle document processing failure"""
        error_message = str(error)
        error_code = type(error).__name__
        
        # Get retry count from cache
        retry_key = f"ocr:retry:{request.document_id}"
        retry_count = await self.cache_service.get(retry_key) or 0
        
        # Determine if we should retry
        max_retries = 3
        will_retry = retry_count < max_retries and not isinstance(error, ValueError)
        
        if will_retry:
            # Calculate retry delay with exponential backoff
            retry_delay = min(300, 10 * (2 ** retry_count))  # Max 5 minutes
            next_retry_at = datetime.utcnow() + timedelta(seconds=retry_delay)
            
            # Update retry count
            await self.cache_service.set(retry_key, retry_count + 1, ttl=3600)
            
            # Send retry event
            await self.send_event(DocumentProcessingRetrying(
                event_id=f"{request.document_id}-retry-{datetime.utcnow().timestamp()}",
                document_id=request.document_id,
                retry_attempt=retry_count + 1,
                previous_error=error_message,
                retry_delay_seconds=retry_delay
            ))
            
            # Schedule retry
            await asyncio.sleep(retry_delay)
            await self.handle_processing_request(request.dict())
            
        else:
            # Send failure event
            await self.send_event(DocumentProcessingFailed(
                event_id=f"{request.document_id}-failed-{datetime.utcnow().timestamp()}",
                document_id=request.document_id,
                document_url=request.document_url,
                status=ProcessingStatus.FAILED,
                error_code=error_code,
                error_message=error_message,
                error_details={
                    "traceback": traceback.format_exc(),
                    "processor_id": self.processor_id
                },
                retry_count=retry_count,
                max_retries=max_retries,
                will_retry=False,
                ocr_model=request.ocr_model,
                opportunity_id=request.opportunity_id,
                user_id=request.user_id
            ))
            
            # Update status to failed
            await self.update_processing_status(
                request.document_id,
                ProcessingStatus.FAILED,
                error=error_message
            )
            
            # Call webhook if provided
            if request.callback_url:
                await self.send_webhook(request.callback_url, {
                    "document_id": request.document_id,
                    "status": "failed",
                    "error": error_message
                })
                
        logger.error("Document processing failed",
                    document_id=request.document_id,
                    error=error_message,
                    will_retry=will_retry,
                    retry_count=retry_count)
                    
    async def get_document_content(self, request: DocumentProcessingRequest) -> bytes:
        """Get document content from URL or S3"""
        if request.document_source == DocumentSource.URL and request.document_url:
            # Download from URL
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(request.document_url) as resp:
                    if resp.status != 200:
                        raise ValueError(f"Failed to download document: HTTP {resp.status}")
                    return await resp.read()
                    
        elif request.document_source == DocumentSource.S3 and request.document_s3_key:
            # Download from S3
            # Implementation depends on S3 client setup
            raise NotImplementedError("S3 download not implemented yet")
            
        else:
            raise ValueError("No valid document source provided")
            
    async def extract_requirements(self, ocr_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract requirements from OCR result"""
        try:
            # Combine text from all pages
            full_text = "\n".join(
                page.get("text", "") for page in ocr_result.get("pages", [])
            )
            
            # Use OCR service to analyze for requirements
            analysis = await self.ocr_service.analyze_document(
                text=full_text,
                analysis_type="requirements",
                options={"extract_categories": True}
            )
            
            return analysis.get("requirements", [])
            
        except Exception as e:
            logger.error("Failed to extract requirements", error=str(e))
            return []
            
    async def update_processing_status(self, document_id: str, status: ProcessingStatus, 
                                     progress: Optional[int] = None,
                                     error: Optional[str] = None,
                                     result_cache_key: Optional[str] = None):
        """Update document processing status in cache"""
        status_key = f"ocr:status:{document_id}"
        status_data = {
            "document_id": document_id,
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat(),
            "processor_id": self.processor_id
        }
        
        if progress is not None:
            status_data["progress"] = progress
        if error:
            status_data["error"] = error
        if result_cache_key:
            status_data["result_cache_key"] = result_cache_key
            
        await self.cache_service.set(status_key, status_data, ttl=3600)
        
    async def send_event(self, event: Any):
        """Send event to Kafka"""
        topic = event.event_type.replace(".", "-")
        await self.producer.send_and_wait(
            topic,
            value=event.dict()
        )
        
    async def send_webhook(self, url: str, data: Dict[str, Any]):
        """Send webhook notification"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=data, timeout=10) as resp:
                    if resp.status >= 400:
                        logger.warn("Webhook failed", url=url, status=resp.status)
        except Exception as e:
            logger.error("Failed to send webhook", url=url, error=str(e))
            
    async def send_to_dlq(self, msg: Any, error: str):
        """Send failed message to dead letter queue"""
        dlq_topic = f"{msg.topic}.dlq"
        try:
            await self.producer.send_and_wait(
                dlq_topic,
                value={
                    "original_topic": msg.topic,
                    "original_value": msg.value,
                    "error": error,
                    "timestamp": datetime.utcnow().isoformat(),
                    "processor_id": self.processor_id
                }
            )
        except Exception as e:
            logger.error("Failed to send to DLQ", error=str(e))
            
    def cleanup_completed_tasks(self):
        """Remove completed tasks from tracking"""
        completed = [
            doc_id for doc_id, task in self.processing_tasks.items()
            if task.done()
        ]
        for doc_id in completed:
            del self.processing_tasks[doc_id]
            
    async def handle_attachment_request(self, event_data: Dict[str, Any]):
        """Handle SAM.gov attachment processing request"""
        # Similar to document processing but with attachment-specific logic
        await self.handle_processing_request(event_data)
        
    async def handle_batch_request(self, event_data: Dict[str, Any]):
        """Handle batch processing request"""
        batch_id = event_data.get("batch_id")
        documents = event_data.get("documents", [])
        
        logger.info("Processing document batch", 
                   batch_id=batch_id,
                   document_count=len(documents))
                   
        # Process documents in parallel or sequentially based on config
        if event_data.get("parallel_processing", True):
            tasks = [
                self.handle_processing_request(doc)
                for doc in documents
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
        else:
            for doc in documents:
                await self.handle_processing_request(doc)