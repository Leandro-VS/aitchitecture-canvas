from hypothesis import given, settings
from hypothesis import strategies as st

from blueprint.catalog import CATALOG, CATEGORY_ORDER
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
    return {
        "id": nid,
        "type": "arch",
        "position": {"x": 0, "y": 0},
        "data": {"archetype": archetype, "name": nid, **data},
    }


def edge(src: str, tgt: str, intent: str = "request") -> dict:
    return {"id": f"{src}-{tgt}", "source": src, "target": tgt, "data": {"intent": intent}}


def canvas(nodes: list[dict], edges: list[dict]) -> dict:
    return {"nodes": nodes, "edges": edges, "viewport": None}


URL_SHORTENER = canvas(
    [node("client", "client"), node("app", "app-server"), node("db", "sql-db")],
    [edge("client", "app"), edge("app", "db")],
)


def test_catalog_keeps_ai_last_and_contains_medium_scale_components():
    categories = list(dict.fromkeys(item["category"] for item in CATALOG))
    archetypes = {item["archetype"] for item in CATALOG}
    category_by_archetype = {item["archetype"]: item["category"] for item in CATALOG}

    assert categories == CATEGORY_ORDER
    assert categories[-2] == "Machine Learning"
    assert categories[-1] == "AI & Agents"
    assert {
        "model-router",
        "model-endpoint-realtime",
        "model-endpoint-async",
        "model-endpoint-batch",
        "model-endpoint-serverless",
        "feature-store",
        "model-registry",
        "ml-training-pipeline",
        "model-monitoring",
        "rag-retriever",
        "tool-registry",
        "agent-memory",
        "prompt-store",
        "mcp-gateway",
        "llm-observability",
        "guardrails",
        "output-guardrail",
    } <= archetypes
    assert all(
        category_by_archetype[archetype] == "Machine Learning"
        for archetype in {
            "model-endpoint-realtime",
            "model-endpoint-async",
            "model-endpoint-batch",
            "model-endpoint-serverless",
            "feature-store",
            "model-registry",
            "ml-training-pipeline",
            "model-monitoring",
        }
    )
    assert {"dead-letter-queue", "dlq-worker"} <= archetypes
    assert all(item["description"].strip() for item in CATALOG)


def test_async_inference_turns_excess_work_into_backlog_without_online_errors():
    diagram = canvas(
        [node("client", "client"), node("async", "model-endpoint-async")],
        [edge("client", "async")],
    )

    result = simulate(diagram, SimParams(base_rps=1_000), SPECS)

    endpoint = result.nodes["async"]
    assert endpoint.profile == "Inferência assíncrona"
    assert endpoint.backlog_messages > 0
    assert endpoint.status == "backlogged"
    assert endpoint.error_rate == 0
    assert result.error_rate == 0
    assert result.availability_pct == 100


def test_batch_inference_is_offline_work_and_does_not_pollute_online_availability():
    diagram = canvas(
        [node("client", "client"), node("batch", "model-endpoint-batch")],
        [edge("client", "batch")],
    )

    result = simulate(diagram, SimParams(base_rps=1_000), SPECS)

    batch = result.nodes["batch"]
    assert batch.profile == "Processamento em lote"
    assert batch.backlog_messages > 0
    assert batch.error_rate == 0
    assert result.availability_pct == 100


def test_observability_sink_ignores_legacy_replica_and_scaling_properties():
    diagram = canvas(
        [
            node("client", "client"),
            node(
                "observer",
                "llm-observability",
                size="large",
                scaling="elastic",
                replicas=5,
                maxReplicas=20,
            ),
        ],
        [edge("client", "observer", "telemetry")],
    )

    result = simulate(diagram, SimParams(base_rps=100), SPECS)

    observer = result.nodes["observer"]
    assert observer.profile == "Observabilidade"
    assert observer.size == "large"
    assert observer.scaling == "fixed"
    assert observer.active_units == 1
    assert observer.max_units == 1
    assert observer.scaling_events == 0


def test_serverless_inference_exposes_cold_start_in_the_first_window():
    diagram = canvas(
        [node("client", "client"), node("endpoint", "model-endpoint-serverless")],
        [edge("client", "endpoint")],
    )

    result = simulate(diagram, SimParams(base_rps=100), SPECS)

    assert result.nodes["endpoint"].profile == "Inferência serverless"
    assert result.timeline[0].p99_ms > result.timeline[1].p99_ms
    assert result.timeline[0].p99_ms - result.timeline[1].p99_ms == 600


def test_model_observability_stays_out_of_the_online_latency_path():
    diagram = canvas(
        [
            node("client", "client"),
            node("app", "app-server"),
            node("monitor", "model-monitoring"),
        ],
        [edge("client", "app"), edge("app", "monitor")],
    )

    result = simulate(diagram, SimParams(base_rps=100), SPECS)

    assert result.nodes["monitor"].rps == 100
    assert result.p99_ms == result.nodes["app"].latency_ms


def test_deterministic():
    params = SimParams(base_rps=200, traffic_multiplier=3, read_ratio=0.9)
    a = simulate(URL_SHORTENER, params, SPECS)
    b = simulate(URL_SHORTENER, params, SPECS)
    assert a == b


def test_bottleneck_is_the_database():
    # Escritas custam mais work units no store stateful; 300 é a calibração
    # nominal por unidade, não um limite universal em RPS.
    result = simulate(URL_SHORTENER, SimParams(base_rps=200, traffic_multiplier=3), SPECS)
    assert result.bottleneck == "db"
    db = result.nodes["db"]
    assert db.health == "critical"
    assert db.cpu == 2.4
    assert db.capacity_rps == 250
    assert db.error_rate == 0.5833
    assert result.availability_pct < 100
    assert any(t.severity == "critical" for t in result.tips)


def test_cache_absorbs_reads():
    with_cache = canvas(
        [
            node("client", "client"),
            node("app", "app-server"),
            node("cache", "cache"),
            node("db", "sql-db"),
        ],
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
    assert result.nodes["db"].cpu == 0.8
    assert result.nodes["db"].capacity_rps == 750
    assert result.nodes["db"].health == "hot"


def test_async_path_does_not_enter_p99():
    with_worker = canvas(
        [
            node("client", "client"),
            node("app", "app-server"),
            node("q", "message-queue"),
            node("wk", "worker"),
        ],
        [
            edge("client", "app"),
            edge("app", "q", "async_enqueue"),
            edge("q", "wk", "async_enqueue"),
        ],
    )
    result = simulate(with_worker, SimParams(), SPECS)
    # caminho síncrono: client(0) + app(25) + fila(8); worker (25ms) fora do p99
    assert result.p99_ms == 33
    assert result.nodes["wk"].rps == 100  # mas o tráfego chega nele


def test_tutorial_bottlenecks_follow_the_progressive_story():
    base = canvas(
        [node("client", "client"), node("app", "app-server"), node("db", "nosql-db")],
        [edge("client", "app"), edge("app", "db")],
    )
    params = SimParams(
        base_rps=3500,
        read_ratio=0.9,
        cache_hit_rate=0.8,
        p99_target_ms=200,
    )

    initial = simulate(base, params, SPECS)
    assert initial.bottleneck == "app"
    assert initial.nodes["app"].cpu == 2.38
    assert initial.p99_ms > 200

    base["nodes"][1]["data"]["replicas"] = 3
    base["nodes"].append(node("lb", "load-balancer"))
    base["edges"] = [edge("client", "lb"), edge("lb", "app"), edge("app", "db")]
    scaled = simulate(base, params, SPECS)
    assert scaled.nodes["lb"].health == "ok"
    assert scaled.bottleneck == "db"
    assert scaled.nodes["app"].health == "hot"
    assert scaled.nodes["db"].health == "critical"
    assert scaled.p99_ms > 200

    base["nodes"].append(node("cache", "cache"))
    base["edges"].append(edge("app", "cache", "cache_lookup"))
    cached = simulate(base, params, SPECS)
    assert cached.nodes["db"].rps == 980
    assert cached.nodes["db"].health == "ok"
    assert cached.error_rate == 0
    assert cached.p99_ms < 200


def test_simulation_parameters_start_with_useful_targets():
    params = SimParams()

    assert params.capacity_profile == "nominal"
    assert params.base_rps == 100
    assert params.cache_hit_rate == 0.8
    assert params.p99_target_ms == 250
    assert params.availability_target_pct == 99.9


def test_size_and_capacity_profile_change_effective_capacity():
    large = canvas(
        [node("client", "client"), node("app", "app-server", size="large")],
        [edge("client", "app")],
    )
    nominal = simulate(large, SimParams(base_rps=1500), SPECS)
    conservative = simulate(
        large,
        SimParams(base_rps=1500, capacity_profile="conservative"),
        SPECS,
    )

    assert nominal.nodes["app"].size == "large"
    assert nominal.nodes["app"].capacity_rps > conservative.nodes["app"].capacity_rps
    assert nominal.nodes["app"].cpu < conservative.nodes["app"].cpu


def test_external_capacity_is_unbounded_but_keeps_latency_and_flow():
    managed_dependency = canvas(
        [
            node("client", "client"),
            node(
                "external",
                "app-server",
                capacityManagedExternally=True,
                size="small",
                scaling="elastic",
                replicas=1,
                maxReplicas=20,
            ),
            node("cache", "cache"),
        ],
        [edge("client", "external"), edge("external", "cache")],
    )

    result = simulate(managed_dependency, SimParams(base_rps=5_000), SPECS)

    external = result.nodes["external"]
    assert external.rps == 5_000
    assert external.capacity_rps is None
    assert external.cpu == 0
    assert external.error_rate == 0
    assert external.health == "ok"
    assert external.scaling == "fixed"
    assert external.active_units == 1
    assert external.max_units == 1
    assert external.scaling_events == 0
    assert external.latency_ms == 25
    assert external.profile == "Compute · Fora da simulação"
    assert result.nodes["cache"].rps == 5_000
    assert result.p99_ms == 27
    assert result.bottleneck is None

    managed_dependency["nodes"][1]["data"]["capacityManagedExternally"] = False
    included = simulate(managed_dependency, SimParams(base_rps=5_000), SPECS)
    assert included.nodes["external"].health == "critical"
    assert included.bottleneck == "external"


def test_elastic_scaling_reacts_after_delay_and_preserves_the_bad_interval():
    elastic = canvas(
        [
            node("client", "client"),
            node(
                "app",
                "app-server",
                scaling="elastic",
                replicas=1,
                maxReplicas=6,
            ),
        ],
        [edge("client", "app")],
    )
    result = simulate(elastic, SimParams(base_rps=3000, read_ratio=1), SPECS)

    assert result.nodes["app"].active_units == 3
    assert result.nodes["app"].scaling_events == 1
    assert result.nodes["app"].status == "throttled"  # o pico anterior não é apagado
    assert result.timeline[0].error_rate > 0
    assert result.timeline[-1].error_rate == 0
    assert result.scaling_events[0].second == 20


def test_queue_backlog_caps_worker_instead_of_inventing_worker_errors():
    queued = canvas(
        [
            node("queue", "message-queue"),
            node("worker", "worker", size="small"),
        ],
        [edge("queue", "worker", "async_message")],
    )
    result = simulate(queued, SimParams(base_rps=3000), SPECS)

    assert result.bottleneck == "queue"
    assert result.nodes["queue"].status == "backlogged"
    assert result.nodes["queue"].backlog_messages > 0
    assert result.nodes["worker"].rps < 3000
    assert result.nodes["worker"].cpu == 1
    assert result.nodes["worker"].error_rate == 0
    assert result.error_rate == 0


def test_hot_partition_and_cold_cache_are_temporal_scenarios():
    with_cache = canvas(
        [
            node("client", "client"),
            node("app", "app-server", replicas=2),
            node("cache", "cache"),
            node("db", "nosql-db"),
        ],
        [edge("client", "app"), edge("app", "cache", "cache_lookup"), edge("app", "db")],
    )
    steady = simulate(with_cache, SimParams(base_rps=2400, cache_hit_rate=0.9), SPECS)
    hot = simulate(
        with_cache,
        SimParams(base_rps=2400, cache_hit_rate=0.9, scenario="hot_partition"),
        SPECS,
    )
    cold = simulate(
        with_cache,
        SimParams(base_rps=2400, cache_hit_rate=0.9, scenario="cold_cache"),
        SPECS,
    )

    assert hot.nodes["db"].cpu > steady.nodes["db"].cpu
    assert cold.timeline[0].error_rate > cold.timeline[-1].error_rate
    assert cold.timeline[-1].backlog_messages == 0


def test_async_writes_and_dlq_receive_only_their_traffic_share():
    feed = canvas(
        [
            node("client", "client"),
            node("app", "app-server", replicas=3),
            node("cache", "cache"),
            node("db", "nosql-db"),
            node("queue", "message-queue"),
            node("worker", "worker"),
            node("dlq", "dead-letter-queue"),
            node("dlq-worker", "dlq-worker"),
        ],
        [
            edge("client", "app"),
            edge("app", "cache", "cache_lookup"),
            edge("app", "db"),
            edge("app", "queue", "async_message"),
            edge("queue", "worker", "async_message"),
            edge("worker", "db"),
            edge("worker", "dlq", "dead_letter"),
            edge("dlq", "dlq-worker", "async_message"),
        ],
    )
    result = simulate(
        feed,
        SimParams(base_rps=3500, read_ratio=0.9, cache_hit_rate=0.8),
        SPECS,
    )

    assert result.nodes["cache"].rps == 3150
    assert result.nodes["queue"].rps == 350
    assert result.nodes["worker"].rps == 350
    assert result.nodes["db"].rps == 976.5  # 630 misses + 99% das 350 escritas
    assert result.nodes["dlq"].rps == 3.5
    assert result.nodes["dlq-worker"].rps == 3.5
    assert result.error_rate == 0


def test_annotations_and_cycles_are_safe():
    weird = canvas(
        [
            node("client", "client"),
            node("a", "app-server"),
            node("b", "app-server"),
            {
                "id": "note",
                "type": "annotation",
                "position": {"x": 0, "y": 0},
                "data": {"text": "comentário"},
            },
        ],
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


def test_prompt_attack_without_guardrail_reaches_the_llm():
    diagram = canvas(
        [node("client", "client"), node("llm", "llm-gateway")],
        [edge("client", "llm", "ai_call")],
    )

    result = simulate(diagram, SimParams(base_rps=100, scenario="prompt_attack"), SPECS)

    assert result.nodes["llm"].rps == 100
    assert result.nodes["llm"].attack_rps == 30
    assert any("ataques" in tip.message for tip in result.tips)


def test_input_guardrail_blocks_single_turn_before_the_llm_but_not_multi_turn():
    diagram = canvas(
        [
            node("client", "client"),
            node("input", "guardrails"),
            node("llm", "llm-gateway"),
        ],
        [edge("client", "input", "validation"), edge("client", "llm", "ai_call")],
    )

    result = simulate(diagram, SimParams(base_rps=100, scenario="prompt_attack"), SPECS)

    assert result.nodes["input"].blocked_rps == 20
    assert result.nodes["llm"].rps == 80
    assert result.nodes["llm"].attack_rps == 10
    assert result.availability_pct == 100


def test_guardrail_engines_trade_capacity_latency_and_detection_coverage():
    current = canvas(
        [node("client", "client"), node("guard", "guardrails"), node("llm", "llm-gateway")],
        [edge("client", "guard", "validation"), edge("client", "llm", "ai_call")],
    )
    ml_history = canvas(
        [
            node("client", "client"),
            node(
                "guard",
                "guardrails",
                guardrailEngine="ml",
                guardrailScope="recent_history",
            ),
            node("llm", "llm-gateway"),
        ],
        [edge("client", "guard", "validation"), edge("client", "llm", "ai_call")],
    )
    generative_history = canvas(
        [
            node("client", "client"),
            node(
                "guard",
                "guardrails",
                guardrailEngine="generative",
                guardrailScope="recent_history",
            ),
            node("llm", "llm-gateway"),
        ],
        [edge("client", "guard", "validation"), edge("client", "llm", "ai_call")],
    )

    current_result = simulate(current, SimParams(base_rps=100, scenario="prompt_attack"), SPECS)
    ml_result = simulate(ml_history, SimParams(base_rps=100, scenario="prompt_attack"), SPECS)
    generative_result = simulate(
        generative_history,
        SimParams(base_rps=100, scenario="prompt_attack"),
        SPECS,
    )

    assert current_result.nodes["guard"].blocked_rps == 20
    assert ml_result.nodes["guard"].blocked_rps == 27.5
    assert generative_result.nodes["guard"].blocked_rps == 30
    assert current_result.nodes["llm"].attack_rps == 10
    assert ml_result.nodes["llm"].attack_rps == 2.5
    assert generative_result.nodes["llm"].attack_rps == 0
    assert (
        current_result.nodes["guard"].capacity_rps
        > ml_result.nodes["guard"].capacity_rps
        > generative_result.nodes["guard"].capacity_rps
    )
    assert (
        current_result.nodes["guard"].latency_ms
        < ml_result.nodes["guard"].latency_ms
        < generative_result.nodes["guard"].latency_ms
    )


def test_output_guardrail_filters_after_the_llm_without_saving_model_calls():
    diagram = canvas(
        [
            node("client", "client"),
            node("llm", "llm-gateway"),
            node("output", "output-guardrail", guardrailScope="recent_history"),
        ],
        [edge("client", "llm", "ai_call"), edge("client", "output", "validation")],
    )

    result = simulate(diagram, SimParams(base_rps=100, scenario="prompt_attack"), SPECS)

    assert result.nodes["llm"].rps == 100
    assert result.nodes["output"].blocked_rps == 30


def test_guardrail_always_fails_closed_even_for_legacy_fail_open_nodes():
    closed = canvas(
        [
            node("client", "client"),
            node("guard", "guardrails", guardrailEngine="ml"),
            node("llm", "llm-gateway"),
        ],
        [edge("client", "guard", "validation"), edge("client", "llm", "ai_call")],
    )
    legacy = canvas(
        [
            node("client", "client"),
            node(
                "guard",
                "guardrails",
                guardrailEngine="ml",
                guardrailFailureMode="fail_open",
            ),
            node("llm", "llm-gateway"),
        ],
        [edge("client", "guard", "validation"), edge("client", "llm", "ai_call")],
    )
    params = SimParams(base_rps=2_000, scenario="prompt_attack")

    closed_result = simulate(closed, params, SPECS)
    legacy_result = simulate(legacy, params, SPECS)

    assert closed_result.availability_pct < 100
    assert closed_result.nodes["guard"].uninspected_rps == 0
    assert legacy_result.nodes["guard"].uninspected_rps == 0
    assert legacy_result.nodes["guard"].blocked_rps == closed_result.nodes["guard"].blocked_rps
    assert legacy_result.nodes["guard"].error_rate == closed_result.nodes["guard"].error_rate


def test_telemetry_and_model_updates_do_not_extend_the_online_path():
    diagram = canvas(
        [
            node("client", "client"),
            node("app", "app-server"),
            node("monitor", "model-monitoring"),
            node("registry", "model-registry"),
        ],
        [
            edge("client", "app"),
            edge("app", "monitor", "telemetry"),
            edge("registry", "app", "model_update"),
        ],
    )

    result = simulate(diagram, SimParams(base_rps=100), SPECS)

    assert result.nodes["monitor"].rps == 100
    assert result.nodes["registry"].rps == 0
    assert result.p99_ms == result.nodes["app"].latency_ms


def test_conversational_tutorial_layered_guardrails_match_the_story():
    diagram = canvas(
        [
            node("client", "client"),
            node("app", "app-server"),
            node("early", "guardrails"),
            node("memory", "agent-memory"),
            node(
                "history",
                "guardrails",
                guardrailEngine="ml",
                guardrailScope="recent_history",
            ),
            node("cache", "semantic-cache"),
            node("rag", "rag-retriever"),
            node("embedding", "embedding-service"),
            node("vectors", "vector-db"),
            node("llm", "llm-gateway"),
            node("output", "output-guardrail", guardrailScope="recent_history"),
            node("observe", "llm-observability"),
        ],
        [
            edge("client", "app"),
            edge("app", "early", "validation"),
            edge("app", "memory", "retrieval"),
            edge("app", "history", "validation"),
            edge("app", "rag", "retrieval"),
            edge("rag", "cache", "cache_lookup"),
            edge("rag", "output", "validation"),
            edge("rag", "embedding", "ai_call"),
            edge("rag", "vectors", "retrieval"),
            edge("rag", "llm", "ai_call"),
            edge("llm", "observe", "telemetry"),
        ],
    )

    result = simulate(
        diagram,
        SimParams(
            base_rps=100,
            read_ratio=1,
            cache_hit_rate=0.7,
            scenario="prompt_attack",
            p99_target_ms=2500,
        ),
        SPECS,
    )

    assert result.nodes["early"].rps == 100
    assert result.nodes["early"].blocked_rps == 20
    assert result.nodes["memory"].rps == 80
    assert result.nodes["history"].rps == 80
    assert result.nodes["history"].blocked_rps == 8.5
    assert result.nodes["rag"].rps == 71.5
    assert result.nodes["cache"].rps == 71.5
    assert result.nodes["vectors"].rps == 21.45
    assert result.nodes["llm"].attack_rps == 0.45
    assert result.nodes["llm"].rps == 21.45
    assert result.nodes["output"].rps == 71.5
    assert result.nodes["output"].blocked_rps > 0
    assert result.nodes["observe"].rps == result.nodes["llm"].rps
    assert result.availability_pct == 100


def test_fraud_tutorial_scenarios_move_the_real_bottleneck():
    online = canvas(
        [
            node("client", "client"),
            node("api", "api-gateway"),
            node("app", "app-server"),
            node("endpoint", "model-endpoint-realtime"),
        ],
        [edge("client", "api"), edge("api", "app"), edge("app", "endpoint", "ai_call")],
    )
    ramp = simulate(
        online,
        SimParams(base_rps=500, traffic_multiplier=3, read_ratio=0.9, scenario="ramp"),
        SPECS,
    )
    assert ramp.bottleneck == "endpoint"
    assert ramp.nodes["endpoint"].error_rate > 0

    online["nodes"][2]["data"]["replicas"] = 2
    online["nodes"][3]["data"]["replicas"] = 4
    scaled = simulate(
        online,
        SimParams(base_rps=500, traffic_multiplier=3, read_ratio=0.9, scenario="ramp"),
        SPECS,
    )
    assert scaled.error_rate == 0

    online["nodes"].append(node("features", "feature-store"))
    online["edges"] = [
        edge("client", "api"),
        edge("api", "app"),
        edge("app", "features", "retrieval"),
        edge("app", "endpoint", "ai_call"),
    ]
    hot = simulate(
        online,
        SimParams(
            base_rps=500,
            traffic_multiplier=4,
            read_ratio=0.9,
            scenario="hot_partition",
        ),
        SPECS,
    )
    assert hot.bottleneck == "features"
    assert hot.nodes["features"].rps == 2_000
    assert hot.nodes["endpoint"].rps == 2_000
    assert hot.nodes["features"].error_rate > 0
    assert hot.p99_ms > hot.nodes["features"].latency_ms
    assert hot.p99_ms > hot.nodes["endpoint"].latency_ms

    online["nodes"][-1]["data"]["replicas"] = 2
    fixed = simulate(
        online,
        SimParams(
            base_rps=500,
            traffic_multiplier=4,
            read_ratio=0.9,
            scenario="hot_partition",
        ),
        SPECS,
    )
    assert fixed.error_rate == 0


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
            intent = draw(
                st.sampled_from(
                    [
                        "request",
                        "cache_lookup",
                        "async_enqueue",
                        "dead_letter",
                        "llm_call",
                        "retrieval",
                    ]
                )
            )
            edges.append(
                {"id": f"e{j}", "source": f"n{s}", "target": f"n{t}", "data": {"intent": intent}}
            )
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
