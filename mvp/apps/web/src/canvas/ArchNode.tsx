import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { CanvasNode } from "./store";

/** Nó de arquétipo — Fase 1: nome + tipo. Fase 2 adiciona subtitle, badge de
 *  pendência de metadados e cores de saúde da simulação. */
export function ArchNode({ data, selected }: NodeProps<CanvasNode>) {
  return (
    <div
      className={`min-w-36 rounded-lg border bg-card px-3 py-2 shadow-lg
        ${selected ? "border-primary" : "border-white/15"}`}
    >
      <div className="text-sm font-medium text-ink">{data.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
        {data.label}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
