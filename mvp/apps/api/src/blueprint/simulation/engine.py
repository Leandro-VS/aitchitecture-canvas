"""Motor determinístico para explorar capacidade, escala e filas.

Os valores do catálogo são calibrações nominais por unidade, não promessas de
um produto cloud. A capacidade efetiva combina a calibração com porte do nó,
perfil global de capacidade, mistura read/write, política de escala e cenário temporal.

O motor trabalha em uma janela de 60 s, dividida em passos de 10 s. Isso torna
visíveis rajadas, atraso de autoscaling, cache frio, partições quentes e
backlog sem abrir uma coleção de parâmetros específicos de fornecedor.
"""

from dataclasses import dataclass
from math import ceil
from typing import Literal

from pydantic import BaseModel, Field

INFINITE = float("inf")
ASYNC_INTENTS = {"async_message", "async_enqueue", "async_consume"}
OUT_OF_BAND_INTENTS = {"telemetry", "model_update"}
DEAD_LETTER_INTENT = "dead_letter"
DEFAULT_DLQ_FAILURE_RATE = 0.01
STEP_SECONDS = 10
WINDOW_SECONDS = 60
SIZE_FACTORS = {"small": 0.5, "medium": 1.0, "large": 2.0}
CAPACITY_FACTORS = {"conservative": 0.65, "nominal": 1.0, "optimistic": 1.5}
HEALTH_RANK = {"ok": 0, "hot": 1, "critical": 2}
GUARDRAIL_ENGINE_WORK = {"deterministic": 0.35, "ml": 1.0, "generative": 2.5}
GUARDRAIL_ENGINE_LATENCY = {"deterministic": 0.35, "ml": 1.0, "generative": 8.0}
GUARDRAIL_DETECTION = {
    "deterministic": {"single": 1.0, "multi": 0.0},
    "ml": {"single": 0.95, "multi": 0.85},
    "generative": {"single": 1.0, "multi": 1.0},
}

Scenario = Literal[
    "steady", "spike", "ramp", "hot_partition", "cold_cache", "prompt_attack"
]
CapacityProfile = Literal["conservative", "nominal", "optimistic"]
NodeSize = Literal["small", "medium", "large"]
ScalingPolicy = Literal["fixed", "elastic"]


class SimParams(BaseModel):
    """Controles globais. Detalhes de fornecedor ficam fora do canvas."""

    base_rps: int = Field(default=100, gt=0, le=10_000_000)
    traffic_multiplier: float = Field(default=1.0, ge=0.1, le=1000)
    read_ratio: float = Field(default=0.8, ge=0, le=1)
    cache_hit_rate: float = Field(default=0.8, ge=0, le=1)
    scenario: Scenario = "steady"
    capacity_profile: CapacityProfile = "nominal"
    p99_target_ms: int | None = Field(default=250, gt=0)
    availability_target_pct: float | None = Field(default=99.9, ge=90, le=100)


class NodeMetrics(BaseModel):
    rps: float
    work_units: float
    capacity_rps: float | None
    cpu: float  # utilização de pico (1.0 = 100% da capacidade efetiva)
    latency_ms: float
    error_rate: float
    health: Literal["ok", "hot", "critical"]
    status: Literal["steady", "scaling", "backlogged", "throttled"]
    profile: str
    size: NodeSize
    scaling: ScalingPolicy
    active_units: int
    max_units: int
    backlog_messages: float = 0
    scaling_events: int = 0
    attack_rps: float = 0
    blocked_rps: float = 0
    uninspected_rps: float = 0


class AdvisorTip(BaseModel):
    severity: Literal["ok", "warning", "critical"]
    message: str
    component_refs: list[str] = Field(default_factory=list)


class Targets(BaseModel):
    p99_ms: int | None = None
    availability_pct: float | None = None


class TimelinePoint(BaseModel):
    second: int
    input_rps: float
    p99_ms: float
    error_rate: float
    backlog_messages: float
    bottleneck: str | None


class ScalingEvent(BaseModel):
    node_id: str
    second: int
    from_units: int
    to_units: int


class SimResult(BaseModel):
    total_rps: float
    peak_rps: float
    duration_seconds: int
    scenario: Scenario
    capacity_profile: CapacityProfile
    avg_latency_ms: float
    p99_ms: float
    error_rate: float
    availability_pct: float
    max_backlog_messages: float
    bottleneck: str | None
    nodes: dict[str, NodeMetrics]
    timeline: list[TimelinePoint]
    scaling_events: list[ScalingEvent]
    tips: list[AdvisorTip]
    targets: Targets


class ArchetypeSpec(BaseModel):
    archetype: str
    archetype_class: str
    base_rps: int | None
    base_latency_ms: float
    params: dict = Field(default_factory=dict)


@dataclass(frozen=True)
class BehaviorProfile:
    key: str
    label: str
    read_weight: float
    write_weight: float
    scale_delay_s: int
    target_utilization: float = 0.7


PROFILES = {
    "unbounded": BehaviorProfile("unbounded", "Origem de tráfego", 0, 0, 0),
    "fixed_compute": BehaviorProfile("fixed_compute", "Compute", 1.0, 1.2, 20),
    "elastic_compute": BehaviorProfile("elastic_compute", "Compute elástico", 1.0, 1.2, 10),
    "stateful_store": BehaviorProfile("stateful_store", "Store stateful", 1.0, 2.0, 40),
    "partitioned_store": BehaviorProfile(
        "partitioned_store", "Store particionado", 1.0, 2.0, 30
    ),
    "memory_store": BehaviorProfile("memory_store", "Store em memória", 0.5, 0.8, 20),
    "buffered_service": BehaviorProfile("buffered_service", "Buffer durável", 1.0, 1.0, 20),
    "quota_service": BehaviorProfile("quota_service", "Serviço com quota", 1.0, 1.0, 30),
    "realtime_inference": BehaviorProfile(
        "realtime_inference", "Inferência síncrona", 1.0, 1.0, 20, 0.65
    ),
    "async_inference": BehaviorProfile(
        "async_inference", "Inferência assíncrona", 1.0, 1.0, 20
    ),
    "batch_inference": BehaviorProfile(
        "batch_inference", "Processamento em lote", 1.0, 1.0, 30
    ),
    "serverless_inference": BehaviorProfile(
        "serverless_inference", "Inferência serverless", 1.0, 1.0, 10, 0.6
    ),
    "control_plane": BehaviorProfile("control_plane", "Controle de ML", 0.5, 0.8, 20),
    "observation_sink": BehaviorProfile(
        "observation_sink", "Observabilidade", 0.3, 0.3, 20
    ),
    "input_guardrail": BehaviorProfile(
        "input_guardrail", "Proteção de entrada", 1.0, 1.0, 20
    ),
    "output_guardrail": BehaviorProfile(
        "output_guardrail", "Proteção de saída", 1.0, 1.0, 20
    ),
}

BUFFERED_COMPUTE_PROFILES = {"async_inference", "batch_inference"}
OUT_OF_BAND_PROFILES = BUFFERED_COMPUTE_PROFILES | {"control_plane", "observation_sink"}


def _profile(spec: ArchetypeSpec) -> BehaviorProfile:
    configured = spec.params.get("simulation_profile")
    if configured in PROFILES:
        return PROFILES[configured]
    klass = spec.archetype_class
    if klass == "client":
        return PROFILES["unbounded"]
    if klass == "queue":
        return PROFILES["buffered_service"]
    if klass in {"cache", "semantic-cache"}:
        return PROFILES["memory_store"]
    if klass == "database":
        return PROFILES["stateful_store"]
    if klass in {"store", "vector-db"}:
        return PROFILES["partitioned_store"]
    if spec.archetype == "serverless":
        return PROFILES["elastic_compute"]
    if klass in {"llm", "embedding", "batch"}:
        return PROFILES["quota_service"]
    return PROFILES["fixed_compute"]


def _degradation_factor(utilization: float) -> float:
    """Curva de fila conservadora: a latência começa a subir em 70%."""
    if utilization <= 0.7:
        return 1.0
    if utilization <= 1.0:
        return 1.0 + ((utilization - 0.7) / 0.3) * 2.0
    return 3.0 + (utilization - 1.0) * 5.0


def _error_rate(utilization: float) -> float:
    return 0.0 if utilization <= 1.0 else 1.0 - 1.0 / utilization


def _health(utilization: float) -> Literal["ok", "hot", "critical"]:
    if utilization > 1.0:
        return "critical"
    if utilization > 0.7:
        return "hot"
    return "ok"


def _topological_order(node_ids: list[str], out_edges: dict[str, list[dict]]) -> list[str]:
    """Kahn; nós em ciclo entram ao final e são processados uma vez."""
    indegree = dict.fromkeys(node_ids, 0)
    for src in node_ids:
        for edge in out_edges.get(src, []):
            if edge["target"] in indegree:
                indegree[edge["target"]] += 1
    queue = sorted(nid for nid, degree in indegree.items() if degree == 0)
    order: list[str] = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for edge in out_edges.get(nid, []):
            target = edge["target"]
            if target in indegree and target not in order:
                indegree[target] -= 1
                if indegree[target] == 0 and target not in queue:
                    queue.append(target)
        queue.sort()
    return order + sorted(nid for nid in node_ids if nid not in order)


def _scenario_load(params: SimParams, bucket: int, bucket_count: int) -> float:
    peak = params.traffic_multiplier
    if params.scenario == "spike":
        multiplier = peak if bucket in {2, 3} else 1.0
    elif params.scenario == "ramp":
        multiplier = 1.0 + (peak - 1.0) * bucket / max(1, bucket_count - 1)
    else:
        multiplier = peak
    return params.base_rps * multiplier


def _guardrail_config(node: dict) -> tuple[str, str]:
    data = node.get("data", {})
    scope = data.get("guardrailScope", "current_turn")
    default_engine = (
        "generative" if data.get("archetype") == "output-guardrail" else "deterministic"
    )
    engine = data.get("guardrailEngine", default_engine)
    if scope not in {"current_turn", "recent_history"}:
        scope = "current_turn"
    if engine not in GUARDRAIL_ENGINE_WORK:
        engine = default_engine
    return scope, engine


def _node_config(node: dict) -> tuple[NodeSize, ScalingPolicy, int, int]:
    data = node.get("data", {})
    size = data.get("size", "medium")
    if size not in SIZE_FACTORS:
        size = "medium"
    scaling = data.get("scaling", "fixed")
    if scaling not in {"fixed", "elastic"}:
        scaling = "fixed"
    minimum = max(1, min(100, int(data.get("replicas") or 1)))
    maximum = minimum if scaling == "fixed" else max(
        minimum, min(100, int(data.get("maxReplicas") or 10))
    )
    return size, scaling, minimum, maximum


def simulate(
    canvas_state: dict,
    params: SimParams,
    archetypes: dict[str, ArchetypeSpec],
) -> SimResult:
    targets = Targets(p99_ms=params.p99_target_ms, availability_pct=params.availability_target_pct)
    nodes = [
        node
        for node in canvas_state.get("nodes", [])
        if node.get("type") != "annotation"
        and node.get("data", {}).get("archetype") in archetypes
    ]
    node_by_id = {node["id"]: node for node in nodes}
    edges = [
        edge
        for edge in canvas_state.get("edges", [])
        if edge.get("source") in node_by_id
        and edge.get("target") in node_by_id
        and (edge.get("data") or {}).get("intent") != "annotation"
    ]
    out_edges: dict[str, list[dict]] = {}
    for edge in sorted(edges, key=lambda item: str(item.get("id", ""))):
        out_edges.setdefault(edge["source"], []).append(edge)

    empty = SimResult(
        total_rps=0,
        peak_rps=0,
        duration_seconds=WINDOW_SECONDS,
        scenario=params.scenario,
        capacity_profile=params.capacity_profile,
        avg_latency_ms=0,
        p99_ms=0,
        error_rate=0,
        availability_pct=100,
        max_backlog_messages=0,
        bottleneck=None,
        nodes={},
        timeline=[],
        scaling_events=[],
        tips=[],
        targets=targets,
    )
    if not nodes:
        return empty

    def spec(nid: str) -> ArchetypeSpec:
        return archetypes[node_by_id[nid]["data"]["archetype"]]

    entries = sorted(nid for nid in node_by_id if spec(nid).archetype_class == "client")
    if not entries:
        with_incoming = {edge["target"] for edge in edges}
        entries = sorted(nid for nid in node_by_id if nid not in with_incoming)
    if not entries:
        return empty

    order = _topological_order(sorted(node_by_id), out_edges)
    profiles = {nid: _profile(spec(nid)) for nid in node_by_id}
    configs = {nid: _node_config(node_by_id[nid]) for nid in node_by_id}
    active_units = {nid: configs[nid][2] for nid in node_by_id}
    overload_seconds = dict.fromkeys(node_by_id, 0)
    backlog = dict.fromkeys(node_by_id, 0.0)
    node_events = dict.fromkeys(node_by_id, 0)
    scale_events: list[ScalingEvent] = []
    peak_metrics: dict[str, NodeMetrics] = {}
    peak_scores = dict.fromkeys(node_by_id, 0.0)
    timeline: list[TimelinePoint] = []
    average_path_samples: list[float] = []
    bucket_count = WINDOW_SECONDS // STEP_SECONDS

    def work_factor(nid: str) -> float:
        profile = profiles[nid]
        factor = (
            params.read_ratio * profile.read_weight
            + (1 - params.read_ratio) * profile.write_weight
        )
        if profile.key in {"input_guardrail", "output_guardrail"}:
            scope, engine = _guardrail_config(node_by_id[nid])
            factor *= GUARDRAIL_ENGINE_WORK[engine]
            if scope == "recent_history":
                factor *= 1.6
        return factor

    def effective_capacity(nid: str) -> float:
        base = spec(nid).base_rps
        if base is None:
            return INFINITE
        size, _, _, _ = configs[nid]
        capacity_wu = (
            base
            * SIZE_FACTORS[size]
            * CAPACITY_FACTORS[params.capacity_profile]
            * active_units[nid]
        )
        if params.scenario == "hot_partition" and profiles[nid].key == "partitioned_store":
            capacity_wu *= 0.4
        factor = work_factor(nid)
        return capacity_wu / factor if factor > 0 else INFINITE

    for bucket in range(bucket_count):
        total_in = _scenario_load(params, bucket, bucket_count)
        cache_hit = (
            0.0
            if params.scenario == "cold_cache" and bucket < 2
            else params.cache_hit_rate
        )
        inflow = dict.fromkeys(node_by_id, 0.0)
        service_rate = dict.fromkeys(node_by_id, 0.0)
        single_turn_attacks = dict.fromkeys(node_by_id, 0.0)
        multi_turn_attacks = dict.fromkeys(node_by_id, 0.0)
        guardrail_blocked = dict.fromkeys(node_by_id, 0.0)
        guardrail_uninspected = dict.fromkeys(node_by_id, 0.0)
        guardrail_benign_errors = dict.fromkeys(node_by_id, 0.0)
        for nid in entries:
            inflow[nid] = total_in / len(entries)
            if params.scenario == "prompt_attack":
                single_turn_attacks[nid] = inflow[nid] * 0.2
                multi_turn_attacks[nid] = inflow[nid] * 0.1

        def deliver(
            target: str,
            rate: float,
            source_rate: float,
            single_attacks: float,
            multi_attacks: float,
            *,
            inflow_by_node: dict[str, float] = inflow,
            single_by_node: dict[str, float] = single_turn_attacks,
            multi_by_node: dict[str, float] = multi_turn_attacks,
        ) -> None:
            inflow_by_node[target] += rate
            fraction = 0.0 if source_rate <= 0 else rate / source_rate
            single_by_node[target] += single_attacks * fraction
            multi_by_node[target] += multi_attacks * fraction

        for nid in order:
            outs = out_edges.get(nid, [])
            profile = profiles[nid]
            capacity = effective_capacity(nid)
            forward_rate = inflow[nid]
            forward_single = single_turn_attacks[nid]
            forward_multi = multi_turn_attacks[nid]

            if profile.key in {"input_guardrail", "output_guardrail"} and inflow[nid] > 0:
                scope, engine = _guardrail_config(node_by_id[nid])
                inspected_fraction = (
                    1.0 if capacity == INFINITE else min(1.0, capacity / inflow[nid])
                )
                detection = GUARDRAIL_DETECTION[engine]
                detected_single = (
                    single_turn_attacks[nid]
                    * inspected_fraction
                    * detection["single"]
                )
                detected_multi = (
                    multi_turn_attacks[nid]
                    * inspected_fraction
                    * detection["multi"]
                    if scope == "recent_history"
                    else 0.0
                )
                overflow = inflow[nid] * (1 - inspected_fraction)
                single_overflow = single_turn_attacks[nid] * (1 - inspected_fraction)
                multi_overflow = multi_turn_attacks[nid] * (1 - inspected_fraction)
                malicious_blocked = detected_single + detected_multi
                forward_single -= detected_single
                forward_multi -= detected_multi
                # Guardrails operam sempre em fail closed: se a capacidade de
                # inspeção acabar, o tráfego excedente não segue sem validação.
                benign_overflow = max(0.0, overflow - single_overflow - multi_overflow)
                guardrail_benign_errors[nid] = benign_overflow / inflow[nid]
                guardrail_blocked[nid] = malicious_blocked + overflow
                forward_rate -= malicious_blocked + overflow
                forward_single -= single_overflow
                forward_multi -= multi_overflow
                forward_rate = max(0.0, forward_rate)
                forward_single = max(0.0, forward_single)
                forward_multi = max(0.0, forward_multi)

            # Mesmo após uma entrada limpa, uma geração pode produzir conteúdo
            # que a política de saída precisa reter. No cenário adversarial,
            # representamos esse risco residual em 5% das respostas; quando a
            # entrada maliciosa já supera isso, preservamos a composição recebida.
            if (
                spec(nid).archetype_class == "llm"
                and params.scenario == "prompt_attack"
                and forward_rate > 0
            ):
                forward_single = max(forward_single, forward_rate * 0.05)

            # Inferência assíncrona e jobs em lote aceitam trabalho e o drenam
            # pela própria capacidade. Excesso vira backlog, não erro HTTP nem
            # latência do caminho síncrono do usuário.
            if profile.key in BUFFERED_COMPUTE_PROFILES:
                available_rate = inflow[nid] + backlog[nid] / STEP_SECONDS
                completed_rate = (
                    available_rate
                    if capacity == INFINITE
                    else min(available_rate, capacity)
                )
                service_rate[nid] = completed_rate
                backlog[nid] = max(
                    0.0,
                    backlog[nid] + (inflow[nid] - completed_rate) * STEP_SECONDS,
                )
                for edge in outs:
                    if (edge.get("data") or {}).get("intent") != DEAD_LETTER_INTENT:
                        deliver(
                            edge["target"], completed_rate, inflow[nid],
                            single_turn_attacks[nid], multi_turn_attacks[nid]
                        )
                continue

            service_rate[nid] = inflow[nid]
            if not outs:
                continue
            has_cache = any(
                (edge.get("data") or {}).get("intent") == "cache_lookup"
                for edge in outs
            )
            has_async_write_path = any(
                (edge.get("data") or {}).get("intent") in ASYNC_INTENTS for edge in outs
            )
            dead_letter_edges = [
                edge
                for edge in outs
                if (edge.get("data") or {}).get("intent") == DEAD_LETTER_INTENT
            ]

            utilization = 0.0 if capacity == INFINITE else inflow[nid] / capacity
            configured_failure = max(
                (
                    float((edge.get("data") or {}).get("failure_rate", DEFAULT_DLQ_FAILURE_RATE))
                    for edge in dead_letter_edges
                ),
                default=0.0,
            )
            failure_fraction = max(
                0.0,
                min(1.0, max(configured_failure, _error_rate(utilization))),
            )

            # Filas drenam até a capacidade real dos consumidores. O excesso
            # permanece como backlog; não é enviado ao worker para virar erro.
            if profile.key == "buffered_service":
                consumers = [
                    edge
                    for edge in outs
                    if (edge.get("data") or {}).get("intent") in ASYNC_INTENTS
                ]
                if consumers:
                    consumer_caps = [effective_capacity(edge["target"]) for edge in consumers]
                    drain_capacity = (
                        INFINITE
                        if any(cap == INFINITE for cap in consumer_caps)
                        else sum(consumer_caps)
                    )
                    available_rate = inflow[nid] + backlog[nid] / STEP_SECONDS
                    drained_rate = min(available_rate, drain_capacity)
                    backlog[nid] = max(
                        0.0,
                        backlog[nid] + (inflow[nid] - drained_rate) * STEP_SECONDS,
                    )
                    finite_total = sum(cap for cap in consumer_caps if cap != INFINITE)
                    for edge, consumer_cap in zip(consumers, consumer_caps, strict=True):
                        if drain_capacity == INFINITE:
                            share = drained_rate / len(consumers)
                        else:
                            share = drained_rate * consumer_cap / max(finite_total, 1)
                        deliver(
                            edge["target"], share, inflow[nid],
                            single_turn_attacks[nid], multi_turn_attacks[nid]
                        )
                    for edge in outs:
                        if edge not in consumers:
                            deliver(
                                edge["target"], inflow[nid], inflow[nid],
                                single_turn_attacks[nid], multi_turn_attacks[nid]
                            )
                    continue

            for edge in outs:
                edge_data = edge.get("data") or {}
                intent = edge_data.get("intent", "request")
                if intent == "model_update":
                    share = 0.0
                if intent == DEAD_LETTER_INTENT:
                    share = forward_rate * failure_fraction
                elif has_cache and intent == "cache_lookup":
                    share = forward_rate * params.read_ratio
                elif has_cache and intent in ASYNC_INTENTS:
                    share = forward_rate * (1 - params.read_ratio)
                elif has_cache:
                    read_misses = forward_rate * params.read_ratio * (1 - cache_hit)
                    synchronous_writes = (
                        0.0 if has_async_write_path else forward_rate * (1 - params.read_ratio)
                    )
                    share = read_misses + synchronous_writes
                else:
                    share = forward_rate
                if intent == "model_update":
                    share = 0.0
                if dead_letter_edges and intent != DEAD_LETTER_INTENT:
                    share *= 1 - failure_fraction
                deliver(edge["target"], share, forward_rate, forward_single, forward_multi)

        step_metrics: dict[str, NodeMetrics] = {}
        for nid in sorted(node_by_id):
            profile = profiles[nid]
            size, scaling, _, maximum = configs[nid]
            capacity = effective_capacity(nid)
            utilization = 0.0 if capacity == INFINITE else service_rate[nid] / capacity
            errors = (
                0.0
                if profile.key in BUFFERED_COMPUTE_PROFILES
                else _error_rate(utilization)
            )
            if profile.key in {"input_guardrail", "output_guardrail"}:
                errors = guardrail_benign_errors[nid]
            node_health = _health(utilization)
            backlog_seconds = backlog[nid] / max(inflow[nid], 1)
            if backlog[nid] > 0:
                node_health = "critical" if backlog_seconds >= STEP_SECONDS else "hot"
            status: Literal["steady", "scaling", "backlogged", "throttled"]
            if backlog[nid] > 0:
                status = "backlogged"
            elif errors > 0:
                status = "throttled"
            elif node_events[nid] > 0:
                status = "scaling"
            else:
                status = "steady"
            latency = spec(nid).base_latency_ms * _degradation_factor(utilization)
            if profile.key in {"input_guardrail", "output_guardrail"}:
                scope, engine = _guardrail_config(node_by_id[nid])
                latency *= GUARDRAIL_ENGINE_LATENCY[engine]
                if scope == "recent_history":
                    latency *= 1.6
            if profile.key == "serverless_inference" and bucket == 0:
                latency += float(spec(nid).params.get("cold_start_ms", 600))
            metric = NodeMetrics(
                rps=round(inflow[nid], 2),
                work_units=round(service_rate[nid] * work_factor(nid), 2),
                capacity_rps=None if capacity == INFINITE else round(capacity, 2),
                cpu=round(utilization, 4),
                latency_ms=round(latency, 2),
                error_rate=round(errors, 4),
                health=node_health,
                status=status,
                profile=profile.label,
                size=size,
                scaling=scaling,
                active_units=active_units[nid],
                max_units=maximum,
                backlog_messages=round(backlog[nid], 2),
                scaling_events=node_events[nid],
                attack_rps=round(single_turn_attacks[nid] + multi_turn_attacks[nid], 2),
                blocked_rps=round(guardrail_blocked[nid], 2),
                uninspected_rps=round(guardrail_uninspected[nid], 2),
            )
            step_metrics[nid] = metric

            backlog_score = 1.0 + min(backlog_seconds / STEP_SECONDS, 5.0) if backlog[nid] else 0
            peak_scores[nid] = max(peak_scores[nid], utilization, backlog_score)
            previous = peak_metrics.get(nid)
            if previous is None:
                peak_metrics[nid] = metric
            else:
                worst_health = (
                    metric.health
                    if HEALTH_RANK[metric.health] > HEALTH_RANK[previous.health]
                    else previous.health
                )
                peak_metrics[nid] = metric.model_copy(
                    update={
                        "rps": max(previous.rps, metric.rps),
                        "work_units": max(previous.work_units, metric.work_units),
                        "cpu": max(previous.cpu, metric.cpu),
                        "latency_ms": max(previous.latency_ms, metric.latency_ms),
                        "error_rate": max(previous.error_rate, metric.error_rate),
                        "health": worst_health,
                        "backlog_messages": max(
                            previous.backlog_messages, metric.backlog_messages
                        ),
                        "attack_rps": max(previous.attack_rps, metric.attack_rps),
                        "blocked_rps": max(previous.blocked_rps, metric.blocked_rps),
                        "uninspected_rps": max(
                            previous.uninspected_rps, metric.uninspected_rps
                        ),
                    }
                )

        def path_latencies(
            nid: str,
            seen: frozenset[str],
            metrics: dict[str, NodeMetrics] = step_metrics,
        ) -> list[float]:
            own = metrics[nid].latency_ms
            if profiles[nid].key in BUFFERED_COMPUTE_PROFILES:
                return [own]
            tails: list[float] = []
            for edge in out_edges.get(nid, []):
                if edge["target"] in seen:
                    continue
                target_profile = profiles[edge["target"]].key
                if target_profile in {"control_plane", "observation_sink"}:
                    continue
                intent = (edge.get("data") or {}).get("intent", "request")
                if intent in OUT_OF_BAND_INTENTS:
                    continue
                if intent in ASYNC_INTENTS or intent == DEAD_LETTER_INTENT:
                    tails.append(metrics[edge["target"]].latency_ms)
                else:
                    tails.extend(path_latencies(edge["target"], seen | {edge["target"]}))
            return [own] if not tails else [own + tail for tail in tails]

        all_paths = [
            latency
            for nid in entries
            for latency in path_latencies(nid, frozenset({nid}))
        ]
        step_p99 = max(all_paths, default=0)
        average_path_samples.append(sum(all_paths) / max(len(all_paths), 1))
        active = [nid for nid in sorted(node_by_id) if inflow[nid] > 0]
        availability_path = [
            nid for nid in active if profiles[nid].key not in OUT_OF_BAND_PROFILES
        ]
        ok_fraction = 1.0
        for nid in availability_path:
            ok_fraction *= 1.0 - step_metrics[nid].error_rate
        finite = [nid for nid in active if spec(nid).base_rps is not None]

        def step_score(
            nid: str, metrics: dict[str, NodeMetrics] = step_metrics
        ) -> float:
            metric = metrics[nid]
            backlog_seconds = metric.backlog_messages / max(metric.rps, 1)
            return max(
                metric.cpu,
                1.0 + min(backlog_seconds / STEP_SECONDS, 5.0)
                if metric.backlog_messages
                else 0,
            )

        bottleneck = max(finite, key=step_score, default=None)
        if bottleneck is not None and step_score(bottleneck) <= 0.8:
            bottleneck = None
        timeline.append(
            TimelinePoint(
                second=(bucket + 1) * STEP_SECONDS,
                input_rps=round(total_in, 2),
                p99_ms=round(step_p99, 2),
                error_rate=round(1.0 - ok_fraction, 4),
                backlog_messages=round(sum(backlog.values()), 2),
                bottleneck=bottleneck,
            )
        )

        # A decisão de escala ocorre ao fim do passo e afeta o próximo. Isso
        # preserva o período ruim de uma rajada em vez de escalar magicamente.
        for nid in sorted(node_by_id):
            profile = profiles[nid]
            _, scaling, _, maximum = configs[nid]
            metric = step_metrics[nid]
            if scaling != "elastic" or spec(nid).base_rps is None:
                continue
            if metric.cpu > profile.target_utilization and active_units[nid] < maximum:
                overload_seconds[nid] += STEP_SECONDS
            else:
                overload_seconds[nid] = 0
            if overload_seconds[nid] < profile.scale_delay_s:
                continue
            current_capacity = effective_capacity(nid)
            per_unit_capacity = current_capacity / active_units[nid]
            desired = min(
                maximum,
                max(
                    active_units[nid] + 1,
                    ceil(inflow[nid] / max(per_unit_capacity * profile.target_utilization, 1)),
                ),
            )
            if desired > active_units[nid]:
                before = active_units[nid]
                active_units[nid] = desired
                node_events[nid] += 1
                scale_events.append(
                    ScalingEvent(
                        node_id=nid,
                        second=(bucket + 1) * STEP_SECONDS,
                        from_units=before,
                        to_units=desired,
                    )
                )
            overload_seconds[nid] = 0

    # Atualiza estado final nos agregados sem apagar os picos observados.
    for nid, metric in peak_metrics.items():
        final_capacity = effective_capacity(nid)
        final_status = metric.status
        if metric.backlog_messages > 0:
            final_status = "backlogged"
        elif metric.error_rate > 0:
            final_status = "throttled"
        elif node_events[nid] > 0:
            final_status = "scaling"
        peak_metrics[nid] = metric.model_copy(
            update={
                "capacity_rps": None if final_capacity == INFINITE else round(final_capacity, 2),
                "active_units": active_units[nid],
                "status": final_status,
                "scaling_events": node_events[nid],
            }
        )

    peak_rps = max((point.input_rps for point in timeline), default=0)
    p99 = max((point.p99_ms for point in timeline), default=0)
    error_rate = max((point.error_rate for point in timeline), default=0)
    finite_active = [
        nid for nid in sorted(node_by_id) if spec(nid).base_rps is not None and peak_scores[nid] > 0
    ]
    bottleneck = max(finite_active, key=lambda nid: peak_scores[nid], default=None)
    if bottleneck is not None and peak_scores[bottleneck] <= 0.8:
        bottleneck = None
    result = SimResult(
        total_rps=round(peak_rps, 2),
        peak_rps=round(peak_rps, 2),
        duration_seconds=WINDOW_SECONDS,
        scenario=params.scenario,
        capacity_profile=params.capacity_profile,
        avg_latency_ms=round(
            sum(average_path_samples) / max(len(average_path_samples), 1), 2
        ),
        p99_ms=round(p99, 2),
        error_rate=round(error_rate, 4),
        availability_pct=round((1 - error_rate) * 100, 3),
        max_backlog_messages=round(
            max((point.backlog_messages for point in timeline), default=0), 2
        ),
        bottleneck=bottleneck,
        nodes=peak_metrics,
        timeline=timeline,
        scaling_events=scale_events,
        tips=[],
        targets=targets,
    )
    result.tips = _advisor_tips(result, node_by_id, out_edges, spec)
    return result


def _advisor_tips(result, node_by_id, out_edges, spec) -> list[AdvisorTip]:
    tips: list[AdvisorTip] = []
    callers: dict[str, list[str]] = {}
    for src, outs in out_edges.items():
        for edge in outs:
            callers.setdefault(edge["target"], []).append(src)

    def caller_has_cache(nid: str) -> bool:
        return any(
            (edge.get("data") or {}).get("intent") == "cache_lookup"
            for caller in callers.get(nid, [])
            for edge in out_edges.get(caller, [])
        )

    for nid in sorted(node_by_id):
        metric = result.nodes[nid]
        name = node_by_id[nid].get("data", {}).get("name", nid)
        klass = spec(nid).archetype_class
        if metric.backlog_messages > 0:
            if klass in {"ml-async", "ml-batch", "ml-training"}:
                backlog_message = (
                    f"{name} acumulou {metric.backlog_messages:.0f} itens de trabalho — "
                    "aumente unidades ou capacidade de processamento para reduzir o tempo "
                    "até a conclusão."
                )
            else:
                backlog_message = (
                    f"{name} acumulou {metric.backlog_messages:.0f} mensagens — aumente "
                    "a capacidade dos consumidores; escalar só a fila não drena o backlog."
                )
            tips.append(
                AdvisorTip(
                    severity="critical" if metric.health == "critical" else "warning",
                    component_refs=[nid],
                    message=backlog_message,
                )
            )
        elif metric.cpu > 1.0:
            tips.append(
                AdvisorTip(
                    severity="critical",
                    component_refs=[nid],
                    message=(
                        f"{name} atingiu {metric.cpu:.0%} da capacidade efetiva — ajuste porte "
                        "ou unidades e considere escala elástica para cargas variáveis."
                    ),
                )
            )
        elif metric.scaling_events:
            tips.append(
                AdvisorTip(
                    severity="warning",
                    component_refs=[nid],
                    message=(
                        f"{name} escalou até {metric.active_units} unidades, mas a janela inclui "
                        "o atraso de reação anterior à nova capacidade."
                    ),
                )
            )
        if klass in {"database", "store"} and metric.cpu > 0.9 and not caller_has_cache(nid):
            tips.append(
                AdvisorTip(
                    severity="warning",
                    component_refs=[nid],
                    message=(
                        f"{name} está pressionado sem cache no caminho — experimente absorver "
                        "leituras repetidas antes de aumentar a capacidade."
                    ),
                )
            )
        if klass == "llm" and metric.rps > 0 and not caller_has_cache(nid):
            tips.append(
                AdvisorTip(
                    severity="warning",
                    component_refs=[nid],
                    message=(
                        f"{name} recebe chamadas sem Semantic Cache — respostas equivalentes "
                        "podem repetir custo e latência."
                    ),
                )
            )
        if klass == "llm" and result.scenario == "prompt_attack" and metric.attack_rps > 0:
            tips.append(
                AdvisorTip(
                    severity="critical",
                    component_refs=[nid],
                    message=(
                        f"{name} ainda recebeu {metric.attack_rps:.0f} RPS de ataques. "
                        "Proteja a entrada e use histórico recente para tentativas multi-turn."
                    ),
                )
            )
    if result.scenario == "hot_partition" and any(
        result.nodes[nid].profile == "Store particionado" for nid in result.nodes
    ):
        tips.append(
            AdvisorTip(
                severity="warning",
                message=(
                    "O cenário concentra carga em uma partição: aumentar capacidade total pode "
                    "não corrigir uma chave de distribuição desigual."
                ),
            )
        )
    if result.targets.p99_ms and result.p99_ms > result.targets.p99_ms:
        tips.append(
            AdvisorTip(
                severity="warning",
                message=(
                    f"p99 simulado ({result.p99_ms:.0f} ms) acima do alvo configurado "
                    f"({result.targets.p99_ms} ms)."
                ),
            )
        )
    if not tips:
        tips.append(
            AdvisorTip(
                severity="ok", message="Dentro dos alvos — nenhum gargalo detectado."
            )
        )
    return tips
