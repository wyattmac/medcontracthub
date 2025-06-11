"""
Redis Cache Service for AI Service
Handles caching of embeddings, model responses, and search results
"""
import json
import asyncio
from typing import Any, Optional, Union, List, Dict
from datetime import datetime, timedelta
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool
import hashlib
import pickle

from app.config import settings
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)


class RedisCache:
    """Redis cache service for AI operations"""
    
    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self.pool: Optional[ConnectionPool] = None
        
    async def initialize(self) -> None:
        """Initialize Redis connection"""
        try:
            # Create connection pool
            self.pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD,
                decode_responses=False,  # We'll handle encoding/decoding
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Create Redis client
            self.client = redis.Redis(connection_pool=self.pool)
            
            # Test connection
            await self.client.ping()
            
            logger.info("Redis cache service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            raise
    
    async def close(self) -> None:
        """Close Redis connection"""
        if self.client:
            await self.client.close()
        if self.pool:
            await self.pool.disconnect()
        logger.info("Redis cache service closed")
    
    def _generate_key(self, prefix: str, identifier: str) -> str:
        """Generate cache key with prefix"""
        return f"{settings.SERVICE_NAME}:{prefix}:{identifier}"
    
    def _hash_content(self, content: str) -> str:
        """Generate hash for content"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def get_embedding(
        self,
        text: str,
        model: str
    ) -> Optional[List[float]]:
        """Get cached embedding for text"""
        try:
            # Generate cache key
            text_hash = self._hash_content(f"{model}:{text}")
            key = self._generate_key("embeddings", text_hash)
            
            # Get from cache
            with metrics_collector.timer("redis_get_embedding"):
                value = await self.client.get(key)
                
            if value:
                metrics_collector.increment_counter("cache_hits", tags={"type": "embedding"})
                return pickle.loads(value)
            
            metrics_collector.increment_counter("cache_misses", tags={"type": "embedding"})
            return None
            
        except Exception as e:
            logger.error(f"Failed to get embedding from cache: {e}")
            metrics_collector.increment_error_count("redis_get_error")
            return None
    
    async def set_embedding(
        self,
        text: str,
        model: str,
        embedding: List[float],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache embedding for text"""
        try:
            # Generate cache key
            text_hash = self._hash_content(f"{model}:{text}")
            key = self._generate_key("embeddings", text_hash)
            
            # Serialize embedding
            value = pickle.dumps(embedding)
            
            # Set in cache with TTL
            ttl = ttl or settings.CACHE_TTL
            with metrics_collector.timer("redis_set_embedding"):
                await self.client.setex(key, ttl, value)
            
            metrics_collector.increment_counter("cache_sets", tags={"type": "embedding"})
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache embedding: {e}")
            metrics_collector.increment_error_count("redis_set_error")
            return False
    
    async def get_model_response(
        self,
        prompt: str,
        model: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached model response"""
        try:
            # Generate cache key including parameters
            cache_data = {
                "prompt": prompt,
                "model": model,
                "params": params or {}
            }
            cache_str = json.dumps(cache_data, sort_keys=True)
            key_hash = self._hash_content(cache_str)
            key = self._generate_key("responses", key_hash)
            
            # Get from cache
            with metrics_collector.timer("redis_get_response"):
                value = await self.client.get(key)
            
            if value:
                metrics_collector.increment_counter("cache_hits", tags={"type": "response"})
                return json.loads(value)
            
            metrics_collector.increment_counter("cache_misses", tags={"type": "response"})
            return None
            
        except Exception as e:
            logger.error(f"Failed to get model response from cache: {e}")
            return None
    
    async def set_model_response(
        self,
        prompt: str,
        model: str,
        response: Dict[str, Any],
        params: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> bool:
        """Cache model response"""
        try:
            # Generate cache key
            cache_data = {
                "prompt": prompt,
                "model": model,
                "params": params or {}
            }
            cache_str = json.dumps(cache_data, sort_keys=True)
            key_hash = self._hash_content(cache_str)
            key = self._generate_key("responses", key_hash)
            
            # Add metadata
            response["cached_at"] = datetime.utcnow().isoformat()
            
            # Set in cache
            ttl = ttl or settings.CACHE_TTL
            with metrics_collector.timer("redis_set_response"):
                await self.client.setex(key, ttl, json.dumps(response))
            
            metrics_collector.increment_counter("cache_sets", tags={"type": "response"})
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache model response: {e}")
            return False
    
    async def get_search_results(
        self,
        query: str,
        class_name: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached search results"""
        try:
            # Generate cache key
            cache_data = {
                "query": query,
                "class": class_name,
                "filters": filters or {}
            }
            cache_str = json.dumps(cache_data, sort_keys=True)
            key_hash = self._hash_content(cache_str)
            key = self._generate_key("search", key_hash)
            
            # Get from cache
            with metrics_collector.timer("redis_get_search"):
                value = await self.client.get(key)
            
            if value:
                metrics_collector.increment_counter("cache_hits", tags={"type": "search"})
                return json.loads(value)
            
            metrics_collector.increment_counter("cache_misses", tags={"type": "search"})
            return None
            
        except Exception as e:
            logger.error(f"Failed to get search results from cache: {e}")
            return None
    
    async def set_search_results(
        self,
        query: str,
        class_name: str,
        results: List[Dict[str, Any]],
        filters: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> bool:
        """Cache search results"""
        try:
            # Generate cache key
            cache_data = {
                "query": query,
                "class": class_name,
                "filters": filters or {}
            }
            cache_str = json.dumps(cache_data, sort_keys=True)
            key_hash = self._hash_content(cache_str)
            key = self._generate_key("search", key_hash)
            
            # Set in cache with shorter TTL for search results
            ttl = ttl or (settings.CACHE_TTL // 2)
            with metrics_collector.timer("redis_set_search"):
                await self.client.setex(key, ttl, json.dumps(results))
            
            metrics_collector.increment_counter("cache_sets", tags={"type": "search"})
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache search results: {e}")
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern"""
        try:
            # Find keys matching pattern
            keys = []
            async for key in self.client.scan_iter(
                match=f"{settings.SERVICE_NAME}:{pattern}*",
                count=100
            ):
                keys.append(key)
            
            # Delete keys in batches
            deleted = 0
            if keys:
                for i in range(0, len(keys), 1000):
                    batch = keys[i:i + 1000]
                    deleted += await self.client.delete(*batch)
            
            logger.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
            metrics_collector.increment_counter("cache_invalidations", amount=deleted)
            
            return deleted
            
        except Exception as e:
            logger.error(f"Failed to invalidate cache pattern: {e}")
            return 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            info = await self.client.info("stats")
            
            return {
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    info.get("keyspace_hits", 0) / 
                    (info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1))
                ) * 100,
                "memory_used": info.get("used_memory_human", "0"),
                "connected_clients": info.get("connected_clients", 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {}
    
    async def health_check(self) -> bool:
        """Check if Redis is healthy"""
        try:
            await self.client.ping()
            return True
        except Exception:
            return False