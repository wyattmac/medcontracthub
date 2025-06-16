"""
Multi-Level Cache Strategy for OCR Service
Implements L1 (hot), L2 (warm), and L3 (cold) caching tiers
"""

import json
import asyncio
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import hashlib
import redis.asyncio as redis
import asyncpg
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class CacheTier(Enum):
    L1_HOT = "l1_hot"      # 24 hours - most recent/frequent
    L2_WARM = "l2_warm"    # 7 days - moderately accessed
    L3_COLD = "l3_cold"    # Permanent - database storage


@dataclass
class CacheConfig:
    """Configuration for cache tiers"""
    l1_ttl: int = 86400        # 24 hours in seconds
    l2_ttl: int = 604800       # 7 days in seconds
    l1_max_size: int = 1000    # Max items in L1
    l2_max_size: int = 10000   # Max items in L2
    promotion_threshold: int = 3  # Access count to promote


@dataclass
class CacheMetrics:
    """Metrics for cache performance monitoring"""
    l1_hits: int = 0
    l2_hits: int = 0
    l3_hits: int = 0
    misses: int = 0
    promotions: int = 0
    evictions: int = 0
    total_requests: int = 0
    
    def hit_rate(self) -> float:
        """Calculate overall cache hit rate"""
        if self.total_requests == 0:
            return 0.0
        total_hits = self.l1_hits + self.l2_hits + self.l3_hits
        return (total_hits / self.total_requests) * 100


class MultiLevelCache:
    """
    Implements a multi-level caching strategy for OCR extractions
    L1: Hot cache (Redis) - 24h TTL for frequently accessed
    L2: Warm cache (Redis) - 7 day TTL for moderately accessed
    L3: Cold storage (PostgreSQL) - Permanent storage
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self.metrics = CacheMetrics()
        self._l1_redis: Optional[redis.Redis] = None
        self._l2_redis: Optional[redis.Redis] = None
        self._db_pool: Optional[asyncpg.Pool] = None
        self._initialized = False
        
    async def initialize(self, 
                        l1_redis_url: str,
                        l2_redis_url: str,
                        database_url: str):
        """Initialize cache connections"""
        try:
            # L1 Cache - Hot tier
            self._l1_redis = await redis.from_url(
                l1_redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50
            )
            
            # L2 Cache - Warm tier  
            self._l2_redis = await redis.from_url(
                l2_redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=30
            )
            
            # L3 Storage - Cold tier
            self._db_pool = await asyncpg.create_pool(
                database_url,
                min_size=5,
                max_size=20
            )
            
            self._initialized = True
            logger.info("Multi-level cache initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize cache: {e}")
            raise
            
    async def close(self):
        """Close all cache connections"""
        if self._l1_redis:
            await self._l1_redis.close()
        if self._l2_redis:
            await self._l2_redis.close()
        if self._db_pool:
            await self._db_pool.close()
            
    def _generate_cache_key(self, document_hash: str, extraction_type: str = "full") -> str:
        """Generate consistent cache key"""
        return f"ocr:{extraction_type}:{document_hash}"
        
    async def get(self, document_hash: str, extraction_type: str = "full") -> Tuple[Optional[Dict[str, Any]], CacheTier]:
        """
        Get extraction from cache, checking tiers in order
        Returns: (data, tier) tuple
        """
        if not self._initialized:
            raise RuntimeError("Cache not initialized")
            
        cache_key = self._generate_cache_key(document_hash, extraction_type)
        self.metrics.total_requests += 1
        
        # Check L1 - Hot cache
        try:
            data = await self._l1_redis.get(cache_key)
            if data:
                self.metrics.l1_hits += 1
                logger.debug(f"L1 cache hit for {cache_key}")
                await self._track_access(cache_key, CacheTier.L1_HOT)
                return json.loads(data), CacheTier.L1_HOT
        except Exception as e:
            logger.warning(f"L1 cache error: {e}")
            
        # Check L2 - Warm cache
        try:
            data = await self._l2_redis.get(cache_key)
            if data:
                self.metrics.l2_hits += 1
                logger.debug(f"L2 cache hit for {cache_key}")
                
                # Promote to L1 if accessed frequently
                await self._maybe_promote(cache_key, data, CacheTier.L2_WARM)
                return json.loads(data), CacheTier.L2_WARM
        except Exception as e:
            logger.warning(f"L2 cache error: {e}")
            
        # Check L3 - Cold storage
        try:
            async with self._db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT extraction_data, access_count, last_accessed
                    FROM community_extractions
                    WHERE document_hash = $1 AND extraction_type = $2
                """, document_hash, extraction_type)
                
                if row:
                    self.metrics.l3_hits += 1
                    logger.debug(f"L3 storage hit for {cache_key}")
                    
                    data = row['extraction_data']
                    # Promote to caches if accessed frequently
                    await self._maybe_promote(cache_key, json.dumps(data), CacheTier.L3_COLD)
                    return data, CacheTier.L3_COLD
                    
        except Exception as e:
            logger.error(f"L3 storage error: {e}")
            
        # Cache miss
        self.metrics.misses += 1
        logger.debug(f"Cache miss for {cache_key}")
        return None, None
        
    async def set(self, 
                  document_hash: str,
                  extraction_data: Dict[str, Any],
                  extraction_type: str = "full",
                  tier: CacheTier = CacheTier.L1_HOT):
        """Store extraction in specified tier"""
        if not self._initialized:
            raise RuntimeError("Cache not initialized")
            
        cache_key = self._generate_cache_key(document_hash, extraction_type)
        data_str = json.dumps(extraction_data)
        
        try:
            if tier == CacheTier.L1_HOT:
                # Store in L1 with TTL
                await self._l1_redis.setex(
                    cache_key,
                    self.config.l1_ttl,
                    data_str
                )
                # Also store access metadata
                await self._l1_redis.setex(
                    f"{cache_key}:meta",
                    self.config.l1_ttl,
                    json.dumps({
                        "access_count": 1,
                        "created_at": datetime.utcnow().isoformat(),
                        "tier": CacheTier.L1_HOT.value
                    })
                )
                logger.debug(f"Stored in L1 cache: {cache_key}")
                
            elif tier == CacheTier.L2_WARM:
                # Store in L2 with longer TTL
                await self._l2_redis.setex(
                    cache_key,
                    self.config.l2_ttl,
                    data_str
                )
                await self._l2_redis.setex(
                    f"{cache_key}:meta",
                    self.config.l2_ttl,
                    json.dumps({
                        "access_count": 1,
                        "created_at": datetime.utcnow().isoformat(),
                        "tier": CacheTier.L2_WARM.value
                    })
                )
                logger.debug(f"Stored in L2 cache: {cache_key}")
                
            # Always store in L3 (permanent storage)
            await self._store_in_database(document_hash, extraction_data, extraction_type)
            
        except Exception as e:
            logger.error(f"Failed to store in cache: {e}")
            raise
            
    async def _store_in_database(self,
                                document_hash: str,
                                extraction_data: Dict[str, Any],
                                extraction_type: str):
        """Store extraction in database (L3)"""
        try:
            async with self._db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO community_extractions 
                    (document_hash, extraction_type, extraction_data, 
                     confidence_score, processing_time_ms, created_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    ON CONFLICT (document_hash, extraction_type) 
                    DO UPDATE SET
                        access_count = community_extractions.access_count + 1,
                        last_accessed = CURRENT_TIMESTAMP
                """, 
                document_hash,
                extraction_type,
                extraction_data,
                extraction_data.get('confidence_score', 0.0),
                extraction_data.get('processing_time_ms', 0)
                )
                logger.debug(f"Stored in L3 database: {document_hash}")
        except Exception as e:
            logger.error(f"Database storage error: {e}")
            
    async def _maybe_promote(self, cache_key: str, data: str, current_tier: CacheTier):
        """Promote data to higher tier if access threshold met"""
        try:
            # Get access metadata
            meta_key = f"{cache_key}:meta"
            
            if current_tier == CacheTier.L2_WARM:
                # Check if should promote to L1
                meta = await self._l2_redis.get(meta_key)
                if meta:
                    meta_data = json.loads(meta)
                    access_count = meta_data.get('access_count', 0) + 1
                    
                    if access_count >= self.config.promotion_threshold:
                        # Promote to L1
                        await self._l1_redis.setex(cache_key, self.config.l1_ttl, data)
                        await self._l1_redis.setex(
                            meta_key,
                            self.config.l1_ttl,
                            json.dumps({
                                **meta_data,
                                "access_count": access_count,
                                "promoted_at": datetime.utcnow().isoformat(),
                                "promoted_from": CacheTier.L2_WARM.value
                            })
                        )
                        self.metrics.promotions += 1
                        logger.info(f"Promoted {cache_key} from L2 to L1")
                    else:
                        # Update access count
                        meta_data['access_count'] = access_count
                        await self._l2_redis.setex(meta_key, self.config.l2_ttl, json.dumps(meta_data))
                        
            elif current_tier == CacheTier.L3_COLD:
                # Promote directly to L2 for database hits
                await self._l2_redis.setex(cache_key, self.config.l2_ttl, data)
                await self._l2_redis.setex(
                    meta_key,
                    self.config.l2_ttl, 
                    json.dumps({
                        "access_count": 1,
                        "promoted_at": datetime.utcnow().isoformat(),
                        "promoted_from": CacheTier.L3_COLD.value
                    })
                )
                self.metrics.promotions += 1
                logger.info(f"Promoted {cache_key} from L3 to L2")
                
        except Exception as e:
            logger.warning(f"Promotion error: {e}")
            
    async def _track_access(self, cache_key: str, tier: CacheTier):
        """Track access patterns for cache optimization"""
        try:
            meta_key = f"{cache_key}:meta"
            
            if tier == CacheTier.L1_HOT:
                meta = await self._l1_redis.get(meta_key)
                if meta:
                    meta_data = json.loads(meta)
                    meta_data['access_count'] = meta_data.get('access_count', 0) + 1
                    meta_data['last_accessed'] = datetime.utcnow().isoformat()
                    await self._l1_redis.setex(meta_key, self.config.l1_ttl, json.dumps(meta_data))
                    
        except Exception as e:
            logger.warning(f"Access tracking error: {e}")
            
    async def evict_stale_entries(self):
        """Evict least recently used entries when cache is full"""
        try:
            # Check L1 size
            l1_size = await self._l1_redis.dbsize()
            if l1_size > self.config.l1_max_size:
                # Get all keys with metadata
                keys = await self._l1_redis.keys("ocr:*:meta")
                entries = []
                
                for key in keys:
                    meta = await self._l1_redis.get(key)
                    if meta:
                        meta_data = json.loads(meta)
                        entries.append({
                            'key': key.replace(':meta', ''),
                            'last_accessed': meta_data.get('last_accessed', ''),
                            'access_count': meta_data.get('access_count', 0)
                        })
                        
                # Sort by last accessed (oldest first)
                entries.sort(key=lambda x: x['last_accessed'])
                
                # Evict oldest entries
                evict_count = l1_size - int(self.config.l1_max_size * 0.9)  # Keep 90% capacity
                for entry in entries[:evict_count]:
                    # Move to L2 instead of deleting
                    data = await self._l1_redis.get(entry['key'])
                    if data:
                        await self._l2_redis.setex(entry['key'], self.config.l2_ttl, data)
                        await self._l1_redis.delete(entry['key'], f"{entry['key']}:meta")
                        self.metrics.evictions += 1
                        
                logger.info(f"Evicted {evict_count} entries from L1 to L2")
                
        except Exception as e:
            logger.error(f"Eviction error: {e}")
            
    def get_metrics(self) -> Dict[str, Any]:
        """Return cache performance metrics"""
        return {
            "l1_hits": self.metrics.l1_hits,
            "l2_hits": self.metrics.l2_hits,
            "l3_hits": self.metrics.l3_hits,
            "misses": self.metrics.misses,
            "total_requests": self.metrics.total_requests,
            "hit_rate": f"{self.metrics.hit_rate():.2f}%",
            "promotions": self.metrics.promotions,
            "evictions": self.metrics.evictions,
            "tier_distribution": {
                "l1_percentage": f"{(self.metrics.l1_hits / max(1, self.metrics.total_requests)) * 100:.2f}%",
                "l2_percentage": f"{(self.metrics.l2_hits / max(1, self.metrics.total_requests)) * 100:.2f}%",
                "l3_percentage": f"{(self.metrics.l3_hits / max(1, self.metrics.total_requests)) * 100:.2f}%"
            }
        }
        
    async def warm_cache(self, popular_threshold: int = 10):
        """Pre-warm caches with frequently accessed documents"""
        try:
            async with self._db_pool.acquire() as conn:
                # Get most accessed documents
                rows = await conn.fetch("""
                    SELECT document_hash, extraction_type, extraction_data, access_count
                    FROM community_extractions
                    WHERE access_count >= $1
                    ORDER BY access_count DESC
                    LIMIT 100
                """, popular_threshold)
                
                for row in rows:
                    cache_key = self._generate_cache_key(
                        row['document_hash'], 
                        row['extraction_type']
                    )
                    data_str = json.dumps(row['extraction_data'])
                    
                    # Add to L2 cache
                    await self._l2_redis.setex(cache_key, self.config.l2_ttl, data_str)
                    
                logger.info(f"Pre-warmed cache with {len(rows)} popular documents")
                
        except Exception as e:
            logger.error(f"Cache warming error: {e}")