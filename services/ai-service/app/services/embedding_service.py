"""
Embedding Service for Text Vectorization
Supports multiple embedding models and GPU acceleration
"""
import asyncio
from typing import List, Union, Optional, Dict, Any
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)


class EmbeddingService:
    """Service for generating text embeddings"""
    
    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.device = self._get_device()
        self._initialize_models()
        
    def _get_device(self) -> str:
        """Determine the device to use for embeddings"""
        if settings.USE_GPU and torch.cuda.is_available():
            logger.info(f"Using GPU device: {torch.cuda.get_device_name(0)}")
            return "cuda"
        else:
            logger.info("Using CPU for embeddings")
            return "cpu"
    
    def _initialize_models(self) -> None:
        """Initialize embedding models"""
        try:
            # Initialize sentence transformer model
            self.models["sentence-transformer"] = SentenceTransformer(
                settings.DEFAULT_EMBEDDING_MODEL,
                device=self.device
            )
            
            # Initialize OpenAI if API key is available
            if settings.OPENAI_API_KEY:
                openai.api_key = settings.OPENAI_API_KEY
                self.models["openai"] = True
                
            logger.info("Embedding models initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize embedding models: {e}")
            raise
    
    async def generate_embeddings(
        self,
        texts: Union[str, List[str]],
        model: Optional[str] = None,
        batch_size: Optional[int] = None
    ) -> Union[List[float], List[List[float]]]:
        """Generate embeddings for text(s)"""
        try:
            # Convert single text to list
            is_single = isinstance(texts, str)
            if is_single:
                texts = [texts]
            
            # Use default model if not specified
            model = model or settings.DEFAULT_EMBEDDING_MODEL
            
            # Generate embeddings based on model type
            if "text-embedding" in model:
                embeddings = await self._generate_openai_embeddings(texts, model)
            else:
                embeddings = await self._generate_transformer_embeddings(
                    texts, model, batch_size
                )
            
            # Return single embedding if input was single text
            return embeddings[0] if is_single else embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            metrics_collector.increment_error_count("embedding_generation_error")
            raise
    
    async def _generate_transformer_embeddings(
        self,
        texts: List[str],
        model: str,
        batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """Generate embeddings using sentence transformers"""
        with metrics_collector.timer("transformer_embeddings"):
            try:
                # Use configured batch size if not specified
                batch_size = batch_size or settings.EMBEDDING_BATCH_SIZE
                
                # Get or load model
                if model not in self.models:
                    self.models[model] = SentenceTransformer(model, device=self.device)
                
                transformer = self.models[model]
                
                # Process in batches for large inputs
                embeddings = []
                for i in range(0, len(texts), batch_size):
                    batch = texts[i:i + batch_size]
                    
                    # Generate embeddings
                    batch_embeddings = await asyncio.to_thread(
                        transformer.encode,
                        batch,
                        convert_to_tensor=False,
                        show_progress_bar=False
                    )
                    
                    # Convert to list of lists
                    embeddings.extend(batch_embeddings.tolist())
                
                metrics_collector.increment_counter("embeddings_generated", len(texts))
                return embeddings
                
            except Exception as e:
                logger.error(f"Transformer embedding error: {e}")
                raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _generate_openai_embeddings(
        self,
        texts: List[str],
        model: str
    ) -> List[List[float]]:
        """Generate embeddings using OpenAI API"""
        with metrics_collector.timer("openai_embeddings"):
            try:
                if not settings.OPENAI_API_KEY:
                    raise ValueError("OpenAI API key not configured")
                
                # OpenAI has a limit on batch size
                max_batch_size = 2048
                embeddings = []
                
                for i in range(0, len(texts), max_batch_size):
                    batch = texts[i:i + max_batch_size]
                    
                    # Call OpenAI API
                    response = await asyncio.to_thread(
                        openai.Embedding.create,
                        input=batch,
                        model=model
                    )
                    
                    # Extract embeddings
                    batch_embeddings = [item["embedding"] for item in response["data"]]
                    embeddings.extend(batch_embeddings)
                
                metrics_collector.increment_counter("openai_embeddings_generated", len(texts))
                return embeddings
                
            except Exception as e:
                logger.error(f"OpenAI embedding error: {e}")
                raise
    
    def cosine_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Failed to calculate cosine similarity: {e}")
            raise
    
    def batch_cosine_similarity(
        self,
        query_embedding: List[float],
        embeddings: List[List[float]]
    ) -> List[float]:
        """Calculate cosine similarity between query and multiple embeddings"""
        try:
            # Convert to numpy arrays
            query_vec = np.array(query_embedding)
            embedding_matrix = np.array(embeddings)
            
            # Normalize query vector
            query_norm = query_vec / np.linalg.norm(query_vec)
            
            # Normalize embedding matrix
            norms = np.linalg.norm(embedding_matrix, axis=1, keepdims=True)
            normalized_embeddings = embedding_matrix / norms
            
            # Calculate similarities
            similarities = np.dot(normalized_embeddings, query_norm)
            
            return similarities.tolist()
            
        except Exception as e:
            logger.error(f"Failed to calculate batch cosine similarity: {e}")
            raise
    
    async def find_similar(
        self,
        query_embedding: List[float],
        embeddings: List[List[float]],
        top_k: int = 10,
        threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Find most similar embeddings to query"""
        try:
            # Calculate similarities
            similarities = self.batch_cosine_similarity(query_embedding, embeddings)
            
            # Create results with indices and scores
            results = []
            for idx, score in enumerate(similarities):
                if score >= threshold:
                    results.append({
                        "index": idx,
                        "score": float(score),
                        "similarity": float(score)
                    })
            
            # Sort by score descending
            results.sort(key=lambda x: x["score"], reverse=True)
            
            # Return top k results
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Failed to find similar embeddings: {e}")
            raise
    
    def get_embedding_dimension(self, model: Optional[str] = None) -> int:
        """Get the dimension of embeddings for a model"""
        model = model or settings.DEFAULT_EMBEDDING_MODEL
        
        # Known dimensions for common models
        known_dimensions = {
            "sentence-transformers/all-mpnet-base-v2": 768,
            "sentence-transformers/all-MiniLM-L6-v2": 384,
            "text-embedding-ada-002": 1536,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
        }
        
        if model in known_dimensions:
            return known_dimensions[model]
        
        # Try to get from loaded model
        if model in self.models and hasattr(self.models[model], "get_sentence_embedding_dimension"):
            return self.models[model].get_sentence_embedding_dimension()
        
        # Default dimension
        return 768
    
    async def preprocess_text(
        self,
        text: str,
        max_length: Optional[int] = None
    ) -> str:
        """Preprocess text before embedding"""
        try:
            # Remove extra whitespace
            text = " ".join(text.split())
            
            # Truncate if needed
            if max_length and len(text) > max_length:
                text = text[:max_length] + "..."
            
            return text
            
        except Exception as e:
            logger.error(f"Failed to preprocess text: {e}")
            raise