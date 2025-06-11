"""
Redis Cache Service for OCR Microservice
Handles caching of processed documents to reduce API calls
"""

import redis.asyncio as redis
import json
import structlog
from typing import Optional, Any
import hashlib
from datetime import timedelta

from ..config import settings

logger = structlog.get_logger()

class CacheService:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.connected = False
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            
            # Test connection
            await self.redis_client.ping()
            self.connected = True
            logger.info("Connected to Redis", url=settings.REDIS_URL)
            
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            self.connected = False
            raise
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self.connected = False
            logger.info("Closed Redis connection")
    
    async def ping(self) -> bool:
        """Check Redis connection health"""
        if not self.redis_client or not self.connected:
            return False
        
        try:
            await self.redis_client.ping()
            return True
        except Exception as e:
            logger.error("Redis ping failed", error=str(e))
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.connected:
            logger.warning("Cache not connected, skipping get", key=key)
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value:
                logger.debug("Cache hit", key=key)
                return json.loads(value)
            else:
                logger.debug("Cache miss", key=key)
                return None
                
        except Exception as e:
            logger.error("Cache get failed", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with optional TTL"""
        if not self.connected:
            logger.warning("Cache not connected, skipping set", key=key)
            return False
        
        try:
            serialized = json.dumps(value)
            
            if ttl:
                await self.redis_client.setex(key, ttl, serialized)
            else:
                await self.redis_client.set(key, serialized)
            
            logger.debug("Cache set", key=key, ttl=ttl)
            return True
            
        except Exception as e:
            logger.error("Cache set failed", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.connected:
            return False
        
        try:
            result = await self.redis_client.delete(key)
            logger.debug("Cache delete", key=key, deleted=bool(result))
            return bool(result)
            
        except Exception as e:
            logger.error("Cache delete failed", key=key, error=str(e))
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.connected:
            return False
        
        try:
            return await self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error("Cache exists check failed", key=key, error=str(e))
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching a pattern"""
        if not self.connected:
            return 0
        
        try:
            # Use SCAN to find keys matching pattern
            deleted_count = 0
            async for key in self.redis_client.scan_iter(match=pattern):
                await self.redis_client.delete(key)
                deleted_count += 1
            
            logger.info("Cleared cache pattern", pattern=pattern, count=deleted_count)
            return deleted_count
            
        except Exception as e:
            logger.error("Cache pattern clear failed", pattern=pattern, error=str(e))
            return 0
    
    @staticmethod
    def generate_cache_key(prefix: str, *args) -> str:
        """Generate a consistent cache key from arguments"""
        components = [prefix]
        for arg in args:
            if isinstance(arg, (dict, list)):
                # Hash complex objects for consistent keys
                arg_str = json.dumps(arg, sort_keys=True)
                arg_hash = hashlib.md5(arg_str.encode()).hexdigest()[:8]
                components.append(arg_hash)
            else:
                components.append(str(arg))
        
        return ":".join(components)
    
    async def get_or_set(self, key: str, fetch_func, ttl: int = None) -> Any:
        """Get from cache or fetch and set if not exists"""
        # Try to get from cache first
        cached_value = await self.get(key)
        if cached_value is not None:
            return cached_value
        
        # Fetch fresh value
        try:
            fresh_value = await fetch_func()
            
            # Cache the result
            await self.set(key, fresh_value, ttl)
            
            return fresh_value
            
        except Exception as e:
            logger.error("Fetch function failed in get_or_set", key=key, error=str(e))
            raise
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment a counter in cache"""
        if not self.connected:
            return 0
        
        try:
            return await self.redis_client.incr(key, amount)
        except Exception as e:
            logger.error("Cache increment failed", key=key, error=str(e))
            return 0
    
    async def set_with_lock(self, key: str, value: Any, lock_timeout: int = 10) -> bool:
        """Set value with distributed lock to prevent race conditions"""
        if not self.connected:
            return False
        
        lock_key = f"{key}:lock"
        
        try:
            # Try to acquire lock
            lock_acquired = await self.redis_client.set(
                lock_key, "1", nx=True, ex=lock_timeout
            )
            
            if not lock_acquired:
                logger.warning("Failed to acquire lock", key=key)
                return False
            
            # Set the actual value
            result = await self.set(key, value)
            
            # Release lock
            await self.redis_client.delete(lock_key)
            
            return result
            
        except Exception as e:
            logger.error("Set with lock failed", key=key, error=str(e))
            return False