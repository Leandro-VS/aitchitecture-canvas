import pytest
from pydantic import ValidationError

from blueprint.judges.schemas import Citation, Finding
from blueprint.judges.serialize import resolve_component_refs, serialize_canvas


def test_guideline_finding_requires_citation():
    with pytest.raises(ValidationError, match="exige citation"):
        Finding(severity="critical", basis="guideline", citation=None, recommendation="x")


def test_general_finding_cannot_invent_citation():
    with pytest.raises(ValidationError, match="não pode ter citation"):
        Finding(
            severity="info",
            basis="general",
            citation=Citation(doc_id="SEC-012", section="Regra"),
            recommendation="x",
        )


def test_valid_findings_pass():
    Finding(
        severity="warning",
        basis="guideline",
        citation=Citation(doc_id="SEC-012", section="Regra", excerpt="…"),
        recommendation="adicione guardrail",
    )
    Finding(severity="info", basis="general", recommendation="análise geral")


CANVAS = {
    "nodes": [
        {"id": "n1", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "llm-gateway", "name": "Gateway LLM", "replicas": 2,
                  "capacityManagedExternally": True}},
        {"id": "n2", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "sql-db", "name": "pg-principal", "subtitle": "Write Only"}},
        {"id": "note1", "type": "annotation", "position": {"x": 0, "y": 0},
         "data": {"text": "banco X é mandatório (comitê)"}},
    ],
    "edges": [
        {"id": "e1", "source": "n1", "target": "n2", "data": {"intent": "request"}},
        {"id": "a1", "source": "note1", "target": "n2", "data": {"intent": "annotation"}},
    ],
}

INTAKE = {
    "summary": "s" * 40, "functional_requirements": ["r1"],
    "considerations": "c" * 20, "data_classification": "interna",
    "inferred_fields": [],
}


def test_serialize_canvas_includes_annotations_and_anchor():
    s = serialize_canvas(CANVAS, INTAKE, None)
    assert [c["name"] for c in s["components"]] == ["Gateway LLM", "pg-principal"]
    assert s["components"][0]["replicas"] == 2
    assert s["components"][0]["capacity_managed_externally"] is True
    assert s["components"][1]["capacity_managed_externally"] is False
    assert s["connections"] == [{"from": "Gateway LLM", "intent": "request", "to": "pg-principal"}]
    assert s["annotations"] == [
        {"text": "banco X é mandatório (comitê)", "anchored_to": "pg-principal"}
    ]
    assert "inferred_fields" not in s["intake"]


def test_resolve_component_refs_by_archetype_name_and_id():
    assert resolve_component_refs(["archetype:llm-gateway"], CANVAS) == ["n1"]
    assert resolve_component_refs(["pg-principal"], CANVAS) == ["n2"]
    assert resolve_component_refs(["n1", "inexistente"], CANVAS) == ["n1"]
    # dedupe: nome e archetype apontando pro mesmo nó
    assert resolve_component_refs(["Gateway LLM", "archetype:llm-gateway"], CANVAS) == ["n1"]
