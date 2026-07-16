import pytest

from blueprint.architect.diff import (
    InvalidDiff,
    ProposedDiff,
    prepare_diff,
    resolve_refs,
    truncate_sketch,
    validate_against_canvas,
)

CANVAS = {
    "nodes": [
        {"id": "gw", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "llm-gateway", "name": "Gateway LLM"}},
        {"id": "db", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "sql-db", "name": "pg"}},
    ],
    "edges": [],
}


def diff(ops: list[dict]) -> ProposedDiff:
    return ProposedDiff.model_validate({"rationale": "r", "ops": ops})


def test_resolve_semantic_refs_and_drop_unresolvable():
    d = diff([
        {"op": "add_node", "id": "new-g", "archetype": "guardrails", "name": "Guardrails"},
        {"op": "connect", "source": "archetype:llm-gateway", "target": "new-g",
         "intent": "validation"},
        {"op": "connect", "source": "archetype:semantic-cache", "target": "new-g"},  # não existe
        {"op": "update_metadata", "id": "pg", "fields": {"subtitle": "read replica"}},
    ])
    resolved = resolve_refs(d, CANVAS)
    kinds = [op.op for op in resolved.ops]
    assert kinds == ["add_node", "connect", "update_metadata"]  # conexão órfã descartada
    connect = resolved.ops[1]
    assert connect.source == "gw" and connect.target == "new-g"
    assert resolved.ops[2].id == "db"  # nome "pg" → id


def test_unknown_archetype_is_rejected():
    d = diff([{"op": "add_node", "id": "x", "archetype": "mainframe", "name": "X"}])
    with pytest.raises(InvalidDiff, match="arquétipo desconhecido"):
        validate_against_canvas(d, CANVAS)


def test_connect_to_unknown_node_is_rejected():
    d = diff([{"op": "connect", "source": "gw", "target": "fantasma"}])
    with pytest.raises(InvalidDiff, match="inexistente"):
        validate_against_canvas(d, CANVAS)


def test_prepare_diff_full_pipeline():
    payload = {
        "rationale": "guardrail de saída",
        "citations": [{"doc_id": "SEC-012", "section": "Regra", "excerpt": "x"}],
        "ops": [
            {"op": "add_node", "id": "new-g", "archetype": "guardrails", "name": "G"},
            {"op": "connect", "source": "archetype:llm-gateway", "target": "new-g",
             "intent": "validation"},
        ],
    }
    result = prepare_diff(payload, CANVAS)
    assert len(result.ops) == 2
    assert result.ops[1].source == "gw"


def test_truncate_sketch_prunes_orphan_connections():
    ops = [
        {"op": "add_node", "id": f"n{i}", "archetype": "app-server", "name": f"n{i}"}
        for i in range(30)
    ] + [
        {"op": "connect", "source": "n0", "target": "n1"},
        {"op": "connect", "source": "n0", "target": "n28"},  # n28 será cortado
    ]
    result = truncate_sketch(diff(ops))
    add_ids = {op.id for op in result.ops if op.op == "add_node"}
    assert len(add_ids) == 25
    connects = [op for op in result.ops if op.op == "connect"]
    assert len(connects) == 1  # a conexão com o nó cortado foi podada
