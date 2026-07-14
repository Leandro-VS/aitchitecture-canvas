from collections.abc import AsyncIterator
from typing import Any, Protocol


class LLMClient(Protocol):
    """Contrato único de LLM (§3.2 do doc completo).

    Nenhum módulo de feature conhece o provider — juiz, arquiteto, bootstrap e
    indexação falam só com esta interface. MVP: apenas MockLLMClient.
    """

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict] | None = None,
        json_schema: dict | None = None,
        feature: str,
    ) -> dict: ...

    def chat_stream(
        self, messages: list[dict[str, Any]], *, feature: str
    ) -> AsyncIterator[str]: ...

    async def embed(self, texts: list[str], *, feature: str) -> list[list[float]]: ...
