VALID_INTAKE = {
    "summary": "Encurtador de URLs interno com redirecionamento de baixa latência e métricas.",
    "functional_requirements": ["Encurtar URL", "Redirecionar via short-code"],
    "considerations": "Sistema read-heavy, ~10 leituras por escrita.",
    "data_classification": "interna",
}


def payload(**overrides) -> dict:
    return {"title": "Encurtador de URL", "intake": VALID_INTAKE, **overrides}


async def test_create_and_get(client):
    res = await client.post("/api/diagrams", json=payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["canvas_state"] == {"nodes": [], "edges": [], "viewport": None}
    assert len(body["canvas_hash"]) == 64

    got = await client.get(f"/api/diagrams/{body['id']}")
    assert got.status_code == 200
    assert got.json()["title"] == "Encurtador de URL"


async def test_create_with_title_only(client):
    """Desenhar não exige intake — só o título é obrigatório."""
    res = await client.post("/api/diagrams", json={"title": "Só o título"})
    assert res.status_code == 201, res.text
    assert res.json()["intake"] is None

    listed = (await client.get("/api/diagrams")).json()
    assert listed[0]["has_intake"] is False


async def test_partial_intake_can_be_saved_and_ai_gate_stays_closed(client):
    shallow = {
        "summary": "Descrição ainda incompleta",
        "functional_requirements": [],
        "considerations": None,
        "data_classification": "interna",
    }
    res = await client.post("/api/diagrams", json=payload(intake=shallow))
    assert res.status_code == 201, res.text
    assert res.json()["intake"]["summary"] == "Descrição ainda incompleta"

    draft = await client.post("/api/exports/draft", json={"diagram_id": res.json()["id"]})
    assert draft.status_code == 409
    assert "complete o contexto" in draft.json()["detail"]


async def test_patch_canvas_state_changes_hash(client):
    created = (await client.post("/api/diagrams", json=payload())).json()

    canvas = {
        "nodes": [
            {
                "id": "n1",
                "type": "arch",
                "position": {"x": 0, "y": 0},
                "data": {"archetype": "client", "label": "Client (Web)", "name": "Client"},
            }
        ],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "simulation_params": {
            "base_rps": 3500,
            "traffic_multiplier": 1,
            "read_ratio": 0.9,
            "cache_hit_rate": 0.8,
            "p99_target_ms": 200,
            "availability_target_pct": None,
        },
    }
    res = await client.patch(f"/api/diagrams/{created['id']}", json={"canvas_state": canvas})
    assert res.status_code == 200
    body = res.json()
    assert body["canvas_state"]["nodes"][0]["id"] == "n1"
    assert body["canvas_state"]["simulation_params"]["base_rps"] == 3500
    assert body["canvas_hash"] != created["canvas_hash"]

    # intake também compõe o hash (cache dos juízes na Fase 4)
    new_intake = {**VALID_INTAKE, "summary": VALID_INTAKE["summary"] + " Agora com SLA revisado."}
    res2 = await client.patch(f"/api/diagrams/{created['id']}", json={"intake": new_intake})
    assert res2.json()["canvas_hash"] != body["canvas_hash"]


async def test_list_shows_only_own_diagrams(client):
    await client.post("/api/diagrams", json=payload())
    await client.post(
        "/api/diagrams",
        json=payload(title="De outra pessoa"),
        headers={"X-Dev-Email": "outra@local"},
    )

    mine = (await client.get("/api/diagrams")).json()
    assert [d["title"] for d in mine] == ["Encurtador de URL"]
    assert mine[0]["node_count"] == 0

    other = (await client.get("/api/diagrams", headers={"X-Dev-Email": "outra@local"})).json()
    assert [d["title"] for d in other] == ["De outra pessoa"]


async def test_cannot_access_others_diagram(client):
    created = (await client.post("/api/diagrams", json=payload())).json()
    res = await client.get(f"/api/diagrams/{created['id']}", headers={"X-Dev-Email": "outra@local"})
    assert res.status_code == 404  # não revela existência


async def test_delete(client):
    created = (await client.post("/api/diagrams", json=payload())).json()
    assert (await client.delete(f"/api/diagrams/{created['id']}")).status_code == 204
    assert (await client.get(f"/api/diagrams/{created['id']}")).status_code == 404
