import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { useCanvas, type ArchNodeData } from "./store";

const healthBorder = {
  ok: "border-emerald-500/70",
  hot: "border-amber-400",
  critical: "border-red-500 animate-pulse",
} as const;

const replicaBtn =
  "flex h-4 w-4 items-center justify-center rounded border border-white/15 " +
  "font-mono text-[10px] leading-none text-ink/60 hover:border-primary hover:text-ink";

// clients têm capacidade infinita — o tráfego é controlado pelo simulador,
// então réplicas não fazem sentido (controles ocultos)
const NO_REPLICAS = new Set(["client", "mobile"]);

export function ArchNode({ id, data, selected }: NodeProps<Node<ArchNodeData, "arch">>) {
  const sim = useCanvas((s) => s.sim?.nodes?.[id]);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const setEditingNode = useCanvas((s) => s.setEditingNode);
  const replicas = data.replicas ?? 1;

  const border = data.ghost
    ? "border-dashed border-cyan-400/80"
    : selected
      ? "border-primary"
      : sim
        ? healthBorder[sim.health]
        : "border-white/15";

  const setReplicas = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { replicas: Math.min(100, Math.max(1, replicas + delta)) });
  };

  return (
    <div
      className={`relative min-w-36 rounded-lg border bg-card px-3 py-2 shadow-lg ${border}
        ${data.ghost ? "opacity-75" : ""}`}
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
        title="editar nome e subtítulo"
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
      <div className="nodrag mt-1.5 flex items-center gap-1.5">
        {!NO_REPLICAS.has(data.archetype) && (
          <>
            <button className={replicaBtn} title="remover réplica" onClick={setReplicas(-1)}>
              −
            </button>
            <span className="font-mono text-[10px] text-ink/70" title="réplicas do componente">
              ×{replicas} <span className="text-ink/40">repl</span>
            </span>
            <button className={replicaBtn} title="adicionar réplica" onClick={setReplicas(+1)}>
              +
            </button>
          </>
        )}
        {sim && (
          <span className="ml-auto font-mono text-[10px] text-ink/50">
            {Math.round(sim.rps)} rps · {Math.round(sim.cpu * 100)}%
          </span>
        )}
      </div>
      {/* 4 pontos de conexão (connectionMode=loose: qualquer um conecta a qualquer um) */}
      <Handle id="left" type="target" position={Position.Left} className="!bg-primary" />
      <Handle id="top" type="target" position={Position.Top} className="!bg-primary" />
      <Handle id="right" type="source" position={Position.Right} className="!bg-primary" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
