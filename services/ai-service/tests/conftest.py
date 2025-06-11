"""
Test Configuration and Fixtures
"""
import pytest
import asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock

from main import app
from app.services.weaviate_client import WeaviateService
from app.services.redis_cache import RedisCache


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def mock_weaviate():
    """Mock Weaviate service"""
    mock = AsyncMock(spec=WeaviateService)
    mock._initialized = True
    mock.insert_vector = AsyncMock(return_value="test-uuid")
    mock.search_vectors = AsyncMock(return_value=[
        {
            "_additional": {"id": "1", "certainty": 0.95},
            "content": "Test content",
            "document_id": "doc-1"
        }
    ])
    return mock


@pytest.fixture
async def mock_redis():
    """Mock Redis cache"""
    mock = AsyncMock(spec=RedisCache)
    mock.health_check = AsyncMock(return_value=True)
    mock.get_embedding = AsyncMock(return_value=None)
    mock.set_embedding = AsyncMock(return_value=True)
    mock.get_model_response = AsyncMock(return_value=None)
    mock.set_model_response = AsyncMock(return_value=True)
    return mock


@pytest.fixture
async def test_client(mock_weaviate, mock_redis):
    """Create test client with mocked services"""
    # Override app state
    app.state.weaviate = mock_weaviate
    app.state.redis = mock_redis
    
    # Create test client
    with TestClient(app) as client:
        yield client


@pytest.fixture
def sample_embedding():
    """Sample embedding vector"""
    return [0.1] * 768  # 768-dimensional vector


@pytest.fixture
def sample_document():
    """Sample document data"""
    return {
        "document_id": "doc-123",
        "opportunity_id": "opp-456",
        "content": "This is a test document for the AI service.",
        "document_type": "rfp",
        "metadata": {
            "source": "test",
            "pages": 10
        }
    }


@pytest.fixture
def sample_inference_request():
    """Sample inference request"""
    return {
        "prompt": "Generate a test response",
        "model": "claude",
        "max_tokens": 100,
        "temperature": 0.7,
        "system_prompt": "You are a helpful assistant."
    }