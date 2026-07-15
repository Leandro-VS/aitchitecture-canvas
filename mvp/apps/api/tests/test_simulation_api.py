"""O endpoint de simulação aceita o canvas_state atual do editor (à frente do autosave)."""

def payload() -> dict:
    return {"title": "Simulável"}


CANVAS = {
    "nodes": [
        {"id": "c", "type": "arch", "position": {"x": 0, "y": 0},
         "data": {"archetype": "client", "label": "Client (Web)", "name": "Client"}},
        {"id": "app", "type": "arch", "position": {"x": 200, "y": 0},
         "data": {"archetype": "app-server", "label": "App Server", "name": "api"}},
    ],
    "edges": [{"id": "e1", "source": "c", "target": "app", "data": {"intent": "request"}}],
    "viewport": None,
}


async def test_simulation_uses_client_canvas_state(client, seed_archetypes):
    diagram = (await client.post("/api/diagrams", json=payload())).json()
    # canvas persistido está vazio; o editor envia o estado atual
    res = await client.post(
        "/api/simulation/run",
        json={"diagram_id": diagram["id"], "params": {"base_rps": 150}, "canvas_state": CANVAS},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_rps"] == 150
    assert body["nodes"]["app"]["rps"] == 150


async def test_simulation_falls_back_to_persisted_state(client, seed_archetypes):
    diagram = (await client.post("/api/diagrams", json=payload())).json()
    res = await client.post("/api/simulation/run", json={"diagram_id": diagram["id"]})
    assert res.status_code == 200
    assert res.json()["total_rps"] == 0  # canvas persistido vazio
