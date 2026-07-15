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

export function ArchNode({ id, data, selected }: NodeProps<Node<ArchNodeData, "arch">>) {
  const sim = useCanvas((s) => s.sim?.nodes?.[id]);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const replicas = data.replicas ?? 1;

  const border = selected
    ? "border-primary"
    : sim
      ? healthBorder[sim.health]
      : "border-white/15";

  const setReplicas = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { replicas: Math.min(100, Math.max(1, replicas + delta)) });
  };

  return (
    <div className={`min-w-36 rounded-lg border bg-card px-3 py-2 shadow-lg ${border}`}>
      <div className="text-sm font-medium text-ink">{data.name}</div>
      {data.subtitle && <div className="text-xs text-ink/60">{data.subtitle}</div>}
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
        {data.label}
      </div>
      <div className="nodrag mt-1.5 flex items-center gap-1.5">
        <button className={replicaBtn} title="remover réplica" onClick={setReplicas(-1)}>
          −
        </button>
        <span className="font-mono text-[10px] text-ink/70">×{replicas}</span>
        <button className={replicaBtn} title="adicionar réplica" onClick={setReplicas(+1)}>
          +
        </button>
        {sim && (
          <span className="ml-auto font-mono text-[10px] text-ink/50">
            {Math.round(sim.rps)} rps · {Math.round(sim.cpu * 100)}%
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
