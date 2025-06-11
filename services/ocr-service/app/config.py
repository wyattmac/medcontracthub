"""
Configuration for OCR Microservice
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Service configuration
    SERVICE_NAME: str = "ocr-service"
    ENVIRONMENT: str = "development"
    PORT: int = 8100
    LOG_LEVEL: str = "INFO"
    
    # API Keys
    MISTRAL_API_KEY: Optional[str] = None
    
    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 3600  # 1 hour
    
    # Kafka configuration
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_TOPIC_PREFIX: str = "medcontract"
    
    # Service limits
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    MAX_PAGES: int = 1000
    REQUEST_TIMEOUT: int = 300  # 5 minutes
    
    # Circuit breaker settings
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 5
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT: int = 60
    CIRCUIT_BREAKER_EXPECTED_EXCEPTION: str = "httpx.TimeoutException"
    
    # OCR settings
    DEFAULT_OCR_MODEL: str = "pixtral-12b-latest"
    ENABLE_TESSERACT: bool = True
    ENABLE_LAYOUTLM: bool = False
    
    # Tracing
    JAEGER_AGENT_HOST: str = "localhost"
    JAEGER_AGENT_PORT: int = 6831
    ENABLE_TRACING: bool = True
    
    # Health check
    HEALTH_CHECK_INTERVAL: int = 30
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

settings = Settings()