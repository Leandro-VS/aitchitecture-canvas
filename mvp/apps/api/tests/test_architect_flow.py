"""Fluxo do Arquiteto com fixtures: chat SSE, apply/dismiss e bootstrap."""

import json

INTAKE = {
    "summary": "Assistente de atendimento com RAG respondendo clientes externos via chat.",
    "functional_requirements": ["Responder perguntas"],
    "considerations": "Canal externo com dados confidenciais.",
    "data_classification": "confidencial",
}

CANVAS = {
    "nodes": [
        {"id": "c1", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "client", "label": "Client (Web)", "name": "Cliente"}},
        {"id": "app", "type": "arch", "position": {"x": 100, "y": 0},
         "data": {"archetype": "app-server", "label": "App Server", "name": "App"}},
        {"id": "rag", "type": "arch", "position": {"x": 150, "y": 0},
         "data": {"archetype": "rag-retriever", "label": "RAG Retriever", "name": "RAG"}},
        {"id": "gw", "type": "arch", "position": {"x": 200, "y": 0},
         "data": {"archetype": "llm-gateway", "label": "LLM Gateway", "name": "Gateway LLM"}},
    ],
    "edges": [
        {"id": "e1", "source": "c1", "target": "app", "data": {"intent": "request"}},
        {"id": "e2", "source": "app", "target": "rag", "data": {"intent": "retrieval"}},
        {"id": "e3", "source": "rag", "target": "gw", "data": {"intent": "ai_call"}},
    ],
    "viewport": None,
}


async def collect_sse(client, url: str, payload: dict) -> dict[str, list[str]]:
    events: dict[str, list[str]] = {}
    current = "message"
    async with client.stream("POST", url, json=payload) as res:
        assert res.status_code == 200, await res.aread()
        async for line in res.aiter_lines():
            if line.startswith("event:"):
                current = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                events.setdefault(current, []).append(line.split(":", 1)[1].strip())
    return events


async def test_chat_streams_and_proposes_valid_diff(client, indexed_corpus):
    created = (
        await client.post("/api/diagrams", json={"title": "RAG", "intake": INTAKE})
    ).json()
    events = await collect_sse(client, "/api/architect/chat", {
        "diagram_id": created["id"],
        "message": "Como protejo a saída do LLM?",
        "canvas_state": CANVAS,
    })

    text = " ".join(events["token"])
    assert "SEC-012" in text
    diff = json.loads(events["proposed_diff"][0])
    ops = diff["ops"]
    assert ops[0]["op"] == "add_node" and ops[0]["archetype"] == "output-guardrail"
    assert ops[1]["source"] == "rag"  # pipeline RAG chama e recebe a decisão

    # histórico persistido (user + assistant com diff proposto)
    messages = (
        await client.get("/api/architect/messages", params={"diagram_id": created["id"]})
    ).json()
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[1]["diff_status"] == "proposed"

    # apply registra o aceite (H3)
    applied = await client.post(f"/api/architect/diffs/{messages[1]['id']}/apply")
    assert applied.json()["diff_status"] == "applied"


async def test_chat_requires_intake(client):
    created = (await client.post("/api/diagrams", json={"title": "Sem contexto"})).json()
    res = await client.post(
        "/api/architect/chat", json={"diagram_id": created["id"], "message": "oi"}
    )
    assert res.status_code == 409


async def test_bootstrap_prefill_marks_inferred_fields(client):
    res = await client.post(
        "/api/architect/bootstrap/prefill",
        json={"text": "Quero um assistente de atendimento com RAG para clientes."},
    )
    assert res.status_code == 200, res.text
    intake = res.json()
    assert len(intake["summary"]) >= 40
    assert "summary" in intake["inferred_fields"]


async def test_bootstrap_sketch_returns_valid_diff(client, indexed_corpus):
    created = (
        await client.post("/api/diagrams", json={"title": "Bootstrap", "intake": INTAKE})
    ).json()
    res = await client.post(
        "/api/architect/bootstrap/sketch", json={"diagram_id": created["id"]}
    )
    assert res.status_code == 200, res.text
    diff = res.json()
    adds = [op for op in diff["ops"] if op["op"] == "add_node"]
    assert 1 <= len(adds) <= 25
    assert any(op["archetype"] == "guardrails" for op in adds)
    assert diff["citations"], "esboço deve citar guidelines (D15)"

    # vira o 1º turno do chat
    messages = (
        await client.get("/api/architect/messages", params={"diagram_id": created["id"]})
    ).json()
    assert messages[-1]["diff_status"] == "applied"
