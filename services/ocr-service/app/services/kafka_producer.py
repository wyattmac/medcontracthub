"""
Kafka Producer Service for OCR Microservice
Handles event streaming for document processing events
"""

from aiokafka import AIOKafkaProducer
import json
import structlog
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio

from ..config import settings

logger = structlog.get_logger()

class KafkaProducer:
    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self.connected = False
        self.bootstrap_servers = settings.KAFKA_BOOTSTRAP_SERVERS
        self.topic_prefix = settings.KAFKA_TOPIC_PREFIX
        
    async def start(self):
        """Start Kafka producer"""
        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                compression_type='gzip',
                request_timeout_ms=30000,
                retry_backoff_ms=100,
                metadata_max_age_ms=300000,
                connections_max_idle_ms=540000,
                enable_idempotence=True  # Ensure exactly-once delivery
            )
            
            await self.producer.start()
            self.connected = True
            logger.info("Kafka producer started", bootstrap_servers=self.bootstrap_servers)
            
        except Exception as e:
            logger.error("Failed to start Kafka producer", error=str(e))
            self.connected = False
            # Don't raise - allow service to run without Kafka
    
    async def stop(self):
        """Stop Kafka producer"""
        if self.producer:
            try:
                await self.producer.stop()
                self.connected = False
                logger.info("Kafka producer stopped")
            except Exception as e:
                logger.error("Error stopping Kafka producer", error=str(e))
    
    def is_connected(self) -> bool:
        """Check if producer is connected"""
        return self.connected and self.producer is not None
    
    def _get_topic_name(self, event_type: str) -> str:
        """Generate topic name from event type"""
        # Convert event.type to event-type format
        topic_suffix = event_type.replace('.', '-')
        return f"{self.topic_prefix}-{topic_suffix}"
    
    async def send_event(
        self, 
        event_type: str, 
        payload: Dict[str, Any],
        key: Optional[str] = None
    ) -> bool:
        """Send event to Kafka topic"""
        if not self.is_connected():
            logger.warning("Kafka not connected, skipping event", event_type=event_type)
            return False
        
        topic = self._get_topic_name(event_type)
        
        # Add metadata to event
        event = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "ocr-service",
            "payload": payload
        }
        
        try:
            # Send event
            future = await self.producer.send(
                topic=topic,
                key=key,
                value=event
            )
            
            # Wait for confirmation
            record_metadata = await future
            
            logger.info(
                "Event sent to Kafka",
                event_type=event_type,
                topic=topic,
                partition=record_metadata.partition,
                offset=record_metadata.offset
            )
            
            return True
            
        except Exception as e:
            logger.error(
                "Failed to send event to Kafka",
                event_type=event_type,
                topic=topic,
                error=str(e)
            )
            return False
    
    async def send_batch_events(
        self,
        events: list[tuple[str, Dict[str, Any], Optional[str]]]
    ) -> int:
        """Send multiple events in batch
        
        Args:
            events: List of tuples (event_type, payload, key)
            
        Returns:
            Number of successfully sent events
        """
        if not self.is_connected():
            logger.warning("Kafka not connected, skipping batch events")
            return 0
        
        success_count = 0
        
        # Create batch of produce requests
        batch = self.producer.create_batch()
        
        for event_type, payload, key in events:
            topic = self._get_topic_name(event_type)
            
            event = {
                "event_type": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "service": "ocr-service",
                "payload": payload
            }
            
            try:
                metadata = batch.append(
                    key=key.encode('utf-8') if key else None,
                    value=json.dumps(event).encode('utf-8'),
                    timestamp=None
                )
                
                if metadata is None:
                    # Batch is full, send it
                    await self.producer.send_batch(batch, topic)
                    success_count += len(batch)
                    
                    # Create new batch and add current event
                    batch = self.producer.create_batch()
                    batch.append(
                        key=key.encode('utf-8') if key else None,
                        value=json.dumps(event).encode('utf-8'),
                        timestamp=None
                    )
                    
            except Exception as e:
                logger.error(
                    "Failed to add event to batch",
                    event_type=event_type,
                    error=str(e)
                )
        
        # Send remaining events in batch
        if batch:
            try:
                topic = self._get_topic_name(events[-1][0])
                await self.producer.send_batch(batch, topic)
                success_count += len(batch)
            except Exception as e:
                logger.error("Failed to send batch", error=str(e))
        
        logger.info(
            "Batch events sent",
            total_events=len(events),
            success_count=success_count
        )
        
        return success_count
    
    async def send_document_processed_event(
        self,
        document_id: str,
        document_url: str,
        pages: int,
        model: str,
        processing_time: float,
        extracted_data: Optional[Dict[str, Any]] = None
    ):
        """Send document processed event with standard format"""
        payload = {
            "document_id": document_id,
            "document_url": document_url,
            "pages": pages,
            "model": model,
            "processing_time_seconds": processing_time,
            "status": "completed"
        }
        
        if extracted_data:
            payload["extracted_data"] = extracted_data
        
        await self.send_event(
            "document.processed",
            payload,
            key=document_id
        )
    
    async def send_document_error_event(
        self,
        document_id: str,
        document_url: str,
        error: str,
        model: str
    ):
        """Send document processing error event"""
        payload = {
            "document_id": document_id,
            "document_url": document_url,
            "error": error,
            "model": model,
            "status": "failed"
        }
        
        await self.send_event(
            "document.processing.failed",
            payload,
            key=document_id
        )
    
    async def health_check(self) -> bool:
        """Perform health check on Kafka connection"""
        if not self.is_connected():
            return False
        
        try:
            # Try to get cluster metadata
            await self.producer._client.fetch_all_metadata()
            return True
        except Exception as e:
            logger.error("Kafka health check failed", error=str(e))
            return False