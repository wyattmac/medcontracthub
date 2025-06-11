"""
Logging Configuration
Sets up structured logging with JSON format
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from typing import Optional

from app.config import settings


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Setup logger with JSON formatting"""
    logger = logging.getLogger(name)
    
    # Set log level
    log_level = level or settings.LOG_LEVEL
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Avoid adding multiple handlers
    if not logger.handlers:
        # Create console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, log_level.upper()))
        
        # Create JSON formatter
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        
        # Add custom fields
        formatter.add_fields = lambda record: {
            "service": settings.SERVICE_NAME,
            "environment": "production" if not settings.DEBUG else "development"
        }
        
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    # Prevent propagation to avoid duplicate logs
    logger.propagate = False
    
    return logger


# Create default logger
logger = setup_logger(__name__)