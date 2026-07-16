"""Pipeline do Juiz com fixture mock: serializa → RAG → parse validado → persiste."""

import uuid

from conftest import _state
from sqlalchemy import select

from blueprint.db.models import Diagram, JudgeFinding, JudgeRun
from blueprint.judges.run import execute_judge_run

INTAKE = {
    "summary": "Assistente de atendimento com RAG respondendo clientes externos via chat.",
    "functional_requirements": ["Responder perguntas", "Escalar para humano"],
    "considerations": "Canal externo, dados confidenciais de clientes.",
    "data_classification": "confidencial",
    "out_of_scope": None,
    "inferred_fields": [],
}

CANVAS = {
    "nodes": [
        {"id": "c1", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "client", "label": "Client (Web)", "name": "Cliente"}},
        {"id": "gw", "type": "arch", "position": {"x": 200, "y": 0},
         "data": {"archetype": "llm-gateway", "label": "LLM Gateway", "name": "Gateway LLM"}},
        {"id": "db", "type": "arch", "position": {"x": 400, "y": 0},
         "data": {"archetype": "sql-db", "label": "SQL Database", "name": "pg"}},
    ],
    "edges": [
        {"id": "e1", "source": "c1", "target": "gw", "data": {"intent": "llm_call"}},
        {"id": "e2", "source": "gw", "target": "db", "data": {"intent": "request"}},
    ],
    "viewport": None,
}


async def test_judge_run_executes_with_mock_fixture(client, indexed_corpus):
    created = (
        await client.post("/api/diagrams", json={"title": "RAG atendimento", "intake": INTAKE})
    ).json()
    await client.patch(f"/api/diagrams/{created['id']}", json={"canvas_state": CANVAS})

    async with _state["maker"]() as session:
        diagram = await session.get(Diagram, uuid.UUID(created["id"]))
        run = JudgeRun(
            diagram_id=diagram.id,
            canvas_hash=diagram.canvas_hash,
            corpus_version=indexed_corpus,
        )
        session.add(run)
        await session.commit()

        await execute_judge_run(session, run, redis=None)

        assert run.status == "done"
        assert run.score == 74
        assert run.verdict == "borderline"
        findings = (
            await session.scalars(select(JudgeFinding).where(JudgeFinding.run_id == run.id))
        ).all()
        assert len(findings) == 4
        critical = next(f for f in findings if f.severity == "critical")
        assert critical.citation["doc_id"] == "SEC-012"
        assert critical.component_refs == ["gw"]  # archetype:llm-gateway resolvido
        general = [f for f in findings if f.basis == "general"]
        assert all(f.citation is None for f in general)
        run_id = run.id

    # API expõe o run com findings (polling do painel)
    res = await client.get(f"/api/judges/runs/{run_id}")
    assert res.status_code == 200
    assert res.json()["score"] == 74
    assert len(res.json()["findings"]) == 4

    # feedback e resolve (métricas H2)
    finding_id = res.json()["findings"][0]["id"]
    patched = await client.patch(f"/api/findings/{finding_id}", json={"feedback": "up"})
    assert patched.json()["feedback"] == "up"
    patched = await client.patch(f"/api/findings/{finding_id}", json={"resolved": True})
    assert patched.json()["resolved_at"] is not None


async def test_cached_payload_restores_into_fresh_run(client, indexed_corpus):
    """Caminho do cache: findings clonados num run novo, ainda não flushado."""
    from blueprint.judges.run import restore_cached_run

    created = (
        await client.post("/api/diagrams", json={"title": "Cache path", "intake": INTAKE})
    ).json()
    payload = {
        "score": 74, "verdict": "borderline", "strengths": ["ok"],
        "findings": [{
            "severity": "critical", "basis": "guideline",
            "citation": {"doc_id": "SEC-012", "section": "Regra", "excerpt": "x"},
            "component_refs": ["gw"], "recommendation": "adicione guardrail",
        }],
    }
    async with _state["maker"]() as session:
        run = JudgeRun(
            diagram_id=uuid.UUID(created["id"]), canvas_hash="h" * 64, corpus_version=None
        )
        session.add(run)
        await session.flush()  # mesmo contrato do router: id atribuído antes do restore
        await restore_cached_run(session, run, payload)
        await session.commit()
        findings = (
            await session.scalars(select(JudgeFinding).where(JudgeFinding.run_id == run.id))
        ).all()
        assert run.cached is True and run.score == 74
        assert len(findings) == 1
        assert findings[0].component_refs == ["gw"]


async def test_judge_requires_intake(client):
    created = (await client.post("/api/diagrams", json={"title": "Sem contexto"})).json()
    res = await client.post("/api/judges/run", json={"diagram_id": created["id"]})
    assert res.status_code == 409
    assert "intake" in res.json()["detail"]
