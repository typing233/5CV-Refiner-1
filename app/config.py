from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    model_name: str = "qwen2:7b-instruct-q4_0"
    max_tokens: int = 4096
    timeout_seconds: int = 120
    max_file_size_mb: int = 5
    num_ctx: int = 4096
    eval_temperature: float = 0.3
    opt_temperature: float = 0.7
    max_retries: int = 2
    host: str = "0.0.0.0"
    port: int = 8080

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "protected_namespaces": ()}


settings = Settings()
