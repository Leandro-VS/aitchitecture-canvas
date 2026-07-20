import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";

import { useCanvas, type GroupData } from "./store";

/** Região visual independente: organiza o desenho sem participar do fluxo ou da simulação. */
export function GroupNode({ id, data, selected }: NodeProps<Node<GroupData, "visualGroup">>) {
  const updateNodeData = useCanvas((state) => state.updateNodeData);
  const setEditingNode = useCanvas((state) => state.setEditingNode);

  return (
    <div
      style={{ width: data.width, height: data.height }}
      className={`pointer-events-none relative rounded-lg border-2 border-dashed bg-primary/[0.025]
                  ${selected ? "border-primary" : "border-primary/55"}`}
    >
      <NodeResizer
        minWidth={220}
        minHeight={140}
        isVisible={selected}
        lineClassName="!border-primary/70"
        handleClassName="!pointer-events-auto !h-3 !w-3 !border-2 !border-primary !bg-panel"
        onResize={(_, size) => updateNodeData(id, { width: size.width, height: size.height })}
      />
      <button
        type="button"
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditingNode(id);
        }}
        className="group-drag-handle pointer-events-auto absolute left-3 top-0 -translate-y-1/2
                   cursor-move rounded-md border border-primary/50 bg-panel px-2.5 py-1
                   font-mono text-[10px] uppercase tracking-widest text-primary shadow-md"
        title="arraste para mover; duplo clique para editar"
      >
        {data.name || "Grupo"}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setEditingNode(id);
        }}
        className="nodrag pointer-events-auto absolute right-2 top-2 rounded px-1.5 py-0.5
                   font-mono text-[10px] text-primary/60 hover:bg-primary/10 hover:text-primary"
        title="editar grupo"
      >
        ✎
      </button>
    </div>
  );
}
