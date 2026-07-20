import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { hasScalingControls, hasSizeControls } from "./capacity";
import { useCanvas, type ArchNodeData } from "./store";

const healthBorder = {
  ok: "border-emerald-500/70",
  hot: "border-amber-400",
  critical: "border-red-500",
} as const;

const replicaBtn =
  "flex h-4 w-4 items-center justify-center rounded border border-white/15 " +
  "font-mono text-[10px] leading-none text-ink/60 hover:border-primary hover:text-ink";

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
  const capacityManagedExternally = data.capacityManagedExternally === true;
  const sizeControls = !capacityManagedExternally && hasSizeControls(data.archetype);
  const scalingControls = !capacityManagedExternally && hasScalingControls(data.archetype);
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
      : sim && !capacityManagedExternally
        ? healthBorder[sim.health]
        : "border-white/15";
  const simulationEffect = capacityManagedExternally
    ? ""
    : sim?.health === "critical"
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
        title={scalingControls
          ? "editar nome, porte e política de escala"
          : sizeControls
            ? "editar nome, subtítulo e porte"
            : "editar nome e subtítulo"}
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
      {capacityManagedExternally && (
        <div className="mt-1">
          <span
            className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5
                       font-mono text-[8px] uppercase tracking-wide text-cyan-200"
            title="capacidade gerenciada por um provedor ou outra área"
          >
            fora da simulação
          </span>
        </div>
      )}
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
      {sizeControls && (
        <div className="mt-1 flex gap-1 font-mono text-[9px] uppercase tracking-wide">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-ink/55" title={`porte ${size}`}>
            {sizeCode[size]}
          </span>
          {scalingControls && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-ink/55">
              {scaling === "elastic" ? "auto" : "fixa"}
            </span>
          )}
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
        {scalingControls && (
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
        {sim && capacityManagedExternally ? (
          <span
            className="font-mono text-[10px] text-cyan-100/60"
            title="fora da simulação; o fluxo e a latência permanecem"
          >
            {Math.round(sim.rps)} rps · {Math.round(sim.latency_ms)} ms
          </span>
        ) : sim && (
          <span
            className="ml-auto font-mono text-[10px] text-ink/50"
            title={`${sim.profile} · capacidade efetiva ${sim.capacity_rps == null ? "sem limite" : `${Math.round(sim.capacity_rps)} RPS`} · ${Math.round(sim.work_units)} unidades de trabalho`}
          >
            {Math.round(sim.rps)} rps · {Math.round(sim.cpu * 100)}% pico
          </span>
        )}
      </div>
      {scalingControls && sim && sim.scaling === "elastic" && (
        <div className="mt-1 font-mono text-[9px] text-cyan-300/80">
          {sim.active_units}/{sim.max_units} unidades ativas
          {sim.scaling_events > 0 ? ` · ${sim.scaling_events} escala` : ""}
        </div>
      )}
      {!capacityManagedExternally && sim && sim.backlog_messages > 0 && (
        <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-300">
          backlog {Math.round(sim.backlog_messages).toLocaleString("pt-BR")}
        </div>
      )}
      {!capacityManagedExternally && sim && sim.error_rate > 0.0001 && (
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
