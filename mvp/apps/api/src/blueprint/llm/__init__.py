from ..settings import settings
from .base import LLMClient
from .mock import MockLLMClient

__all__ = ["LLMClient", "MockLLMClient", "make_llm_client"]


def make_llm_client() -> LLMClient:
    """Switch único de provider do sistema (um código, N ambientes).

    MVP: só mock. IaraClient/OllamaClient entram pós-validação implementando
    a mesma interface — nenhum módulo de feature muda.
    """
    match settings.llm_provider:
        case "mock":
            return MockLLMClient()
        case other:
            raise NotImplementedError(f"llm_provider={other} fora do escopo do MVP")
