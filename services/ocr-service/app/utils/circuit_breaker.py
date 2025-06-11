"""
Circuit Breaker Pattern Implementation
Prevents cascading failures by failing fast when a service is down
"""

import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Any, Optional
import structlog

logger = structlog.get_logger()

class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"          # Failing fast
    HALF_OPEN = "half_open" # Testing if service recovered

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: Optional[type] = None,
        name: str = "CircuitBreaker"
    ):
        """
        Initialize circuit breaker
        
        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying half-open
            expected_exception: Exception type to catch (None = all exceptions)
            name: Name for logging
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception or Exception
        self.name = name
        
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = CircuitState.CLOSED
        
        # Metrics
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.rejected_calls = 0
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open"""
        return self.state == CircuitState.OPEN
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed"""
        return self.state == CircuitState.CLOSED
    
    @property
    def is_half_open(self) -> bool:
        """Check if circuit is half-open"""
        return self.state == CircuitState.HALF_OPEN
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return False
        
        return datetime.utcnow() >= (
            self.last_failure_time + timedelta(seconds=self.recovery_timeout)
        )
    
    def _record_success(self):
        """Record successful call"""
        self.failure_count = 0
        self.last_failure_time = None
        
        if self.state != CircuitState.CLOSED:
            logger.info(
                f"Circuit breaker {self.name} closed after successful call",
                previous_state=self.state.value
            )
            self.state = CircuitState.CLOSED
        
        self.successful_calls += 1
    
    def _record_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        self.failed_calls += 1
        
        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                logger.warning(
                    f"Circuit breaker {self.name} opened after {self.failure_count} failures",
                    threshold=self.failure_threshold
                )
                self.state = CircuitState.OPEN
    
    async def call(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """
        Call function through circuit breaker
        
        Args:
            func: Async function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func
            
        Returns:
            Result of func
            
        Raises:
            Exception: If circuit is open or func fails
        """
        self.total_calls += 1
        
        # Check if circuit should attempt reset
        if self.is_open and self._should_attempt_reset():
            logger.info(
                f"Circuit breaker {self.name} attempting reset",
                recovery_timeout=self.recovery_timeout
            )
            self.state = CircuitState.HALF_OPEN
        
        # If circuit is open, fail fast
        if self.is_open:
            self.rejected_calls += 1
            error_msg = f"Circuit breaker {self.name} is open"
            logger.error(
                error_msg,
                failure_count=self.failure_count,
                last_failure=self.last_failure_time
            )
            raise Exception(error_msg)
        
        try:
            # Attempt the call
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # Record success
            self._record_success()
            return result
            
        except self.expected_exception as e:
            # Record failure
            self._record_failure()
            
            # If half-open, immediately open the circuit
            if self.is_half_open:
                logger.warning(
                    f"Circuit breaker {self.name} reopened after failure in half-open state"
                )
                self.state = CircuitState.OPEN
            
            raise e
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "recovery_timeout": self.recovery_timeout,
            "metrics": {
                "total_calls": self.total_calls,
                "successful_calls": self.successful_calls,
                "failed_calls": self.failed_calls,
                "rejected_calls": self.rejected_calls,
                "success_rate": (
                    self.successful_calls / self.total_calls 
                    if self.total_calls > 0 else 0
                ) * 100
            }
        }
    
    def reset(self):
        """Manually reset the circuit breaker"""
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        logger.info(f"Circuit breaker {self.name} manually reset")


class CircuitBreakerGroup:
    """Manage multiple circuit breakers"""
    
    def __init__(self):
        self.breakers: dict[str, CircuitBreaker] = {}
    
    def add_breaker(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: Optional[type] = None
    ) -> CircuitBreaker:
        """Add a new circuit breaker"""
        breaker = CircuitBreaker(
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
            expected_exception=expected_exception,
            name=name
        )
        self.breakers[name] = breaker
        return breaker
    
    def get_breaker(self, name: str) -> Optional[CircuitBreaker]:
        """Get circuit breaker by name"""
        return self.breakers.get(name)
    
    def get_all_stats(self) -> dict:
        """Get stats for all circuit breakers"""
        return {
            name: breaker.get_stats()
            for name, breaker in self.breakers.items()
        }
    
    def reset_all(self):
        """Reset all circuit breakers"""
        for breaker in self.breakers.values():
            breaker.reset()
        logger.info("All circuit breakers reset")
    
    def get_open_breakers(self) -> list[str]:
        """Get list of open circuit breakers"""
        return [
            name for name, breaker in self.breakers.items()
            if breaker.is_open
        ]