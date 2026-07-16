"""Parse validado da resposta do LLM com re-ask em caso de contrato violado.

Structured output reduz mas não zera JSON fora do contrato; um re-ask com o
erro do Pydantic resolve a quase totalidade nos providers reais. No mock, o
retry devolve a mesma fixture — se ela violar o schema, é bug de fixture e o
erro deve estourar mesmo.
"""

import json
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from .base import LLMClient

T = TypeVar("T", bound=BaseModel)


class LLMContractError(Exception):
    def __init__(self, model_name: str, last_error: str):
        super().__init__(f"resposta do LLM não satisfez {model_name}: {last_error}")
        self.last_error = last_error


def _extract_payload(raw: dict) -> Any:
    """Aceita {"content": {...}} (fixtures/mock) ou {"content": "json string"}."""
    content = raw.get("content", raw)
    if isinstance(content, str):
        return json.loads(content)
    return content


async def parse_with_retry(
    model_cls: type[T],
    llm: LLMClient,
    messages: list[dict],
    *,
    feature: str,
    retries: int = 2,
) -> T:
    last_error = ""
    convo = list(messages)
    for _ in range(retries + 1):
        raw = await llm.chat(
            convo, json_schema=model_cls.model_json_schema(), feature=feature
        )
        try:
            return model_cls.model_validate(_extract_payload(raw))
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            convo = [
                *convo,
                {"role": "assistant", "content": json.dumps(raw, default=str)},
                {
                    "role": "user",
                    "content": "A resposta anterior violou o schema. Erros:\n"
                    f"{last_error}\nResponda novamente APENAS com JSON válido.",
                },
            ]
    raise LLMContractError(model_cls.__name__, last_error)
