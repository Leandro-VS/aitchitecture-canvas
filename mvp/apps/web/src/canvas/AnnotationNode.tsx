import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { useCanvas, type AnnotationData } from "./store";

/** Balão de comentário (D13/M12): fora da simulação, insumo das IAs e do pré-ADR.
 *  Solto no canvas ou ancorado — arraste do handle até um nó para ancorar. */
export function AnnotationNode({ id, data, selected }: NodeProps<Node<AnnotationData, "annotation">>) {
  const setEditingNode = useCanvas((s) => s.setEditingNode);
  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditingNode(id);
      }}
      className={`relative max-w-56 min-w-40 rounded-md border bg-amber-200/10 px-3 py-2
        shadow-md ${selected ? "border-amber-300" : "border-amber-400/40 border-dashed"}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditingNode(id);
        }}
        title="editar comentário"
        className="nodrag absolute right-1 top-1 rounded px-1 font-mono text-[10px]
                   text-amber-300/50 hover:bg-white/10 hover:text-amber-200"
      >
        ✎
      </button>
      <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-amber-300/70">
        comentário
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs leading-snug text-amber-100/90">
        {data.text || "vazio — clique no ✎ para escrever"}
      </p>
      {/* connectionMode=loose: os quatro lados podem ancorar o comentário. */}
      <Handle id="left" type="source" position={Position.Left} className="!bg-amber-400" />
      <Handle id="top" type="source" position={Position.Top} className="!bg-amber-400" />
      <Handle id="right" type="source" position={Position.Right} className="!bg-amber-400" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!bg-amber-400" />
    </div>
  );
}
