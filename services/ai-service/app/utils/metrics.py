"""
Metrics Collection
Prometheus metrics for monitoring
"""
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
import time
from contextlib import contextmanager

from app.config import settings


class MetricsCollector:
    """Centralized metrics collection"""
    
    def __init__(self):
        self.registry = CollectorRegistry()
        self._metrics: Dict[str, Any] = {}
        
    def initialize(self) -> None:
        """Initialize all metrics"""
        if not settings.ENABLE_METRICS:
            return
        
        # Counters
        self._metrics["requests_total"] = Counter(
            "ai_service_requests_total",
            "Total number of requests",
            ["endpoint", "method", "status"],
            registry=self.registry
        )
        
        self._metrics["errors_total"] = Counter(
            "ai_service_errors_total",
            "Total number of errors",
            ["error_type"],
            registry=self.registry
        )
        
        self._metrics["embeddings_generated"] = Counter(
            "ai_service_embeddings_generated_total",
            "Total embeddings generated",
            ["model"],
            registry=self.registry
        )
        
        self._metrics["inference_requests"] = Counter(
            "ai_service_inference_requests_total",
            "Total inference requests",
            ["model"],
            registry=self.registry
        )
        
        self._metrics["vector_operations"] = Counter(
            "ai_service_vector_operations_total",
            "Total vector database operations",
            ["operation"],
            registry=self.registry
        )
        
        self._metrics["cache_operations"] = Counter(
            "ai_service_cache_operations_total",
            "Total cache operations",
            ["operation", "result"],
            registry=self.registry
        )
        
        self._metrics["events_processed"] = Counter(
            "ai_service_events_processed_total",
            "Total Kafka events processed",
            ["topic", "status"],
            registry=self.registry
        )
        
        # Histograms
        self._metrics["request_duration"] = Histogram(
            "ai_service_request_duration_seconds",
            "Request duration in seconds",
            ["endpoint", "method"],
            registry=self.registry
        )
        
        self._metrics["embedding_generation_time"] = Histogram(
            "ai_service_embedding_generation_seconds",
            "Embedding generation time",
            ["model"],
            registry=self.registry
        )
        
        self._metrics["inference_generation_time"] = Histogram(
            "ai_service_inference_generation_seconds",
            "Inference generation time",
            ["model"],
            registry=self.registry
        )
        
        self._metrics["vector_search_time"] = Histogram(
            "ai_service_vector_search_seconds",
            "Vector search duration",
            ["class_name"],
            registry=self.registry
        )
        
        # Gauges
        self._metrics["active_connections"] = Gauge(
            "ai_service_active_connections",
            "Number of active connections",
            ["service"],
            registry=self.registry
        )
        
        self._metrics["model_memory_usage"] = Gauge(
            "ai_service_model_memory_bytes",
            "Model memory usage in bytes",
            ["model"],
            registry=self.registry
        )
        
        self._metrics["cache_size"] = Gauge(
            "ai_service_cache_size_bytes",
            "Cache size in bytes",
            registry=self.registry
        )
    
    def increment_counter(
        self,
        metric_name: str,
        amount: int = 1,
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Increment a counter metric"""
        if not settings.ENABLE_METRICS:
            return
        
        metric = self._metrics.get(f"{metric_name}_total") or self._metrics.get(metric_name)
        if metric and isinstance(metric, Counter):
            if tags:
                metric.labels(**tags).inc(amount)
            else:
                metric.inc(amount)
    
    def increment_error_count(self, error_type: str) -> None:
        """Increment error counter"""
        self.increment_counter("errors", tags={"error_type": error_type})
    
    def observe_histogram(
        self,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Observe a histogram value"""
        if not settings.ENABLE_METRICS:
            return
        
        metric = self._metrics.get(metric_name)
        if metric and isinstance(metric, Histogram):
            if tags:
                metric.labels(**tags).observe(value)
            else:
                metric.observe(value)
    
    def set_gauge(
        self,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Set a gauge value"""
        if not settings.ENABLE_METRICS:
            return
        
        metric = self._metrics.get(metric_name)
        if metric and isinstance(metric, Gauge):
            if tags:
                metric.labels(**tags).set(value)
            else:
                metric.set(value)
    
    @contextmanager
    def timer(self, metric_name: str, tags: Optional[Dict[str, str]] = None):
        """Context manager for timing operations"""
        start = time.time()
        try:
            yield
        finally:
            duration = time.time() - start
            self.observe_histogram(f"{metric_name}_seconds", duration, tags)


# Global metrics collector instance
metrics_collector = MetricsCollector()