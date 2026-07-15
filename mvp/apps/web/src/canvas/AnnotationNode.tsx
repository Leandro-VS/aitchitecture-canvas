import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import type { AnnotationData } from "./store";

/** Balão de comentário (D13/M12): fora da simulação, insumo das IAs e do pré-ADR.
 *  Solto no canvas ou ancorado — arraste do handle até um nó para ancorar. */
export function AnnotationNode({ data, selected }: NodeProps<Node<AnnotationData, "annotation">>) {
  return (
    <div
      className={`max-w-56 min-w-40 rounded-md border px-3 py-2 shadow-md
        bg-amber-200/10 backdrop-blur-sm
        ${selected ? "border-amber-300" : "border-amber-400/40 border-dashed"}`}
    >
      <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-amber-300/70">
        comentário
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs leading-snug text-amber-100/90">
        {data.text || "vazio — escreva no painel à direita"}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-amber-400" />
    </div>
  );
}
