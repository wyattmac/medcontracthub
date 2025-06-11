"""
AI Service Configuration Settings
"""
import os
from typing import List, Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Service configuration
    SERVICE_NAME: str = "ai-service"
    PORT: int = Field(default=8200, env="PORT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Weaviate configuration
    WEAVIATE_URL: str = Field(default="http://weaviate:8080", env="WEAVIATE_URL")
    WEAVIATE_API_KEY: Optional[str] = Field(default=None, env="WEAVIATE_API_KEY")
    WEAVIATE_TIMEOUT: int = Field(default=30, env="WEAVIATE_TIMEOUT")
    
    # Redis configuration
    REDIS_URL: str = Field(default="redis://redis:6379/0", env="REDIS_URL")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    REDIS_SSL: bool = Field(default=False, env="REDIS_SSL")
    CACHE_TTL: int = Field(default=3600, env="CACHE_TTL")  # 1 hour
    
    # Kafka configuration
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="kafka:9092", 
        env="KAFKA_BOOTSTRAP_SERVERS"
    )
    KAFKA_CONSUMER_GROUP: str = Field(
        default="ai-service-consumer", 
        env="KAFKA_CONSUMER_GROUP"
    )
    KAFKA_TOPICS: List[str] = Field(
        default=["document-processed", "requirements-extracted", "proposal-requested"],
        env="KAFKA_TOPICS"
    )
    
    # AI Model API Keys
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    MISTRAL_API_KEY: Optional[str] = Field(default=None, env="MISTRAL_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = Field(default=None, env="HUGGINGFACE_API_KEY")
    
    # Model configuration
    DEFAULT_EMBEDDING_MODEL: str = Field(
        default="sentence-transformers/all-mpnet-base-v2",
        env="DEFAULT_EMBEDDING_MODEL"
    )
    DEFAULT_INFERENCE_MODEL: str = Field(
        default="claude-3-opus-20240229",
        env="DEFAULT_INFERENCE_MODEL"
    )
    MAX_TOKENS: int = Field(default=4096, env="MAX_TOKENS")
    TEMPERATURE: float = Field(default=0.7, env="TEMPERATURE")
    
    # GPU configuration
    USE_GPU: bool = Field(default=False, env="USE_GPU")
    CUDA_VISIBLE_DEVICES: str = Field(default="0", env="CUDA_VISIBLE_DEVICES")
    
    # Performance settings
    MAX_BATCH_SIZE: int = Field(default=32, env="MAX_BATCH_SIZE")
    EMBEDDING_BATCH_SIZE: int = Field(default=16, env="EMBEDDING_BATCH_SIZE")
    REQUEST_TIMEOUT: int = Field(default=60, env="REQUEST_TIMEOUT")
    MAX_RETRIES: int = Field(default=3, env="MAX_RETRIES")
    
    # CORS settings
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        env="CORS_ORIGINS"
    )
    
    # Monitoring
    ENABLE_METRICS: bool = Field(default=True, env="ENABLE_METRICS")
    ENABLE_TRACING: bool = Field(default=True, env="ENABLE_TRACING")
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = Field(
        default=None,
        env="OTEL_EXPORTER_OTLP_ENDPOINT"
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        
    @property
    def kafka_topics_list(self) -> List[str]:
        """Parse Kafka topics from string or list"""
        if isinstance(self.KAFKA_TOPICS, str):
            return [topic.strip() for topic in self.KAFKA_TOPICS.split(",")]
        return self.KAFKA_TOPICS
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from string or list"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS


# Create global settings instance
settings = Settings()