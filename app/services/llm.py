import json
from asyncio import Semaphore
from typing import AsyncGenerator

import httpx

from app.config import settings
from app.utils.exceptions import LLMTimeoutError, LLMUnavailableError, LLMResponseError

_llm_semaphore = Semaphore(1)


class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.model_name
        self.timeout = settings.timeout_seconds
        self.num_ctx = settings.num_ctx

    async def generate(
        self,
        prompt: str,
        system: str,
        temperature: float = 0.3,
        format_json: bool = False,
    ) -> str:
        async with _llm_semaphore:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_ctx": self.num_ctx,
                },
            }
            if format_json:
                payload["format"] = "json"

            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0)
                ) as client:
                    resp = await client.post(
                        f"{self.base_url}/api/generate", json=payload
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data.get("response", "")
            except httpx.TimeoutException:
                raise LLMTimeoutError()
            except httpx.ConnectError:
                raise LLMUnavailableError()
            except httpx.HTTPStatusError as e:
                raise LLMResponseError(f"HTTP {e.response.status_code}")

    async def generate_stream(
        self,
        prompt: str,
        system: str,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        async with _llm_semaphore:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system,
                "stream": True,
                "options": {
                    "temperature": temperature,
                    "num_ctx": self.num_ctx,
                },
            }
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0)
                ) as client:
                    async with client.stream(
                        "POST", f"{self.base_url}/api/generate", json=payload
                    ) as resp:
                        resp.raise_for_status()
                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                yield token
                            if chunk.get("done", False):
                                return
            except httpx.TimeoutException:
                raise LLMTimeoutError()
            except httpx.ConnectError:
                raise LLMUnavailableError()
            except httpx.HTTPStatusError as e:
                raise LLMResponseError(f"HTTP {e.response.status_code}")

    async def health_check(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                models = resp.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                return {
                    "ollama_available": True,
                    "model_loaded": self.model in model_names,
                    "available_models": model_names,
                }
        except Exception:
            return {"ollama_available": False, "model_loaded": False, "available_models": []}


ollama_client = OllamaClient()
