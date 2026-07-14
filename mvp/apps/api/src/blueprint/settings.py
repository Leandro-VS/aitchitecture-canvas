from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: Literal["local", "dev", "pilot", "prod"] = "local"

    database_url: str = "postgresql+asyncpg://blueprint:blueprint@localhost:5432/blueprint"
    redis_url: str = "redis://localhost:6379/0"

    s3_bucket: str = "blueprint-local"
    s3_endpoint_url: str | None = None  # MinIO no local; None = AWS

    # MVP: mock é o único provider implementado; iara/ollama entram pós-validação
    llm_provider: Literal["mock", "ollama", "iara"] = "mock"
    llm_fixtures_dir: str = "fixtures/llm"
    embedding_dim: int = 1024  # bge-m3 e cohere v3 = 1024 (schema pronto p/ provider real)

    auth_mode: Literal["stub", "oidc"] = "stub"
    dev_email: str = "dev@local"

    @model_validator(mode="after")
    def stub_only_local(self) -> "Settings":
        if self.auth_mode == "stub" and self.env != "local":
            raise ValueError("AUTH_MODE=stub é permitido apenas com ENV=local")
        if self.llm_provider != "mock" and self.env == "local":
            # provider real no local é permitido, mas ainda não implementado no MVP
            raise ValueError(f"llm_provider={self.llm_provider} ainda não implementado (MVP: mock)")
        return self


settings = Settings()
