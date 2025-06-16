"""
Deduplication Service for Community OCR Sharing
Handles document fingerprinting and similarity matching
"""

import hashlib
import re
from typing import Dict, List, Optional, Tuple, Any
import structlog
from sqlalchemy import text
import asyncio
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import asyncpg

from ..config import settings
from vector_search import VectorSearchService

logger = structlog.get_logger()

class DeduplicationService:
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 3),
            stop_words='english'
        )
        self._is_fitted = False
        self.vector_search = VectorSearchService()
        
    async def initialize(self):
        """Initialize database connection pool and vector search"""
        try:
            self.db_pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=2,
                max_size=10
            )
            
            # Initialize vector search service
            await self.vector_search.initialize()
            
            logger.info("Deduplication service initialized with vector search")
        except Exception as e:
            logger.error("Failed to initialize deduplication service", error=str(e))
            raise
    
    async def close(self):
        """Close database connections and vector search"""
        if self.db_pool:
            await self.db_pool.close()
        await self.vector_search.close()
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for consistent hashing"""
        # Convert to lowercase
        normalized = text.lower()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove special characters but keep alphanumeric and basic punctuation
        normalized = re.sub(r'[^\w\s\.\,\;\:\!\?]', '', normalized)
        
        # Trim
        normalized = normalized.strip()
        
        return normalized
    
    def calculate_text_hash(self, text: str) -> str:
        """Calculate SHA256 hash of normalized text"""
        normalized = self.normalize_text(text)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    def calculate_structure_hash(self, structure_data: Dict[str, Any]) -> str:
        """Calculate hash of document structure (tables, sections, etc)"""
        # Sort keys for consistent hashing
        structure_str = str(sorted(structure_data.items()))
        return hashlib.sha256(structure_str.encode('utf-8')).hexdigest()
    
    def calculate_fingerprint(
        self, 
        text: str, 
        structure_data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Calculate comprehensive document fingerprint"""
        # Text hash
        text_hash = self.calculate_text_hash(text)
        
        # Structure hash
        structure_hash = None
        if structure_data:
            structure_hash = self.calculate_structure_hash(structure_data)
        
        # Composite fingerprint (first 16 chars of combined hash)
        combined = text_hash + (structure_hash or '') + str(metadata or {})
        full_fingerprint = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:16]
        
        return {
            'full_fingerprint': full_fingerprint,
            'text_hash': text_hash,
            'structure_hash': structure_hash
        }
    
    def extract_shingles(self, text: str, k: int = 5) -> List[int]:
        """Extract k-shingles for MinHash similarity"""
        normalized = self.normalize_text(text)
        words = normalized.split()
        
        if len(words) < k:
            return []
        
        shingles = []
        for i in range(len(words) - k + 1):
            shingle = ' '.join(words[i:i+k])
            # Use hash of shingle for efficiency
            shingle_hash = int(hashlib.md5(shingle.encode()).hexdigest()[:8], 16)
            shingles.append(shingle_hash)
        
        return shingles
    
    async def find_similar_extractions(
        self,
        text: str,
        document_type: Optional[str] = None,
        similarity_threshold: float = 0.8,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Find similar extractions using both hash matching and vector search"""
        if not self.db_pool:
            logger.warning("Database pool not initialized")
            return []
        
        fingerprint = self.calculate_fingerprint(text)
        
        # Try vector search first for semantic similarity
        vector_matches = []
        try:
            vector_matches = await self.vector_search.search_similar_documents(
                query_text=text[:1000],  # Use first 1000 chars for search
                limit=limit * 2,  # Get more candidates
                min_similarity=similarity_threshold
            )
        except Exception as e:
            logger.warning(f"Vector search failed, falling back to hash matching: {e}")
        
        try:
            async with self.db_pool.acquire() as conn:
                # First, try exact match
                exact_match = await conn.fetchrow("""
                    SELECT 
                        id as extraction_id,
                        1.0 as similarity_score,
                        confidence_score,
                        usage_count,
                        extracted_text,
                        structured_data,
                        extracted_requirements
                    FROM community_extractions
                    WHERE text_hash = $1
                        AND status = 'active'
                        AND ($2::VARCHAR IS NULL OR document_type = $2)
                    ORDER BY confidence_score DESC, usage_count DESC
                    LIMIT 1
                """, fingerprint['text_hash'], document_type)
                
                if exact_match:
                    return [dict(exact_match)]
                
                # If no exact match, try fuzzy matching
                # Get candidates with partial hash match
                candidates = await conn.fetch("""
                    SELECT 
                        id as extraction_id,
                        confidence_score,
                        usage_count,
                        extracted_text,
                        structured_data,
                        extracted_requirements,
                        text_hash
                    FROM community_extractions
                    WHERE substring(text_hash, 1, 8) = substring($1, 1, 8)
                        AND status = 'active'
                        AND ($2::VARCHAR IS NULL OR document_type = $2)
                    ORDER BY confidence_score DESC, usage_count DESC
                    LIMIT 50
                """, fingerprint['text_hash'], document_type)
                
                if not candidates:
                    return []
                
                # Calculate similarity scores
                results = []
                sample_shingles = set(self.extract_shingles(text))
                
                for candidate in candidates:
                    # Skip if exact hash (already checked)
                    if candidate['text_hash'] == fingerprint['text_hash']:
                        continue
                    
                    # Calculate Jaccard similarity using shingles
                    candidate_shingles = set(self.extract_shingles(candidate['extracted_text']))
                    
                    if not candidate_shingles:
                        continue
                    
                    intersection = len(sample_shingles & candidate_shingles)
                    union = len(sample_shingles | candidate_shingles)
                    
                    if union == 0:
                        continue
                    
                    similarity = intersection / union
                    
                    if similarity >= similarity_threshold:
                        result = dict(candidate)
                        result['similarity_score'] = round(similarity, 3)
                        results.append(result)
                
                # Merge vector search results with hash-based results
                # Create a map to avoid duplicates
                all_results = {}
                
                # Add hash-based results
                for result in results:
                    extraction_id = result.get('extraction_id', result.get('id'))
                    all_results[extraction_id] = result
                
                # Add vector search results
                for match in vector_matches:
                    extraction_id = match.document_hash
                    if extraction_id not in all_results:
                        # Fetch full data from database
                        db_data = await conn.fetchrow("""
                            SELECT 
                                id as extraction_id,
                                confidence_score,
                                usage_count,
                                extracted_text,
                                structured_data,
                                extracted_requirements
                            FROM community_extractions
                            WHERE id = $1 AND status = 'active'
                        """, extraction_id)
                        
                        if db_data:
                            result = dict(db_data)
                            result['similarity_score'] = match.similarity_score
                            result['source'] = 'vector_search'
                            all_results[extraction_id] = result
                
                # Convert back to list and sort
                final_results = list(all_results.values())
                final_results.sort(key=lambda x: (
                    -x['similarity_score'], 
                    -x['confidence_score'], 
                    -x.get('usage_count', 0)
                ))
                
                return final_results[:limit]
                
        except Exception as e:
            logger.error("Failed to find similar extractions", error=str(e))
            return []
    
    async def check_duplicate(
        self,
        text: str,
        threshold: float = 0.95
    ) -> Optional[Dict[str, Any]]:
        """Check if document is a duplicate of existing extraction"""
        similar = await self.find_similar_extractions(
            text, 
            similarity_threshold=threshold,
            limit=1
        )
        
        if similar and similar[0]['similarity_score'] >= threshold:
            return similar[0]
        
        return None
    
    async def index_extraction_for_search(
        self,
        document_hash: str,
        title: str,
        description: str,
        content: str,
        extraction_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Index extraction in vector search for semantic matching"""
        try:
            weaviate_id = await self.vector_search.index_document(
                document_hash=document_hash,
                title=title,
                description=description,
                content=content,
                extraction_data=extraction_data,
                metadata=metadata
            )
            logger.info(f"Indexed extraction {document_hash} in vector search")
            return weaviate_id
        except Exception as e:
            logger.error(f"Failed to index extraction in vector search: {e}")
            return None
    
    async def store_fingerprint(
        self,
        contract_document_id: str,
        text: str,
        structure_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Store document fingerprint for future matching"""
        if not self.db_pool:
            raise RuntimeError("Database pool not initialized")
        
        fingerprint = self.calculate_fingerprint(text, structure_data)
        shingles = self.extract_shingles(text)[:100]  # Store top 100 shingles
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO document_fingerprints (
                        contract_document_id,
                        full_fingerprint,
                        text_hash,
                        structure_hash,
                        shingle_hashes
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (contract_document_id) DO UPDATE
                    SET full_fingerprint = EXCLUDED.full_fingerprint,
                        text_hash = EXCLUDED.text_hash,
                        structure_hash = EXCLUDED.structure_hash,
                        shingle_hashes = EXCLUDED.shingle_hashes
                """, 
                contract_document_id,
                fingerprint['full_fingerprint'],
                fingerprint['text_hash'],
                fingerprint['structure_hash'],
                shingles
                )
                
            logger.info("Stored document fingerprint", 
                       document_id=contract_document_id,
                       fingerprint=fingerprint['full_fingerprint'][:8])
            
            return fingerprint
            
        except Exception as e:
            logger.error("Failed to store fingerprint", error=str(e))
            raise
    
    def calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate cosine similarity between two texts using TF-IDF"""
        try:
            # Normalize texts
            norm_text1 = self.normalize_text(text1)
            norm_text2 = self.normalize_text(text2)
            
            # Quick check for very short texts
            if len(norm_text1) < 50 or len(norm_text2) < 50:
                # Use simple Jaccard similarity for short texts
                words1 = set(norm_text1.split())
                words2 = set(norm_text2.split())
                
                if not words1 or not words2:
                    return 0.0
                
                intersection = len(words1 & words2)
                union = len(words1 | words2)
                
                return intersection / union if union > 0 else 0.0
            
            # For longer texts, use TF-IDF
            # Fit vectorizer if not already fitted
            if not self._is_fitted:
                # Use a sample corpus for fitting (in production, this could be pre-trained)
                sample_corpus = [norm_text1, norm_text2]
                self.vectorizer.fit(sample_corpus)
                self._is_fitted = True
            
            # Transform texts to vectors
            tfidf_matrix = self.vectorizer.transform([norm_text1, norm_text2])
            
            # Calculate cosine similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            return float(similarity)
            
        except Exception as e:
            logger.error("Failed to calculate text similarity", error=str(e))
            return 0.0
    
    async def get_deduplication_stats(self) -> Dict[str, Any]:
        """Get statistics about deduplication effectiveness"""
        if not self.db_pool:
            return {}
        
        try:
            async with self.db_pool.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(DISTINCT document_fingerprint) as unique_documents,
                        COUNT(*) as total_extractions,
                        AVG(usage_count) as avg_usage_per_extraction,
                        SUM(usage_count) as total_uses,
                        COUNT(DISTINCT document_type) as document_types
                    FROM community_extractions
                    WHERE status = 'active'
                """)
                
                reuse_stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as total_reuses,
                        SUM(saved_processing_time_ms) / 1000.0 as total_time_saved_seconds,
                        SUM(saved_api_cost) as total_cost_saved
                    FROM community_extraction_usage
                """)
                
                return {
                    'unique_documents': stats['unique_documents'] or 0,
                    'total_extractions': stats['total_extractions'] or 0,
                    'average_usage_per_extraction': float(stats['avg_usage_per_extraction'] or 0),
                    'total_uses': stats['total_uses'] or 0,
                    'document_types': stats['document_types'] or 0,
                    'total_reuses': reuse_stats['total_reuses'] or 0,
                    'time_saved_hours': float(reuse_stats['total_time_saved_seconds'] or 0) / 3600,
                    'cost_saved': float(reuse_stats['total_cost_saved'] or 0),
                    'deduplication_rate': (
                        ((stats['total_extractions'] or 0) - (stats['unique_documents'] or 0)) / 
                        (stats['total_extractions'] or 1) * 100
                    )
                }
                
        except Exception as e:
            logger.error("Failed to get deduplication stats", error=str(e))
            return {}