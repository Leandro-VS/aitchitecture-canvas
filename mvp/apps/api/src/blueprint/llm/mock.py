import hashlib
import json
import math
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from ..settings import settings


def stable_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def pseudo_embedding(text: str, dim: int) -> list[float]:
    """Vetor determinístico derivado do hash do texto.

    Sem semântica real — a busca lexical (FTS) é o caminho de retrieval no modo
    mock; a coluna vector fica preenchida para o schema ser idêntico ao de um
    provider real.
    """
    out: list[float] = []
    counter = 0
    while len(out) < dim:
        digest = hashlib.sha256(f"{text}:{counter}".encode()).digest()
        out.extend(b / 255.0 - 0.5 for b in digest)
        counter += 1
    vec = out[:dim]
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


class MockLLMClient:
    """Fixtures determinísticas (tutorial D14, testes e todo o MVP mock-only).

    Resolução da fixture: {feature}-{hash8 da última mensagem}.json, com
    fallback para {feature}-default.json.
    """

    def __init__(self, fixtures_dir: str | Path | None = None):
        self._dir = Path(fixtures_dir or settings.llm_fixtures_dir)

    def _fixture(self, feature: str, messages: list[dict[str, Any]]) -> dict:
        key = f"{feature}-{stable_hash(str(messages[-1].get('content', '')))[:8]}"
        for name in (f"{key}.json", f"{feature}-default.json"):
            path = self._dir / name
            if path.exists():
                return json.loads(path.read_text())
        raise FileNotFoundError(
            f"fixture não encontrada para feature={feature} em {self._dir} "
            f"(esperado {key}.json ou {feature}-default.json)"
        )

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict] | None = None,
        json_schema: dict | None = None,
        feature: str,
    ) -> dict:
        return self._fixture(feature, messages)

    async def chat_stream(
        self, messages: list[dict[str, Any]], *, feature: str
    ) -> AsyncIterator[str]:
        content = self._fixture(feature, messages).get("content", "")
        # streaming simulado: palavra a palavra, como um provider real entregaria tokens
        for word in content.split(" "):
            yield word + " "

    async def embed(self, texts: list[str], *, feature: str) -> list[list[float]]:
        return [pseudo_embedding(t, settings.embedding_dim) for t in texts]
