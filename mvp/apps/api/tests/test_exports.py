"""Export pré-ADR: rascunho IA (fixture), render Jinja2 e artefatos no MinIO."""

import httpx

INTAKE = {
    "summary": "Encurtador de URLs interno com redirecionamento de baixa latência e métricas.",
    "functional_requirements": ["Encurtar URL", "Redirecionar via short-code"],
    "considerations": "Sistema read-heavy, ~10 leituras por escrita.",
    "data_classification": "interna",
}

CANVAS = {
    "nodes": [
        {
            "id": "c1",
            "type": "arch",
            "position": {"x": 0, "y": 0},
            "data": {"archetype": "client", "label": "Client (Web)", "name": "Cliente"},
        },
        {
            "id": "app",
            "type": "arch",
            "position": {"x": 200, "y": 0},
            "data": {"archetype": "app-server", "label": "App Server", "name": "redirector"},
        },
        {
            "id": "note",
            "type": "annotation",
            "position": {"x": 0, "y": 100},
            "data": {"text": "mapeia short-code para URL"},
        },
    ],
    "edges": [
        {"id": "e1", "source": "c1", "target": "app", "data": {"intent": "request"}},
        {"id": "a1", "source": "note", "target": "app", "data": {"intent": "annotation"}},
    ],
    "viewport": None,
}

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


async def test_export_renders_md_and_uploads(client, seed_archetypes):
    created = (
        await client.post("/api/diagrams", json={"title": "Encurtador de URL", "intake": INTAKE})
    ).json()
    await client.patch(f"/api/diagrams/{created['id']}", json={"canvas_state": CANVAS})
    await client.post(  # última simulação entra na seção Validação
        "/api/simulation/run",
        json={"diagram_id": created["id"], "params": {"base_rps": 100}},
    )

    res = await client.post(
        "/api/exports",
        json={
            "diagram_id": created["id"],
            "sections": {
                "context": "Contexto revisado.",
                "decision": "Decisão X.",
                "consequences": "Consequências Y.",
            },
            "png_data_url": TINY_PNG,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["png_url"] is not None
    assert body["mermaid_url"]

    md = httpx.get(body["md_url"]).text
    assert "# Encurtador de URL" in md
    assert "- Encurtar URL" in md  # requisitos do intake
    assert "| redirector |" in md  # tabela de componentes
    assert "mapeia short-code" in md  # comentário do autor
    assert "RPS total" in md  # resumo da simulação
    assert "Contexto revisado." in md and "Decisão X." in md
    assert "_Diagrama ainda não avaliado pelo Juiz IA._" in md

    mermaid = httpx.get(body["mermaid_url"]).text
    assert mermaid.startswith("flowchart LR\n")
    assert 'n0["Cliente<br/>Client (Web)"]' in mermaid
    assert 'n0 -->|"request"| n1' in mermaid
    assert 'n2["mapeia short-code para URL"]:::comment' in mermaid
    assert "n2 -.-> n1" in mermaid

    listed = (await client.get("/api/exports", params={"diagram_id": created["id"]})).json()
    assert len(listed) == 1


async def test_export_works_without_intake(client):
    created = (await client.post("/api/diagrams", json={"title": "Sem contexto"})).json()
    res = await client.post("/api/exports", json={"diagram_id": created["id"]})
    assert res.status_code == 201
    md = httpx.get(res.json()["md_url"]).text
    assert "_a preencher_" in md


async def test_preview_uses_current_canvas_without_creating_export(client):
    created = (
        await client.post(
            "/api/diagrams",
            json={
                "title": "Prévia local",
                "intake": {"summary": "Rascunho ainda incompleto"},
            },
        )
    ).json()
    preview_canvas = {
        **CANVAS,
        "nodes": [
            *CANVAS["nodes"],
            {
                "id": "preview",
                "type": "arch",
                "position": {"x": 400, "y": 0},
                "data": {"archetype": "cache", "label": "Cache", "name": "Só na prévia"},
            },
        ],
    }

    res = await client.post(
        "/api/exports/preview",
        json={
            "diagram_id": created["id"],
            "sections": {
                "context": "Antes de gerar.",
                "decision": "Revisar.",
                "consequences": "Nenhum arquivo ainda.",
            },
            "canvas_state": preview_canvas,
        },
    )
    assert res.status_code == 200, res.text
    assert "# Prévia local" in res.json()["markdown"]
    assert "Só na prévia" in res.json()["markdown"]
    assert "None" not in res.json()["markdown"]
    assert "**Considerações e restrições:** _a preencher_" in res.json()["markdown"]
    assert 'n3["Só na prévia<br/>Cache"]' in res.json()["mermaid"]

    listed = (await client.get("/api/exports", params={"diagram_id": created["id"]})).json()
    assert listed == []


async def test_mermaid_preview_preserves_visual_groups(client):
    created = (await client.post("/api/diagrams", json={"title": "Grupos"})).json()
    canvas = {
        "nodes": [
            {
                "id": "group",
                "type": "visualGroup",
                "position": {"x": 0, "y": 0},
                "data": {"name": "Camada transacional", "width": 500, "height": 300},
            },
            {
                "id": "app",
                "type": "arch",
                "position": {"x": 100, "y": 100},
                "data": {"archetype": "app-server", "label": "App Server", "name": "API"},
            },
        ],
        "edges": [],
    }

    res = await client.post(
        "/api/exports/preview",
        json={"diagram_id": created["id"], "canvas_state": canvas},
    )
    assert res.status_code == 200, res.text
    mermaid = res.json()["mermaid"]
    assert 'subgraph g0["Camada transacional"]' in mermaid
    assert 'n0["API<br/>App Server"]' in mermaid
    assert "style g0 fill:transparent" in mermaid


async def test_draft_requires_intake_and_uses_fixture(client):
    no_intake = (await client.post("/api/diagrams", json={"title": "Sem contexto"})).json()
    res = await client.post("/api/exports/draft", json={"diagram_id": no_intake["id"]})
    assert res.status_code == 409

    with_intake = (
        await client.post("/api/diagrams", json={"title": "Com contexto", "intake": INTAKE})
    ).json()
    res = await client.post("/api/exports/draft", json={"diagram_id": with_intake["id"]})
    assert res.status_code == 200
    draft = res.json()
    assert draft["context"] and draft["decision"] and draft["consequences"]
