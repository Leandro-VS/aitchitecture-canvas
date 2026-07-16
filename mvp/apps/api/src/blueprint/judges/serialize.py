"""Serialização canônica do diagrama para prompts de IA (§7.1 das specs).

Compacta e estável: intake + componentes (nome/subtítulo/arquétipo/réplicas) +
conexões com intents + comentários (D13, contexto autoritativo do autor) +
última simulação. Juiz (Fase 4), Arquiteto e bootstrap (Fase 5) leem daqui.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Diagram, SimulationRun


def _arch_nodes(canvas: dict) -> list[dict]:
    return [n for n in canvas.get("nodes", []) if n.get("type") != "annotation"]


def serialize_canvas(canvas: dict, intake: dict, last_simulation: dict | None) -> dict:
    nodes = _arch_nodes(canvas)
    name_of = {n["id"]: n.get("data", {}).get("name", n["id"]) for n in nodes}

    components = [
        {
            "id": n["id"],
            "name": n.get("data", {}).get("name", ""),
            "subtitle": n.get("data", {}).get("subtitle") or None,
            "archetype": n.get("data", {}).get("archetype", ""),
            "replicas": n.get("data", {}).get("replicas", 1),
        }
        for n in nodes
    ]
    connections = []
    annotations = []
    for e in canvas.get("edges", []):
        intent = (e.get("data") or {}).get("intent", "request")
        src, tgt = e.get("source"), e.get("target")
        if intent == "annotation":
            continue  # âncoras entram junto do comentário, abaixo
        if src in name_of and tgt in name_of:
            connections.append({"from": name_of[src], "intent": intent, "to": name_of[tgt]})

    anchor_of = {
        e["source"]: e["target"]
        for e in canvas.get("edges", [])
        if (e.get("data") or {}).get("intent") == "annotation"
    }
    for n in canvas.get("nodes", []):
        if n.get("type") == "annotation":
            text = (n.get("data") or {}).get("text", "").strip()
            if text:
                annotations.append(
                    {"text": text, "anchored_to": name_of.get(anchor_of.get(n["id"], ""))}
                )

    sim_summary = None
    if last_simulation:
        m = last_simulation
        sim_summary = {
            "params": m.get("params"),
            "total_rps": m.get("metrics", {}).get("total_rps"),
            "p99_ms": m.get("metrics", {}).get("p99_ms"),
            "error_rate": m.get("metrics", {}).get("error_rate"),
            "availability_pct": m.get("metrics", {}).get("availability_pct"),
            "bottleneck": name_of.get(m.get("metrics", {}).get("bottleneck")),
        }

    return {
        "intake": {k: v for k, v in intake.items() if k != "inferred_fields"},
        "components": components,
        "connections": connections,
        "annotations": annotations,
        "last_simulation": sim_summary,
    }


async def load_last_simulation(session: AsyncSession, diagram: Diagram) -> dict | None:
    run = await session.scalar(
        select(SimulationRun)
        .where(SimulationRun.diagram_id == diagram.id)
        .order_by(SimulationRun.created_at.desc())
        .limit(1)
    )
    return {"params": run.params, "metrics": run.metrics} if run else None


def resolve_component_refs(refs: list[str], canvas: dict) -> list[str]:
    """Fixtures (e LLMs) referenciam componentes por id, nome ou
    "archetype:<slug>" — resolve para ids reais do canvas atual; refs sem
    correspondência são descartadas (o finding permanece, sem highlight)."""
    nodes = _arch_nodes(canvas)
    resolved: list[str] = []
    for ref in refs:
        if ref.startswith("archetype:"):
            slug = ref.removeprefix("archetype:")
            resolved.extend(
                n["id"] for n in nodes if n.get("data", {}).get("archetype") == slug
            )
        else:
            for n in nodes:
                if n["id"] == ref or n.get("data", {}).get("name") == ref:
                    resolved.append(n["id"])
    return list(dict.fromkeys(resolved))  # dedupe preservando ordem
