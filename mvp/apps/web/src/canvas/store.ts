import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { temporal } from "zundo";
import { create } from "zustand";

export interface ArchNodeData extends Record<string, unknown> {
  archetype: string;
  label: string; // label do arquétipo (ex.: "SQL Database")
  name: string; // nome editável do componente (D8)
}

export type CanvasNode = Node<ArchNodeData>;

interface CanvasStore {
  diagramId: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
  /** incrementa a cada mutação real — o autosave observa isso (0 = recém-carregado) */
  rev: number;
  load: (diagramId: string, nodes: CanvasNode[], edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addFromPalette: (archetype: string, label: string, position: XYPosition) => void;
}

let nodeSeq = 0;
const newNodeId = () => `n-${Date.now().toString(36)}-${nodeSeq++}`;

export const useCanvas = create<CanvasStore>()(
  temporal(
    (set, get) => ({
      diagramId: null,
      nodes: [],
      edges: [],
      rev: 0,

      load: (diagramId, nodes, edges) => {
        set({ diagramId, nodes, edges, rev: 0 });
        useCanvas.temporal.getState().clear(); // histórico de undo não cruza diagramas
      },

      onNodesChange: (changes) =>
        set((s) => ({
          nodes: applyNodeChanges(changes, s.nodes),
          // seleção não é mudança de conteúdo — não dispara autosave
          rev: changes.some((c) => c.type !== "select") ? s.rev + 1 : s.rev,
        })),

      onEdgesChange: (changes) =>
        set((s) => ({
          edges: applyEdgeChanges(changes, s.edges),
          rev: changes.some((c) => c.type !== "select") ? s.rev + 1 : s.rev,
        })),

      onConnect: (connection) =>
        set((s) => ({ edges: addEdge(connection, s.edges), rev: s.rev + 1 })),

      addFromPalette: (archetype, label, position) =>
        set((s) => ({
          rev: s.rev + 1,
          nodes: [
            ...s.nodes,
            {
              id: newNodeId(),
              type: "arch",
              position,
              data: { archetype, label, name: label },
            },
          ],
        })),
    }),
    { limit: 100, partialize: (s) => ({ nodes: s.nodes, edges: s.edges }) },
  ),
);

export const serializeCanvas = () => {
  const { nodes, edges } = useCanvas.getState();
  return {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
  };
};
