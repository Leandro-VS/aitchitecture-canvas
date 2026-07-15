import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { temporal } from "zundo";
import { create } from "zustand";

import type { SimResult } from "../api/client";

export const INTENTS = [
  "request",
  "cache_lookup",
  "async_enqueue",
  "llm_call",
  "retrieval",
  "guardrail_check",
] as const;
export type Intent = (typeof INTENTS)[number];

export interface ArchNodeData extends Record<string, unknown> {
  archetype: string;
  label: string; // label do arquétipo (ex.: "SQL Database")
  name: string; // nome exibido (default: label)
  subtitle?: string; // D16 — opcional, como tudo aqui (decisão: sem gate de metadados)
  replicas?: number; // controlado pelos botões −/+ no próprio nó
}

export interface AnnotationData extends Record<string, unknown> {
  text: string;
}

export type CanvasNode = Node<ArchNodeData, "arch"> | Node<AnnotationData, "annotation">;

export const isArchNode = (n: CanvasNode): n is Node<ArchNodeData, "arch"> =>
  n.type === "arch";

interface CanvasStore {
  diagramId: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
  /** incrementa a cada mutação real — o autosave observa isso (0 = recém-carregado) */
  rev: number;
  /** conexão aguardando escolha de intent (picker aberto) */
  pendingConnection: Connection | null;
  sim: SimResult | null;

  load: (diagramId: string, nodes: CanvasNode[], edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  confirmConnection: (intent: Intent) => void;
  cancelConnection: () => void;
  addFromPalette: (archetype: string, label: string, position: XYPosition) => void;
  addAnnotation: (position: XYPosition) => void;
  updateNodeData: (id: string, fields: Record<string, unknown>) => void;
  setSim: (sim: SimResult | null) => void;
  selectNodes: (ids: string[]) => void;
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export const useCanvas = create<CanvasStore>()(
  temporal(
    (set, get) => ({
      diagramId: null,
      nodes: [],
      edges: [],
      rev: 0,
      pendingConnection: null,
      sim: null,

      load: (diagramId, nodes, edges) => {
        set({ diagramId, nodes, edges, rev: 0, pendingConnection: null, sim: null });
        useCanvas.temporal.getState().clear(); // histórico de undo não cruza diagramas
      },

      onNodesChange: (changes) =>
        set((s) => ({
          nodes: applyNodeChanges(changes, s.nodes) as CanvasNode[],
          // seleção não é mudança de conteúdo — não dispara autosave
          rev: changes.some((c) => c.type !== "select") ? s.rev + 1 : s.rev,
        })),

      onEdgesChange: (changes) =>
        set((s) => ({
          edges: applyEdgeChanges(changes, s.edges),
          rev: changes.some((c) => c.type !== "select") ? s.rev + 1 : s.rev,
        })),

      onConnect: (connection) => {
        const { nodes } = get();
        const isAnnotation = (id: string | null) =>
          nodes.some((n) => n.id === id && n.type === "annotation");
        // balão ancorado (D13): edge de âncora direto, sem picker de intent
        if (isAnnotation(connection.source) || isAnnotation(connection.target)) {
          set((s) => ({
            rev: s.rev + 1,
            edges: [
              ...s.edges,
              {
                id: newId("anchor"),
                source: connection.source!,
                target: connection.target!,
                type: "intent",
                data: { intent: "annotation" },
              },
            ],
          }));
          return;
        }
        set({ pendingConnection: connection });
      },

      confirmConnection: (intent) => {
        const c = get().pendingConnection;
        if (!c) return;
        set((s) => ({
          pendingConnection: null,
          rev: s.rev + 1,
          edges: [
            ...s.edges,
            {
              id: newId("e"),
              source: c.source!,
              target: c.target!,
              type: "intent",
              data: { intent },
            },
          ],
        }));
      },

      cancelConnection: () => set({ pendingConnection: null }),

      addFromPalette: (archetype, label, position) =>
        set((s) => ({
          rev: s.rev + 1,
          nodes: [
            ...s.nodes,
            {
              id: newId("n"),
              type: "arch" as const,
              position,
              data: { archetype, label, name: label },
            },
          ],
        })),

      addAnnotation: (position) =>
        set((s) => ({
          rev: s.rev + 1,
          nodes: [
            ...s.nodes,
            {
              id: newId("note"),
              type: "annotation" as const,
              position,
              data: { text: "" },
            },
          ],
        })),

      updateNodeData: (id, fields) =>
        set((s) => ({
          rev: s.rev + 1,
          nodes: s.nodes.map((n) =>
            n.id === id ? ({ ...n, data: { ...n.data, ...fields } } as CanvasNode) : n,
          ),
        })),

      setSim: (sim) => set({ sim }), // não bumpa rev: resultado não é conteúdo do canvas

      selectNodes: (ids) =>
        set((s) => ({
          nodes: s.nodes.map((n) => ({ ...n, selected: ids.includes(n.id) })) as CanvasNode[],
        })),
    }),
    { limit: 100, partialize: (s) => ({ nodes: s.nodes, edges: s.edges }) },
  ),
);

export const serializeCanvas = () => {
  const { nodes, edges } = useCanvas.getState();
  return {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target, type, data }) => ({
      id,
      source,
      target,
      type,
      data,
    })),
  };
};
