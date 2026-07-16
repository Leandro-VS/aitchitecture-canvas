"""Motor de simulação determinístico (M5, §6 das specs).

Modelo: cada arquétipo tem capacidade base (RPS) e latência base; o tráfego
entra pelos Clients e se propaga pelo grafo. Por nó: cpu, latência efetiva
(degrada sob carga), taxa de erro por saturação. Global: p99 no pior caminho
síncrono, disponibilidade, bottleneck e advisor tips.

Regras de propagação (escopo MVP — sem tokens, chaos ou agent loop):
- fan-out: cada out-edge recebe o inflow do nó (toda dependência é tocada);
- cache_lookup: o cache recebe a fração de leituras (read_ratio); as demais
  out-edges do mesmo nó recebem inflow * (1 - read_ratio * cache_hit_rate) —
  hit não segue adiante, escrita e miss seguem;
- edges async (async_enqueue) entregam tráfego, mas o caminho síncrono do
  usuário termina na fila (consumidores não entram no p99).

Determinismo: mesmo input → mesmo output (funções puras, ordenação estável).
Nós de anotação (D13) são ignorados.
"""

from typing import Literal

from pydantic import BaseModel, Field

INFINITE = float("inf")
# async_message é o intent atual; enqueue/consume são legados de diagramas salvos
ASYNC_INTENTS = {"async_message", "async_enqueue", "async_consume"}


class SimParams(BaseModel):
    """Parâmetros do painel de simulação — inclui os NFRs quantitativos
    (decisão de produto: números vivem aqui, não no intake)."""

    base_rps: int = Field(default=100, gt=0, le=10_000_000)
    traffic_multiplier: float = Field(default=1.0, ge=0.1, le=1000)
    read_ratio: float = Field(default=0.8, ge=0, le=1)
    cache_hit_rate: float = Field(default=0.8, ge=0, le=1)
    # alvos opcionais para comparação no painel e tips
    p99_target_ms: int | None = Field(default=None, gt=0)
    availability_target_pct: float | None = Field(default=None, ge=90, le=100)


class NodeMetrics(BaseModel):
    rps: float
    cpu: float  # utilização (1.0 = 100% da capacidade)
    latency_ms: float
    error_rate: float
    health: Literal["ok", "hot", "critical"]


class AdvisorTip(BaseModel):
    severity: Literal["ok", "warning", "critical"]
    message: str
    component_refs: list[str] = []


class Targets(BaseModel):
    p99_ms: int | None = None
    availability_pct: float | None = None


class SimResult(BaseModel):
    total_rps: float
    avg_latency_ms: float
    p99_ms: float
    error_rate: float
    availability_pct: float
    bottleneck: str | None
    nodes: dict[str, NodeMetrics]
    tips: list[AdvisorTip]
    targets: Targets


class ArchetypeSpec(BaseModel):
    archetype: str
    archetype_class: str
    base_rps: int | None
    base_latency_ms: float
    params: dict = {}


def _degradation_factor(cpu: float) -> float:
    """Latência cresce a partir de 80% de utilização; acima de 100%, fila."""
    factor = 1.0
    if cpu > 0.8:
        factor += (min(cpu, 1.0) - 0.8) * 2.5
    if cpu > 1.0:
        factor += (cpu - 1.0) * 4.0
    return factor


def _error_rate(cpu: float) -> float:
    """Acima da capacidade, o excedente falha: 1 - 1/cpu."""
    return 0.0 if cpu <= 1.0 else 1.0 - 1.0 / cpu


def _health(cpu: float) -> Literal["ok", "hot", "critical"]:
    if cpu > 1.0:
        return "critical"
    if cpu > 0.8:
        return "hot"
    return "ok"


def _topological_order(node_ids: list[str], out_edges: dict[str, list[dict]]) -> list[str]:
    """Kahn; nós em ciclo entram ao final em ordem estável (processados 1x —
    tráfego não recircula)."""
    indegree = dict.fromkeys(node_ids, 0)
    for src in node_ids:
        for e in out_edges.get(src, []):
            if e["target"] in indegree:
                indegree[e["target"]] += 1
    queue = sorted(nid for nid, d in indegree.items() if d == 0)
    order: list[str] = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for e in out_edges.get(nid, []):
            tgt = e["target"]
            if tgt in indegree and tgt not in order:
                indegree[tgt] -= 1
                if indegree[tgt] == 0 and tgt not in queue:
                    queue.append(tgt)
        queue.sort()
    return order + sorted(nid for nid in node_ids if nid not in order)


def simulate(
    canvas_state: dict,
    params: SimParams,
    archetypes: dict[str, ArchetypeSpec],
) -> SimResult:
    targets = Targets(
        p99_ms=params.p99_target_ms, availability_pct=params.availability_target_pct
    )
    nodes = [
        n for n in canvas_state.get("nodes", [])
        if n.get("type") != "annotation" and n.get("data", {}).get("archetype") in archetypes
    ]
    node_by_id = {n["id"]: n for n in nodes}
    edges = [
        e for e in canvas_state.get("edges", [])
        if e.get("source") in node_by_id and e.get("target") in node_by_id
        and (e.get("data") or {}).get("intent") != "annotation"
    ]
    out_edges: dict[str, list[dict]] = {}
    for e in sorted(edges, key=lambda e: str(e.get("id", ""))):
        out_edges.setdefault(e["source"], []).append(e)

    empty = SimResult(
        total_rps=0, avg_latency_ms=0, p99_ms=0, error_rate=0, availability_pct=100,
        bottleneck=None, nodes={}, tips=[], targets=targets,
    )
    if not nodes:
        return empty

    def spec(nid: str) -> ArchetypeSpec:
        return archetypes[node_by_id[nid]["data"]["archetype"]]

    # --- propagação de tráfego ---
    entries = sorted(nid for nid in node_by_id if spec(nid).archetype_class == "client")
    if not entries:  # sem Client: entram os nós sem edge de chegada
        with_incoming = {e["target"] for e in edges}
        entries = sorted(nid for nid in node_by_id if nid not in with_incoming)
    if not entries:
        return empty

    total_in = params.base_rps * params.traffic_multiplier
    inflow = dict.fromkeys(node_by_id, 0.0)
    for nid in entries:
        inflow[nid] = total_in / len(entries)

    for nid in _topological_order(sorted(node_by_id), out_edges):
        outs = out_edges.get(nid, [])
        has_cache = any((e.get("data") or {}).get("intent") == "cache_lookup" for e in outs)
        for e in outs:
            intent = (e.get("data") or {}).get("intent", "request")
            if has_cache and intent == "cache_lookup":
                share = inflow[nid] * params.read_ratio
            elif has_cache:
                share = inflow[nid] * (1 - params.read_ratio * params.cache_hit_rate)
            else:
                share = inflow[nid]
            inflow[e["target"]] += share

    # --- métricas por nó ---
    metrics: dict[str, NodeMetrics] = {}
    for nid in sorted(node_by_id):
        s = spec(nid)
        replicas = max(1, int(node_by_id[nid].get("data", {}).get("replicas") or 1))
        capacity = INFINITE if s.base_rps is None else s.base_rps * replicas
        cpu = 0.0 if capacity == INFINITE else inflow[nid] / capacity
        metrics[nid] = NodeMetrics(
            rps=round(inflow[nid], 2),
            cpu=round(cpu, 4),
            latency_ms=round(s.base_latency_ms * _degradation_factor(cpu), 2),
            error_rate=round(_error_rate(cpu), 4),
            health=_health(cpu),
        )

    # --- caminhos síncronos (p99 = pior caminho; async não entra) ---
    def path_latencies(nid: str, seen: frozenset[str]) -> list[float]:
        own = metrics[nid].latency_ms
        tails: list[float] = []
        for e in out_edges.get(nid, []):
            if e["target"] in seen:
                continue
            intent = (e.get("data") or {}).get("intent", "request")
            if intent in ASYNC_INTENTS:
                # publicar na fila é síncrono (latência da fila conta);
                # o consumo além dela não entra no caminho do usuário
                tails.append(metrics[e["target"]].latency_ms)
            else:
                tails.extend(path_latencies(e["target"], seen | {e["target"]}))
        if not tails:
            return [own]
        return [own + tail for tail in tails]

    all_paths = [lat for nid in entries for lat in path_latencies(nid, frozenset({nid}))]
    p99 = max(all_paths)
    avg = sum(all_paths) / len(all_paths)

    active = [nid for nid in sorted(node_by_id) if inflow[nid] > 0]
    ok_fraction = 1.0
    for nid in active:
        ok_fraction *= 1.0 - metrics[nid].error_rate
    finite = [nid for nid in active if spec(nid).base_rps is not None]
    bottleneck = max(finite, key=lambda nid: metrics[nid].cpu, default=None)
    if bottleneck is not None and metrics[bottleneck].cpu == 0:
        bottleneck = None

    result = SimResult(
        total_rps=round(total_in, 2),
        avg_latency_ms=round(avg, 2),
        p99_ms=round(p99, 2),
        error_rate=round(1.0 - ok_fraction, 4),
        availability_pct=round(ok_fraction * 100, 3),
        bottleneck=bottleneck,
        nodes=metrics,
        tips=[],
        targets=targets,
    )
    result.tips = _advisor_tips(result, node_by_id, out_edges, spec)
    return result


def _advisor_tips(result, node_by_id, out_edges, spec) -> list[AdvisorTip]:
    """3–4 regras simples (escopo M5)."""
    tips: list[AdvisorTip] = []
    callers: dict[str, list[str]] = {}
    for src, outs in out_edges.items():
        for e in outs:
            callers.setdefault(e["target"], []).append(src)

    def caller_has_cache(nid: str) -> bool:
        return any(
            (e.get("data") or {}).get("intent") == "cache_lookup"
            for c in callers.get(nid, [])
            for e in out_edges.get(c, [])
        )

    for nid in sorted(node_by_id):
        m = result.nodes[nid]
        name = node_by_id[nid].get("data", {}).get("name", nid)
        klass = spec(nid).archetype_class
        if m.cpu > 1.0:
            tips.append(AdvisorTip(
                severity="critical", component_refs=[nid],
                message=f"{name} está a {m.cpu:.0%} da capacidade — aumente réplicas "
                        f"ou reduza o tráfego que chega até ele.",
            ))
        if klass == "database" and m.cpu > 0.9 and not caller_has_cache(nid):
            tips.append(AdvisorTip(
                severity="warning", component_refs=[nid],
                message=f"{name} (SQL) saturado sem cache no caminho — adicione um Cache "
                        f"com cache_lookup para absorver as leituras.",
            ))
        if klass == "llm" and m.rps > 0 and not caller_has_cache(nid):
            tips.append(AdvisorTip(
                severity="warning", component_refs=[nid],
                message=f"{name} recebe chamadas sem Semantic Cache — em fluxos de "
                        f"pergunta-resposta, um cache semântico corta latência e custo.",
            ))
    if result.targets.p99_ms and result.p99_ms > result.targets.p99_ms:
        tips.append(AdvisorTip(
            severity="warning",
            message=f"p99 simulado ({result.p99_ms:.0f} ms) acima do alvo do intake "
                    f"({result.targets.p99_ms} ms).",
        ))
    if not tips:
        tips.append(
            AdvisorTip(severity="ok", message="Dentro dos alvos — nenhum gargalo detectado.")
        )
    return tips
