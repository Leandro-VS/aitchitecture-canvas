"""Renderização cloud-agnostic do canvas no formato Mermaid."""

from collections.abc import Mapping
from typing import Any


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _escape(value: Any) -> str:
    """Escapa texto para labels Mermaid entre aspas, mantendo quebras legíveis."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\r\n", "<br/>")
        .replace("\n", "<br/>")
        .replace("\r", "<br/>")
    )


def _node_label(node: Mapping[str, Any]) -> str:
    data = _mapping(node.get("data"))
    if node.get("type") == "annotation":
        return _escape(data.get("text") or "Comentário")

    name = str(data.get("name") or data.get("label") or data.get("archetype") or "Componente")
    parts = [name]
    label = str(data.get("label") or "").strip()
    subtitle = str(data.get("subtitle") or "").strip()
    if label and label.casefold() != name.casefold():
        parts.append(label)
    if subtitle:
        parts.append(subtitle)
    return "<br/>".join(_escape(part) for part in parts)


def render_mermaid(canvas_state: dict | None) -> str:
    """Converte o estado atual do React Flow em um flowchart Mermaid estável."""
    state = _mapping(canvas_state)
    raw_nodes = state.get("nodes")
    nodes = [
        node
        for node in (raw_nodes if isinstance(raw_nodes, list) else [])
        if isinstance(node, Mapping) and not bool(_mapping(node.get("data")).get("ghost"))
    ]

    lines = ["flowchart LR"]
    node_ids: dict[str, str] = {}
    has_annotations = False
    for index, node in enumerate(nodes):
        raw_id = node.get("id")
        if raw_id is None or str(raw_id) in node_ids:
            continue
        mermaid_id = f"n{index}"
        node_ids[str(raw_id)] = mermaid_id
        label = _node_label(node)
        if node.get("type") == "annotation":
            has_annotations = True
            lines.append(f'  {mermaid_id}["{label}"]:::comment')
        else:
            lines.append(f'  {mermaid_id}["{label}"]')

    raw_edges = state.get("edges")
    for edge in raw_edges if isinstance(raw_edges, list) else []:
        if not isinstance(edge, Mapping):
            continue
        data = _mapping(edge.get("data"))
        if bool(data.get("ghost")):
            continue
        source = node_ids.get(str(edge.get("source")))
        target = node_ids.get(str(edge.get("target")))
        if source is None or target is None:
            continue
        intent = str(data.get("intent") or "").strip()
        if intent == "annotation":
            lines.append(f"  {source} -.-> {target}")
        elif intent:
            lines.append(f'  {source} -->|"{_escape(intent)}"| {target}')
        else:
            lines.append(f"  {source} --> {target}")

    if not node_ids:
        lines.append("  %% Diagrama vazio")
    if has_annotations:
        lines.append(
            "  classDef comment fill:#fff7cc,stroke:#d59f0f,color:#3a2d00,"
            "stroke-dasharray: 4 3"
        )
    return "\n".join(lines) + "\n"
