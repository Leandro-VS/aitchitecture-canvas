from hypothesis import given, settings
from hypothesis import strategies as st

from blueprint.catalog import CATALOG
from blueprint.simulation import SimParams, simulate
from blueprint.simulation.engine import ArchetypeSpec

SPECS = {
    item["archetype"]: ArchetypeSpec(
        archetype=item["archetype"],
        archetype_class=item["archetype_class"],
        base_rps=item["base_rps"],
        base_latency_ms=item["base_latency_ms"],
        params=item.get("params", {}),
    )
    for item in CATALOG
}


def node(nid: str, archetype: str, **data) -> dict:
    return {"id": nid, "type": "arch", "position": {"x": 0, "y": 0},
            "data": {"archetype": archetype, "name": nid, **data}}


def edge(src: str, tgt: str, intent: str = "request") -> dict:
    return {"id": f"{src}-{tgt}", "source": src, "target": tgt, "data": {"intent": intent}}


def canvas(nodes: list[dict], edges: list[dict]) -> dict:
    return {"nodes": nodes, "edges": edges, "viewport": None}


URL_SHORTENER = canvas(
    [node("client", "client"), node("app", "app-server"), node("db", "sql-db")],
    [edge("client", "app"), edge("app", "db")],
)


def test_deterministic():
    params = SimParams(base_rps=200, traffic_multiplier=3, read_ratio=0.9)
    a = simulate(URL_SHORTENER, params, SPECS)
    b = simulate(URL_SHORTENER, params, SPECS)
    assert a == b


def test_bottleneck_is_the_database():
    # 600 rps > 300 de capacidade do sql-db → gargalo com erro e latência degradada
    result = simulate(URL_SHORTENER, SimParams(base_rps=200, traffic_multiplier=3), SPECS)
    assert result.bottleneck == "db"
    db = result.nodes["db"]
    assert db.health == "critical"
    assert db.cpu == 2.0
    assert db.error_rate == 0.5
    assert result.availability_pct < 100
    assert any(t.severity == "critical" for t in result.tips)


def test_cache_absorbs_reads():
    with_cache = canvas(
        [node("client", "client"), node("app", "app-server"),
         node("cache", "cache"), node("db", "sql-db")],
        [edge("client", "app"), edge("app", "cache", "cache_lookup"), edge("app", "db")],
    )
    params = SimParams(base_rps=200, traffic_multiplier=3, read_ratio=0.9, cache_hit_rate=0.9)
    before = simulate(URL_SHORTENER, params, SPECS)
    after = simulate(with_cache, params, SPECS)
    # 600 rps: sem cache o db recebe 600; com cache recebe 600*(1-0.9*0.9)=114
    assert before.nodes["db"].rps == 600
    assert after.nodes["db"].rps == 114
    assert after.nodes["db"].health == "ok"
    assert after.bottleneck != "db"


def test_replicas_increase_capacity():
    scaled = canvas(
        [node("client", "client"), node("app", "app-server"), node("db", "sql-db", replicas=3)],
        [edge("client", "app"), edge("app", "db")],
    )
    result = simulate(scaled, SimParams(base_rps=200, traffic_multiplier=3), SPECS)
    assert result.nodes["db"].cpu == round(600 / 900, 4)
    assert result.nodes["db"].health == "ok"


def test_async_path_does_not_enter_p99():
    with_worker = canvas(
        [node("client", "client"), node("app", "app-server"),
         node("q", "message-queue"), node("wk", "worker")],
        [edge("client", "app"), edge("app", "q", "async_enqueue"),
         edge("q", "wk", "async_enqueue")],
    )
    result = simulate(with_worker, SimParams(), SPECS)
    # caminho síncrono: client(0) + app(25) + fila(8); worker (25ms) fora do p99
    assert result.p99_ms == 33
    assert result.nodes["wk"].rps == 100  # mas o tráfego chega nele


def test_annotations_and_cycles_are_safe():
    weird = canvas(
        [node("client", "client"), node("a", "app-server"), node("b", "app-server"),
         {"id": "note", "type": "annotation", "position": {"x": 0, "y": 0},
          "data": {"text": "comentário"}}],
        [edge("client", "a"), edge("a", "b"), edge("b", "a")],  # ciclo a<->b
    )
    result = simulate(weird, SimParams(), SPECS)
    assert "note" not in result.nodes
    assert result.p99_ms > 0  # terminou (ciclo não recircula nem trava)


def test_p99_target_generates_tip():
    result = simulate(
        URL_SHORTENER, SimParams(p99_target_ms=10, availability_target_pct=99.9), SPECS
    )
    assert any("acima do alvo" in t.message for t in result.tips)


def test_empty_canvas():
    result = simulate(canvas([], []), SimParams(), SPECS)
    assert result.total_rps == 0
    assert result.bottleneck is None


# --- propriedades (hypothesis) ---

ARCHETYPES = sorted(SPECS)


@st.composite
def random_canvas(draw):
    n = draw(st.integers(min_value=1, max_value=8))
    nodes = [node(f"n{i}", draw(st.sampled_from(ARCHETYPES))) for i in range(n)]
    edge_count = draw(st.integers(min_value=0, max_value=min(12, n * n)))
    edges = []
    for j in range(edge_count):
        s = draw(st.integers(min_value=0, max_value=n - 1))
        t = draw(st.integers(min_value=0, max_value=n - 1))
        if s != t:
            intent = draw(st.sampled_from(
                ["request", "cache_lookup", "async_enqueue", "llm_call", "retrieval"]))
            edges.append({"id": f"e{j}", "source": f"n{s}", "target": f"n{t}",
                          "data": {"intent": intent}})
    return canvas(nodes, edges)


@settings(max_examples=60, deadline=None)
@given(
    cv=random_canvas(),
    mult=st.floats(min_value=0.1, max_value=100),
    read_ratio=st.floats(min_value=0, max_value=1),
    hit=st.floats(min_value=0, max_value=1),
)
def test_engine_is_total_and_sane(cv, mult, read_ratio, hit):
    """Qualquer grafo (com ciclos, fan-out, sem client) produz resultado finito e coerente."""
    params = SimParams(traffic_multiplier=mult, read_ratio=read_ratio, cache_hit_rate=hit)
    result = simulate(cv, params, SPECS)
    assert result == simulate(cv, params, SPECS)  # determinismo
    assert 0 <= result.error_rate <= 1
    assert 0 <= result.availability_pct <= 100
    assert result.p99_ms >= result.avg_latency_ms >= 0
    for m in result.nodes.values():
        assert m.rps >= 0 and m.cpu >= 0 and m.latency_ms >= 0
        assert 0 <= m.error_rate < 1


@settings(max_examples=30, deadline=None)
@given(mult=st.floats(min_value=1, max_value=50))
def test_more_traffic_never_reduces_load(mult):
    base = simulate(URL_SHORTENER, SimParams(base_rps=200, traffic_multiplier=1), SPECS)
    more = simulate(URL_SHORTENER, SimParams(base_rps=200, traffic_multiplier=mult), SPECS)
    for nid in base.nodes:
        assert more.nodes[nid].rps >= base.nodes[nid].rps
        assert more.nodes[nid].cpu >= base.nodes[nid].cpu
