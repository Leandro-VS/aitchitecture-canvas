import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { useCanvas, type ArchNodeData } from "./store";

const healthBorder = {
  ok: "border-emerald-500/70",
  hot: "border-amber-400",
  critical: "border-red-500",
} as const;

const replicaBtn =
  "flex h-4 w-4 items-center justify-center rounded border border-white/15 " +
  "font-mono text-[10px] leading-none text-ink/60 hover:border-primary hover:text-ink";

// clients têm capacidade infinita — o tráfego é controlado pelo simulador,
// então réplicas não fazem sentido (controles ocultos)
const NO_REPLICAS = new Set(["client", "mobile"]);
const sizeCode = { small: "S", medium: "M", large: "L" } as const;
const statusTone = {
  steady: "text-ink/40",
  scaling: "text-cyan-300",
  backlogged: "text-amber-300",
  throttled: "text-red-400",
} as const;

export function ArchNode({ id, data, selected }: NodeProps<Node<ArchNodeData, "arch">>) {
  const sim = useCanvas((s) => s.sim?.nodes?.[id]);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const setEditingNode = useCanvas((s) => s.setEditingNode);
  const replicas = data.replicas ?? 1;
  const scaling = data.scaling ?? "fixed";
  const size = data.size ?? "medium";
  const maxReplicas = Math.max(replicas, data.maxReplicas ?? 10);
  const guardrailStage = data.archetype === "guardrails"
    ? "entrada"
    : data.archetype === "output-guardrail"
      ? "saída"
      : null;
  const guardrailEngine = data.guardrailEngine ?? (
    data.archetype === "output-guardrail" ? "generative" : "deterministic"
  );

  const border = data.ghost
    ? "border-dashed border-cyan-400/80"
    : selected
      ? "border-primary"
      : sim
        ? healthBorder[sim.health]
        : "border-white/15";
  const simulationEffect = sim?.health === "critical"
    ? "sim-node-critical"
    : sim
      ? "sim-node-clear"
      : "";

  const setReplicas = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { replicas: Math.min(100, Math.max(1, replicas + delta)) });
  };

  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditingNode(id);
      }}
      className={`relative min-w-36 rounded-lg border bg-card px-3 py-2 shadow-lg ${border}
        ${simulationEffect} ${data.ghost ? "opacity-75" : ""}`}
    >
      {data.ghost && (
        <span className="absolute -top-2 left-2 rounded bg-cyan-400/20 px-1.5 font-mono
                         text-[9px] uppercase tracking-widest text-cyan-300">
          sugestão
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditingNode(id);
        }}
        title="editar nome, porte e política de escala"
        className="nodrag absolute right-1.5 top-1.5 rounded px-1 font-mono text-[10px]
                   text-ink/35 hover:bg-white/10 hover:text-ink"
      >
        ✎
      </button>
      <div className="pr-5 text-sm font-medium text-ink">{data.name}</div>
      {data.subtitle && <div className="text-xs text-ink/60">{data.subtitle}</div>}
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
        {data.label}
      </div>
      {guardrailStage && (
        <div className="mt-1 flex flex-wrap gap-1 font-mono text-[8px] uppercase tracking-wide">
          <span className="rounded border border-primary/25 bg-primary/10 px-1 py-0.5 text-primary">
            {guardrailStage}
          </span>
          <span className="rounded bg-white/5 px-1 py-0.5 text-ink/55">
            {(data.guardrailScope ?? "current_turn") === "recent_history"
              ? "histórico"
              : "interação"}
          </span>
          <span className="rounded bg-white/5 px-1 py-0.5 text-ink/55">
            {guardrailEngine === "deterministic"
              ? "determinístico"
              : guardrailEngine === "ml"
                ? "probabilístico"
                : "generativo"}
          </span>
        </div>
      )}
      {!NO_REPLICAS.has(data.archetype) && (
        <div className="mt-1 flex gap-1 font-mono text-[9px] uppercase tracking-wide">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-ink/55" title={`porte ${size}`}>
            {sizeCode[size]}
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-ink/55">
            {scaling === "elastic" ? "auto" : "fixa"}
          </span>
          {sim && (
            <span className={`ml-auto rounded bg-white/5 px-1.5 py-0.5 ${statusTone[sim.status]}`}>
              {sim.status === "backlogged"
                ? "backlog"
                : sim.status === "throttled"
                  ? "throttle"
                  : sim.status === "scaling"
                    ? "escalou"
                    : "estável"}
            </span>
          )}
        </div>
      )}
      <div className="nodrag mt-1.5 flex items-center gap-1.5">
        {!NO_REPLICAS.has(data.archetype) && (
          <>
            <button className={replicaBtn} title="remover réplica" onClick={setReplicas(-1)}>
              −
            </button>
            <span
              className="font-mono text-[10px] text-ink/70"
              title={scaling === "elastic" ? "mínimo → máximo de unidades" : "unidades fixas"}
            >
              {scaling === "elastic" ? `${replicas}→${maxReplicas}` : `×${replicas}`}{" "}
              <span className="text-ink/40">{scaling === "elastic" ? "auto" : "unid"}</span>
            </span>
            <button className={replicaBtn} title="adicionar réplica" onClick={setReplicas(+1)}>
              +
            </button>
          </>
        )}
        {sim && (
          <span
            className="ml-auto font-mono text-[10px] text-ink/50"
            title={`${sim.profile} · capacidade efetiva ${sim.capacity_rps == null ? "sem limite" : `${Math.round(sim.capacity_rps)} RPS`} · ${Math.round(sim.work_units)} unidades de trabalho`}
          >
            {Math.round(sim.rps)} rps · {Math.round(sim.cpu * 100)}% pico
          </span>
        )}
      </div>
      {sim && sim.scaling === "elastic" && (
        <div className="mt-1 font-mono text-[9px] text-cyan-300/80">
          {sim.active_units}/{sim.max_units} unidades ativas
          {sim.scaling_events > 0 ? ` · ${sim.scaling_events} escala` : ""}
        </div>
      )}
      {sim && sim.backlog_messages > 0 && (
        <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-300">
          backlog {Math.round(sim.backlog_messages).toLocaleString("pt-BR")}
        </div>
      )}
      {sim && sim.error_rate > 0.0001 && (
        <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-red-400">
          erro {(sim.error_rate * 100).toFixed(1)}%
        </div>
      )}
      {sim && sim.attack_rps > 0.01 && (
        <div
          className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-red-300"
          title="tráfego adversarial que chegou a este componente"
        >
          ataque {Math.round(sim.attack_rps)} rps
        </div>
      )}
      {sim && sim.blocked_rps > 0.01 && (
        <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
          bloqueado {Math.round(sim.blocked_rps)} rps
        </div>
      )}
      {/* Handles legados continuam registrados para renderizar diagramas já salvos. */}
      <Handle id="left" type="target" position={Position.Left}
        className="!pointer-events-none !opacity-0" />
      <Handle id="top" type="target" position={Position.Top}
        className="!pointer-events-none !opacity-0" />
      <Handle id="right" type="source" position={Position.Right}
        className="!pointer-events-none !opacity-0" />
      <Handle id="bottom" type="source" position={Position.Bottom}
        className="!pointer-events-none !opacity-0" />
      {/* Pares com os mesmos ids recuperam arestas gravadas por versões que
          permitiam iniciar a conexão no tipo oposto do handle. */}
      <Handle id="left" type="source" position={Position.Left}
        className="!pointer-events-none !opacity-0" />
      <Handle id="top" type="source" position={Position.Top}
        className="!pointer-events-none !opacity-0" />
      <Handle id="right" type="target" position={Position.Right}
        className="!pointer-events-none !opacity-0" />
      <Handle id="bottom" type="target" position={Position.Bottom}
        className="!pointer-events-none !opacity-0" />

      {/* Cada lado possui entrada e saída. A saída fica visível e recebe o gesto;
          ao confirmar, o canvas associa o destino à entrada invisível equivalente. */}
      <Handle id="left-target" type="target" position={Position.Left}
        className="!pointer-events-none !opacity-0" />
      <Handle id="top-target" type="target" position={Position.Top}
        className="!pointer-events-none !opacity-0" />
      <Handle id="right-target" type="target" position={Position.Right}
        className="!pointer-events-none !opacity-0" />
      <Handle id="bottom-target" type="target" position={Position.Bottom}
        className="!pointer-events-none !opacity-0" />
      <Handle id="left-source" type="source" position={Position.Left} className="!bg-primary" />
      <Handle id="top-source" type="source" position={Position.Top} className="!bg-primary" />
      <Handle id="right-source" type="source" position={Position.Right} className="!bg-primary" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
