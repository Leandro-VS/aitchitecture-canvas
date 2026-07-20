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
    if bool(data.get("capacityManagedExternally")):
        parts.append("Fora da simulação")
    return "<br/>".join(_escape(part) for part in parts)


def _number(value: Any, fallback: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _containing_group(
    node: Mapping[str, Any], groups: list[Mapping[str, Any]]
) -> str | None:
    """Associa visualmente pelo ponto superior esquerdo; o menor grupo vence sobreposições."""
    position = _mapping(node.get("position"))
    x = _number(position.get("x"))
    y = _number(position.get("y"))
    matches: list[tuple[float, str]] = []
    for group in groups:
        group_position = _mapping(group.get("position"))
        data = _mapping(group.get("data"))
        left = _number(group_position.get("x"))
        top = _number(group_position.get("y"))
        width = max(0, _number(data.get("width"), 480))
        height = max(0, _number(data.get("height"), 280))
        if left <= x <= left + width and top <= y <= top + height:
            matches.append((width * height, str(group.get("id"))))
    return min(matches)[1] if matches else None


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
    groups = [node for node in nodes if node.get("type") == "visualGroup"]
    diagram_nodes = [node for node in nodes if node.get("type") != "visualGroup"]
    node_ids: dict[str, str] = {}
    definitions: dict[str, str] = {}
    has_annotations = False
    for index, node in enumerate(diagram_nodes):
        raw_id = node.get("id")
        if raw_id is None or str(raw_id) in node_ids:
            continue
        mermaid_id = f"n{index}"
        node_ids[str(raw_id)] = mermaid_id
        label = _node_label(node)
        if node.get("type") == "annotation":
            has_annotations = True
            definitions[str(raw_id)] = f'{mermaid_id}["{label}"]:::comment'
        else:
            definitions[str(raw_id)] = f'{mermaid_id}["{label}"]'

    grouped_ids: set[str] = set()
    group_styles: list[str] = []
    for group_index, group in enumerate(groups):
        raw_group_id = str(group.get("id"))
        data = _mapping(group.get("data"))
        mermaid_group_id = f"g{group_index}"
        lines.append(f'  subgraph {mermaid_group_id}["{_escape(data.get("name") or "Grupo")}"]')
        for node in diagram_nodes:
            raw_id = str(node.get("id"))
            if raw_id in grouped_ids or raw_id not in definitions:
                continue
            if _containing_group(node, groups) == raw_group_id:
                lines.append(f"    {definitions[raw_id]}")
                grouped_ids.add(raw_id)
        lines.append("  end")
        group_styles.append(
            f"  style {mermaid_group_id} fill:transparent,stroke:#E8622C,"
            "stroke-width:2px,stroke-dasharray:6 4"
        )

    for node in diagram_nodes:
        raw_id = str(node.get("id"))
        if raw_id in definitions and raw_id not in grouped_ids:
            lines.append(f"  {definitions[raw_id]}")

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
    lines.extend(group_styles)
    return "\n".join(lines) + "\n"
