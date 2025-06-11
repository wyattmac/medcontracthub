"""
Kafka Event Consumer for AI Processing
Consumes events from Kafka and processes them with AI models
"""
import asyncio
import json
from typing import Dict, Any, Optional, List
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError

from app.config import settings
from app.services.weaviate_client import WeaviateService
from app.services.redis_cache import RedisCache
from app.services.embedding_service import EmbeddingService
from app.services.model_orchestrator import ModelOrchestrator, ModelCapability
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)


class KafkaEventConsumer:
    """Consumes and processes events from Kafka"""
    
    def __init__(
        self,
        weaviate_service: WeaviateService,
        redis_cache: RedisCache
    ):
        self.weaviate = weaviate_service
        self.redis = redis_cache
        self.embedding_service = EmbeddingService()
        self.model_orchestrator = ModelOrchestrator()
        self.consumer: Optional[AIOKafkaConsumer] = None
        self._running = False
        
    async def start(self) -> None:
        """Start consuming events"""
        try:
            # Create Kafka consumer
            self.consumer = AIOKafkaConsumer(
                *settings.kafka_topics_list,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=settings.KAFKA_CONSUMER_GROUP,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',
                enable_auto_commit=True,
                max_poll_records=10
            )
            
            # Start consumer
            await self.consumer.start()
            self._running = True
            
            logger.info(f"Kafka consumer started for topics: {settings.kafka_topics_list}")
            
            # Start consuming
            await self._consume_events()
            
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise
    
    async def stop(self) -> None:
        """Stop consuming events"""
        self._running = False
        
        if self.consumer:
            await self.consumer.stop()
            
        if self.model_orchestrator:
            await self.model_orchestrator.close()
            
        logger.info("Kafka consumer stopped")
    
    async def _consume_events(self) -> None:
        """Main event consumption loop"""
        while self._running:
            try:
                # Fetch messages
                messages = await self.consumer.getmany(timeout_ms=1000)
                
                for topic_partition, records in messages.items():
                    for record in records:
                        await self._process_event(
                            topic=record.topic,
                            event=record.value,
                            key=record.key
                        )
                        
            except Exception as e:
                logger.error(f"Error consuming events: {e}")
                metrics_collector.increment_error_count("kafka_consume_error")
                await asyncio.sleep(5)  # Back off on error
    
    async def _process_event(
        self,
        topic: str,
        event: Dict[str, Any],
        key: Optional[bytes]
    ) -> None:
        """Process a single event based on topic"""
        try:
            logger.info(f"Processing event from topic: {topic}")
            metrics_collector.increment_counter("events_processed", tags={"topic": topic})
            
            # Route to appropriate handler
            if topic == "document-processed":
                await self._handle_document_processed(event)
            elif topic == "requirements-extracted":
                await self._handle_requirements_extracted(event)
            elif topic == "proposal-requested":
                await self._handle_proposal_requested(event)
            else:
                logger.warning(f"Unknown topic: {topic}")
                
        except Exception as e:
            logger.error(f"Failed to process event: {e}", exc_info=True)
            metrics_collector.increment_error_count("event_processing_error")
    
    async def _handle_document_processed(self, event: Dict[str, Any]) -> None:
        """Handle document processed events"""
        try:
            document_id = event.get("document_id")
            content = event.get("content")
            metadata = event.get("metadata", {})
            
            if not document_id or not content:
                logger.error("Invalid document processed event")
                return
            
            # Check cache first
            cached_embedding = await self.redis.get_embedding(
                content, settings.DEFAULT_EMBEDDING_MODEL
            )
            
            if cached_embedding:
                embedding = cached_embedding
            else:
                # Generate embedding
                embedding = await self.embedding_service.generate_embeddings(content)
                
                # Cache embedding
                await self.redis.set_embedding(
                    content, settings.DEFAULT_EMBEDDING_MODEL, embedding
                )
            
            # Store in Weaviate
            await self.weaviate.insert_vector(
                class_name="Document",
                data={
                    "content": content,
                    "document_id": document_id,
                    "opportunity_id": metadata.get("opportunity_id"),
                    "document_type": metadata.get("document_type", "unknown"),
                    "metadata": metadata,
                    "created_at": event.get("timestamp")
                },
                vector=embedding
            )
            
            logger.info(f"Document {document_id} stored in vector database")
            
            # Trigger requirement extraction
            await self._extract_requirements(document_id, content, metadata)
            
        except Exception as e:
            logger.error(f"Failed to handle document processed event: {e}")
            raise
    
    async def _handle_requirements_extracted(self, event: Dict[str, Any]) -> None:
        """Handle requirements extracted events"""
        try:
            requirements = event.get("requirements", [])
            document_id = event.get("document_id")
            
            # Process each requirement
            for req in requirements:
                # Generate embedding for requirement
                embedding = await self.embedding_service.generate_embeddings(
                    req["content"]
                )
                
                # Store in Weaviate
                await self.weaviate.insert_vector(
                    class_name="Requirement",
                    data={
                        "content": req["content"],
                        "requirement_id": req.get("id"),
                        "document_id": document_id,
                        "category": req.get("category", "general"),
                        "priority": req.get("priority", "medium"),
                        "extracted_at": event.get("timestamp")
                    },
                    vector=embedding
                )
            
            logger.info(f"Stored {len(requirements)} requirements from document {document_id}")
            
        except Exception as e:
            logger.error(f"Failed to handle requirements extracted event: {e}")
            raise
    
    async def _handle_proposal_requested(self, event: Dict[str, Any]) -> None:
        """Handle proposal generation requests"""
        try:
            opportunity_id = event.get("opportunity_id")
            user_id = event.get("user_id")
            requirements = event.get("requirements", [])
            
            # Generate proposal using AI
            proposal = await self._generate_proposal(
                opportunity_id, requirements, event.get("context", {})
            )
            
            # Generate embedding for proposal
            embedding = await self.embedding_service.generate_embeddings(
                proposal["content"]
            )
            
            # Store in Weaviate
            proposal_id = await self.weaviate.insert_vector(
                class_name="Proposal",
                data={
                    "content": proposal["content"],
                    "proposal_id": proposal.get("id"),
                    "opportunity_id": opportunity_id,
                    "confidence_score": proposal.get("confidence", 0.0),
                    "model_used": proposal.get("model"),
                    "status": "generated",
                    "created_at": event.get("timestamp")
                },
                vector=embedding
            )
            
            logger.info(f"Proposal generated for opportunity {opportunity_id}")
            
            # TODO: Publish proposal generated event
            
        except Exception as e:
            logger.error(f"Failed to handle proposal requested event: {e}")
            raise
    
    async def _extract_requirements(
        self,
        document_id: str,
        content: str,
        metadata: Dict[str, Any]
    ) -> None:
        """Extract requirements from document content"""
        try:
            # Use Mistral for requirement extraction
            prompt = f"""
            Extract all requirements from the following document.
            Categorize each requirement and assign a priority (high, medium, low).
            Return as JSON array with fields: content, category, priority.
            
            Document:
            {content[:4000]}  # Truncate for context window
            """
            
            response = await self.model_orchestrator.generate(
                prompt=prompt,
                capability=ModelCapability.EXTRACTION,
                temperature=0.3  # Lower temperature for extraction
            )
            
            # Parse requirements
            try:
                requirements = json.loads(response["content"])
            except:
                requirements = []
            
            # TODO: Publish requirements extracted event
            
        except Exception as e:
            logger.error(f"Failed to extract requirements: {e}")
    
    async def _generate_proposal(
        self,
        opportunity_id: str,
        requirements: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate proposal content using AI"""
        try:
            # Search for similar past proposals
            if requirements:
                # Use first requirement for similarity search
                req_embedding = await self.embedding_service.generate_embeddings(
                    requirements[0]["content"]
                )
                
                similar_proposals = await self.weaviate.search_vectors(
                    class_name="Proposal",
                    vector=req_embedding,
                    limit=3,
                    where_filter={
                        "path": ["status"],
                        "operator": "Equal",
                        "valueString": "won"
                    }
                )
            else:
                similar_proposals = []
            
            # Build prompt with context
            prompt = self._build_proposal_prompt(
                requirements, similar_proposals, context
            )
            
            # Generate proposal using ensemble approach
            response = await self.model_orchestrator.ensemble_generate(
                prompt=prompt,
                models=None,  # Use all available models
                voting_method="confidence",
                max_tokens=4096
            )
            
            return {
                "id": f"prop_{opportunity_id}_{int(asyncio.get_event_loop().time())}",
                "content": response["content"],
                "model": response.get("model"),
                "confidence": self._calculate_confidence(response)
            }
            
        except Exception as e:
            logger.error(f"Failed to generate proposal: {e}")
            raise
    
    def _build_proposal_prompt(
        self,
        requirements: List[Dict[str, Any]],
        similar_proposals: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> str:
        """Build prompt for proposal generation"""
        prompt = f"""
        Generate a comprehensive proposal response for the following requirements.
        
        Company Context:
        - Name: {context.get('company_name', 'N/A')}
        - Capabilities: {context.get('capabilities', 'N/A')}
        
        Requirements to Address:
        """
        
        for i, req in enumerate(requirements[:10], 1):  # Limit to top 10
            prompt += f"\n{i}. {req['content']} (Priority: {req.get('priority', 'medium')})"
        
        if similar_proposals:
            prompt += "\n\nReference similar successful proposals for structure and approach."
        
        prompt += """
        
        Generate a professional proposal that:
        1. Addresses each requirement comprehensively
        2. Highlights company strengths and relevant experience
        3. Includes technical approach and methodology
        4. Demonstrates understanding of the project
        5. Provides clear value proposition
        """
        
        return prompt
    
    def _calculate_confidence(self, response: Dict[str, Any]) -> float:
        """Calculate confidence score for generated proposal"""
        # Simple confidence calculation
        # In practice, would use more sophisticated metrics
        
        if response.get("method") == "ensemble":
            # For ensemble, use agreement between models
            return 0.85
        else:
            # For single model, use default
            return 0.75