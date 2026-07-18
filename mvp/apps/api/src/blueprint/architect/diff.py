"""ProposedDiff (M8/M13): o LLM nunca escreve no canvas — propõe um diff
validado que só vira desenho quando o usuário aplica (humano no loop por
construção). O mesmo schema serve ao chat (ghost nodes) e ao bootstrap
(esboço sobre canvas vazio).

Refs semânticas: fixtures (e LLMs) podem referenciar nós existentes por id,
nome ou "archetype:<slug>" — resolve_refs traduz para ids reais e descarta ops
que não se aplicam ao canvas atual (um roteiro genérico precisa degradar bem).
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from ..catalog import ARCHETYPE_IDS
from ..judges.schemas import Citation

# Intents genéricos: servem system design tradicional E sistemas com IA.
# request=síncrona · cache_lookup=consulta cache · async_message=fila/evento ·
# retrieval=busca em índice (search ou RAG) · ai_call=chamada a modelo/serviço
# de IA · validation=checagem (auth, regra de negócio, guardrail) ·
# telemetry=observação fora do caminho crítico · model_update=plano de controle
Intent = Literal[
    "request",
    "cache_lookup",
    "async_message",
    "dead_letter",
    "retrieval",
    "ai_call",
    "validation",
    "telemetry",
    "model_update",
]

MAX_SKETCH_NODES = 25


class AddNode(BaseModel):
    op: Literal["add_node"]
    id: str
    archetype: str
    name: str
    subtitle: str | None = None


class Connect(BaseModel):
    op: Literal["connect"]
    source: str
    target: str
    intent: Intent = "request"


class UpdateMetadata(BaseModel):
    op: Literal["update_metadata"]
    id: str
    fields: dict


class RemoveNode(BaseModel):
    op: Literal["remove_node"]
    id: str


DiffOp = Annotated[AddNode | Connect | UpdateMetadata | RemoveNode, Field(discriminator="op")]


class ProposedDiff(BaseModel):
    rationale: str
    citations: list[Citation] = []  # D15 vale também para o Arquiteto
    ops: list[DiffOp] = Field(max_length=60)


class InvalidDiff(Exception):
    pass


def _canvas_nodes(canvas: dict) -> list[dict]:
    return [n for n in canvas.get("nodes", []) if n.get("type") != "annotation"]


def _resolve_one(ref: str, canvas: dict, new_ids: set[str]) -> str | None:
    if ref in new_ids:
        return ref
    nodes = _canvas_nodes(canvas)
    if ref.startswith("archetype:"):
        slug = ref.removeprefix("archetype:")
        for n in nodes:
            if n.get("data", {}).get("archetype") == slug:
                return n["id"]
        return None
    for n in nodes:
        if n["id"] == ref or n.get("data", {}).get("name") == ref:
            return n["id"]
    return None


def resolve_refs(diff: ProposedDiff, canvas: dict) -> ProposedDiff:
    """Traduz refs semânticas para ids do canvas; ops sem alvo são descartadas
    (o diff permanece útil no que se aplica)."""
    new_ids = {op.id for op in diff.ops if isinstance(op, AddNode)}
    ops: list = []
    for op in diff.ops:
        if isinstance(op, AddNode):
            ops.append(op)
        elif isinstance(op, Connect):
            source = _resolve_one(op.source, canvas, new_ids)
            target = _resolve_one(op.target, canvas, new_ids)
            if source and target and source != target:
                ops.append(op.model_copy(update={"source": source, "target": target}))
        else:  # UpdateMetadata | RemoveNode
            resolved = _resolve_one(op.id, canvas, new_ids)
            if resolved:
                ops.append(op.model_copy(update={"id": resolved}))
    return diff.model_copy(update={"ops": ops})


def validate_against_canvas(diff: ProposedDiff, canvas: dict) -> ProposedDiff:
    """Validação estrita pós-resolução: arquétipos do catálogo, conexões entre
    nós conhecidos, ids de add_node inéditos."""
    existing = {n["id"] for n in _canvas_nodes(canvas)}
    known = set(existing)
    for op in diff.ops:
        if isinstance(op, AddNode):
            if op.archetype not in ARCHETYPE_IDS:
                raise InvalidDiff(f"arquétipo desconhecido: {op.archetype}")
            if op.id in known:
                raise InvalidDiff(f"add_node com id já existente: {op.id}")
            known.add(op.id)
    for op in diff.ops:
        if isinstance(op, Connect) and (op.source not in known or op.target not in known):
            raise InvalidDiff(f"conexão com nó inexistente: {op.source} -> {op.target}")
        if isinstance(op, UpdateMetadata | RemoveNode) and op.id not in known:
            raise InvalidDiff(f"op sobre nó inexistente: {op.id}")
    return diff


def truncate_sketch(diff: ProposedDiff, max_nodes: int = MAX_SKETCH_NODES) -> ProposedDiff:
    """Esboço ≠ arquitetura final: limita add_nodes e poda conexões órfãs."""
    kept_ids: set[str] = set()
    ops: list = []
    for op in diff.ops:
        if isinstance(op, AddNode):
            if len(kept_ids) >= max_nodes:
                continue
            kept_ids.add(op.id)
            ops.append(op)
        elif isinstance(op, Connect):
            if op.source in kept_ids and op.target in kept_ids:
                ops.append(op)
        else:
            ops.append(op)
    return diff.model_copy(update={"ops": ops})


def prepare_diff(payload: dict, canvas: dict) -> ProposedDiff:
    """Pipeline completo: parse → resolve refs → valida. Usado pelo chat."""
    diff = ProposedDiff.model_validate(payload)
    diff = resolve_refs(diff, canvas)
    return validate_against_canvas(diff, canvas)
