"""
Model Orchestrator for Multi-Model AI Support
Handles routing between Claude, GPT-4, Mistral, and Llama models
"""
import asyncio
from typing import Dict, Any, List, Optional, Union
from enum import Enum
import anthropic
import openai
from tenacity import retry, stop_after_attempt, wait_exponential
import httpx

from app.config import settings
from app.utils.logger import setup_logger
from app.utils.metrics import metrics_collector

logger = setup_logger(__name__)


class ModelType(str, Enum):
    """Supported AI model types"""
    CLAUDE = "claude"
    GPT4 = "gpt4"
    MISTRAL = "mistral"
    LLAMA = "llama"


class ModelCapability(str, Enum):
    """Model capabilities for routing"""
    GENERAL = "general"
    TECHNICAL = "technical"
    CREATIVE = "creative"
    ANALYSIS = "analysis"
    CODING = "coding"
    EXTRACTION = "extraction"


class ModelOrchestrator:
    """Orchestrates requests across multiple AI models"""
    
    def __init__(self):
        self.clients: Dict[str, Any] = {}
        self.model_configs = self._get_model_configs()
        self._initialize_clients()
        
    def _initialize_clients(self) -> None:
        """Initialize AI model clients"""
        try:
            # Initialize Claude (Anthropic)
            if settings.ANTHROPIC_API_KEY:
                self.clients[ModelType.CLAUDE] = anthropic.Anthropic(
                    api_key=settings.ANTHROPIC_API_KEY
                )
                logger.info("Claude client initialized")
            
            # Initialize GPT-4 (OpenAI)
            if settings.OPENAI_API_KEY:
                openai.api_key = settings.OPENAI_API_KEY
                self.clients[ModelType.GPT4] = openai
                logger.info("GPT-4 client initialized")
            
            # Initialize Mistral
            if settings.MISTRAL_API_KEY:
                self.clients[ModelType.MISTRAL] = httpx.AsyncClient(
                    base_url="https://api.mistral.ai/v1",
                    headers={"Authorization": f"Bearer {settings.MISTRAL_API_KEY}"}
                )
                logger.info("Mistral client initialized")
            
            # Initialize Llama (via Hugging Face or local)
            if settings.HUGGINGFACE_API_KEY:
                self.clients[ModelType.LLAMA] = httpx.AsyncClient(
                    base_url="https://api-inference.huggingface.co/models",
                    headers={"Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}"}
                )
                logger.info("Llama client initialized")
                
        except Exception as e:
            logger.error(f"Failed to initialize model clients: {e}")
            raise
    
    def _get_model_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get model configurations"""
        return {
            ModelType.CLAUDE: {
                "models": {
                    "default": "claude-3-opus-20240229",
                    "fast": "claude-3-haiku-20240307",
                    "balanced": "claude-3-sonnet-20240229"
                },
                "max_tokens": 4096,
                "capabilities": [
                    ModelCapability.GENERAL,
                    ModelCapability.TECHNICAL,
                    ModelCapability.ANALYSIS,
                    ModelCapability.CODING
                ]
            },
            ModelType.GPT4: {
                "models": {
                    "default": "gpt-4-turbo-preview",
                    "fast": "gpt-3.5-turbo",
                    "vision": "gpt-4-vision-preview"
                },
                "max_tokens": 4096,
                "capabilities": [
                    ModelCapability.GENERAL,
                    ModelCapability.CREATIVE,
                    ModelCapability.CODING
                ]
            },
            ModelType.MISTRAL: {
                "models": {
                    "default": "mistral-large-latest",
                    "fast": "mistral-small-latest",
                    "medium": "mistral-medium-latest"
                },
                "max_tokens": 8192,
                "capabilities": [
                    ModelCapability.TECHNICAL,
                    ModelCapability.EXTRACTION,
                    ModelCapability.ANALYSIS
                ]
            },
            ModelType.LLAMA: {
                "models": {
                    "default": "meta-llama/Llama-2-70b-chat-hf",
                    "fast": "meta-llama/Llama-2-13b-chat-hf",
                    "code": "codellama/CodeLlama-34b-Instruct-hf"
                },
                "max_tokens": 4096,
                "capabilities": [
                    ModelCapability.GENERAL,
                    ModelCapability.TECHNICAL,
                    ModelCapability.CODING
                ]
            }
        }
    
    async def generate(
        self,
        prompt: str,
        model_type: Optional[ModelType] = None,
        capability: Optional[ModelCapability] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate text using the appropriate model"""
        try:
            # Select model based on capability if not specified
            if not model_type:
                model_type = self._select_model(capability)
            
            # Validate model is available
            if model_type not in self.clients:
                raise ValueError(f"Model {model_type} not available")
            
            # Get model config
            config = self.model_configs[model_type]
            max_tokens = max_tokens or config["max_tokens"]
            temperature = temperature or settings.TEMPERATURE
            
            # Generate based on model type
            with metrics_collector.timer(f"{model_type}_generation"):
                if model_type == ModelType.CLAUDE:
                    response = await self._generate_claude(
                        prompt, system_prompt, max_tokens, temperature, **kwargs
                    )
                elif model_type == ModelType.GPT4:
                    response = await self._generate_gpt4(
                        prompt, system_prompt, max_tokens, temperature, **kwargs
                    )
                elif model_type == ModelType.MISTRAL:
                    response = await self._generate_mistral(
                        prompt, system_prompt, max_tokens, temperature, **kwargs
                    )
                elif model_type == ModelType.LLAMA:
                    response = await self._generate_llama(
                        prompt, system_prompt, max_tokens, temperature, **kwargs
                    )
                else:
                    raise ValueError(f"Unknown model type: {model_type}")
            
            metrics_collector.increment_counter(f"{model_type}_requests")
            return response
            
        except Exception as e:
            logger.error(f"Model generation error: {e}")
            metrics_collector.increment_error_count(f"{model_type}_error")
            raise
    
    def _select_model(self, capability: Optional[ModelCapability]) -> ModelType:
        """Select best model for the capability"""
        if not capability:
            return ModelType.CLAUDE  # Default to Claude
        
        # Model preference by capability
        capability_preferences = {
            ModelCapability.GENERAL: ModelType.CLAUDE,
            ModelCapability.TECHNICAL: ModelType.MISTRAL,
            ModelCapability.CREATIVE: ModelType.GPT4,
            ModelCapability.ANALYSIS: ModelType.CLAUDE,
            ModelCapability.CODING: ModelType.CLAUDE,
            ModelCapability.EXTRACTION: ModelType.MISTRAL
        }
        
        preferred = capability_preferences.get(capability, ModelType.CLAUDE)
        
        # Check if preferred model is available
        if preferred in self.clients:
            return preferred
        
        # Fallback to any available model
        for model_type in [ModelType.CLAUDE, ModelType.GPT4, ModelType.MISTRAL, ModelType.LLAMA]:
            if model_type in self.clients:
                return model_type
        
        raise ValueError("No models available")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _generate_claude(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using Claude"""
        client = self.clients[ModelType.CLAUDE]
        
        messages = [{"role": "user", "content": prompt}]
        
        response = await asyncio.to_thread(
            client.messages.create,
            model=self.model_configs[ModelType.CLAUDE]["models"]["default"],
            messages=messages,
            system=system_prompt or "You are a helpful AI assistant.",
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )
        
        return {
            "model": ModelType.CLAUDE,
            "content": response.content[0].text,
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            "metadata": {
                "model_version": response.model,
                "stop_reason": response.stop_reason
            }
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _generate_gpt4(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using GPT-4"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await asyncio.to_thread(
            openai.ChatCompletion.create,
            model=self.model_configs[ModelType.GPT4]["models"]["default"],
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )
        
        return {
            "model": ModelType.GPT4,
            "content": response.choices[0].message.content,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            "metadata": {
                "model_version": response.model,
                "finish_reason": response.choices[0].finish_reason
            }
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _generate_mistral(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using Mistral"""
        client = self.clients[ModelType.MISTRAL]
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await client.post(
            "/chat/completions",
            json={
                "model": self.model_configs[ModelType.MISTRAL]["models"]["default"],
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                **kwargs
            }
        )
        
        data = response.json()
        
        return {
            "model": ModelType.MISTRAL,
            "content": data["choices"][0]["message"]["content"],
            "usage": data.get("usage", {}),
            "metadata": {
                "model_version": data["model"],
                "finish_reason": data["choices"][0].get("finish_reason")
            }
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _generate_llama(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using Llama"""
        client = self.clients[ModelType.LLAMA]
        
        # Format prompt for Llama
        full_prompt = f"[INST] {system_prompt or 'You are a helpful assistant.'}\n\n{prompt} [/INST]"
        
        response = await client.post(
            f"/{self.model_configs[ModelType.LLAMA]['models']['default']}",
            json={
                "inputs": full_prompt,
                "parameters": {
                    "max_new_tokens": max_tokens,
                    "temperature": temperature,
                    **kwargs
                }
            }
        )
        
        data = response.json()
        
        return {
            "model": ModelType.LLAMA,
            "content": data[0]["generated_text"],
            "usage": {
                "total_tokens": len(full_prompt.split()) + len(data[0]["generated_text"].split())
            },
            "metadata": {
                "model_version": self.model_configs[ModelType.LLAMA]["models"]["default"]
            }
        }
    
    async def ensemble_generate(
        self,
        prompt: str,
        models: Optional[List[ModelType]] = None,
        voting_method: str = "majority",
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using multiple models and combine results"""
        try:
            # Use all available models if not specified
            if not models:
                models = list(self.clients.keys())
            
            # Generate from all models in parallel
            tasks = []
            for model in models:
                task = self.generate(prompt, model_type=model, **kwargs)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter out errors
            valid_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Model {models[i]} failed: {result}")
                else:
                    valid_results.append(result)
            
            if not valid_results:
                raise ValueError("All models failed")
            
            # Combine results based on voting method
            if voting_method == "majority":
                return self._majority_voting(valid_results)
            elif voting_method == "confidence":
                return self._confidence_weighted(valid_results)
            else:
                return self._best_response(valid_results)
                
        except Exception as e:
            logger.error(f"Ensemble generation error: {e}")
            raise
    
    def _majority_voting(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Combine results using majority voting"""
        # For simplicity, return the most common response
        # In practice, this would be more sophisticated
        return {
            "model": "ensemble",
            "content": results[0]["content"],
            "ensemble_results": results,
            "method": "majority_voting"
        }
    
    def _confidence_weighted(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Combine results weighted by confidence"""
        # For now, return the first result
        # In practice, would calculate confidence scores
        return {
            "model": "ensemble",
            "content": results[0]["content"],
            "ensemble_results": results,
            "method": "confidence_weighted"
        }
    
    def _best_response(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Select the best response from results"""
        # Simple selection based on response length
        # In practice, would use quality metrics
        best = max(results, key=lambda x: len(x["content"]))
        
        return {
            "model": "ensemble",
            "content": best["content"],
            "selected_model": best["model"],
            "ensemble_results": results,
            "method": "best_response"
        }
    
    async def close(self) -> None:
        """Close all client connections"""
        for model_type, client in self.clients.items():
            if hasattr(client, "close"):
                await client.close()
        
        logger.info("Model orchestrator closed")