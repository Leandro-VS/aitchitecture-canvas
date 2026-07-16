"""Busca do corpus via API: FTS acha o chunk certo e cita doc > seção (Fase 3)."""

async def test_search_cites_doc_and_section(client, indexed_corpus):
    res = await client.get("/api/corpus/search", params={"q": "guardrail de saída"})
    assert res.status_code == 200, res.text
    hits = res.json()
    assert hits, "busca não retornou nada"
    top = hits[0]
    assert top["doc_id"] == "SEC-012"
    assert top["citation"].startswith("SEC-012 > ")
    assert top["heading_path"] in {"Regra", "Racional", "Exceções"}


async def test_search_domain_filter(client, indexed_corpus):
    res = await client.get(
        "/api/corpus/search", params={"q": "gateway", "domain": ["security"]}
    )
    assert res.status_code == 200
    assert all(h["domain"] == "security" for h in res.json())


async def test_search_without_active_release_is_empty(client):
    res = await client.get("/api/corpus/search", params={"q": "guardrail"})
    assert res.status_code == 200
    assert res.json() == []


async def test_documents_lists_active_release(client, indexed_corpus):
    res = await client.get("/api/corpus/documents")
    assert {d["doc_id"] for d in res.json()} == {
        "SEC-012", "GENAI-001", "REF-ARCH-RAG-01", "REL-005", "REL-007"
    }
