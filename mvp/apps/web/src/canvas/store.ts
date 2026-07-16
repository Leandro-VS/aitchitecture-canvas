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

import type { ProposedDiff, SimResult } from "../api/client";
import { dagreLayout } from "./layout";

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
  /** sugestão do Arquiteto ainda não aceita — excluída do autosave/simulação/juiz */
  ghost?: boolean;
  proposalId?: string; // message_id do diff que criou este elemento
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

  /** diffs propostos pelo Arquiteto, indexados pelo message_id */
  proposals: Record<string, ProposedDiff>;
  applyProposal: (
    messageId: string,
    diff: ProposedDiff,
    origin: XYPosition,
    labelOf: Record<string, string>,
  ) => void;
  materializeProposal: (messageId: string) => void;
  dismissProposal: (messageId: string) => void;
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

      proposals: {},

      applyProposal: (messageId, diff, origin, labelOf) => {
        const { dismissProposal } = get();
        dismissProposal(messageId); // idempotente: re-mostrar não duplica ghosts

        const adds = diff.ops.filter((op) => op.op === "add_node");
        const connects = diff.ops.filter((op) => op.op === "connect");
        const positions = dagreLayout(
          adds.map((op) => ({ id: op.id })),
          connects
            .filter((op) => adds.some((a) => a.id === op.source || a.id === op.target))
            .map((op) => ({ source: op.source, target: op.target })),
        );
        const ghostNodes: CanvasNode[] = adds.map((op) => ({
          id: op.id,
          type: "arch" as const,
          position: {
            x: origin.x + (positions[op.id]?.x ?? 0),
            y: origin.y + (positions[op.id]?.y ?? 0),
          },
          data: {
            archetype: op.archetype,
            label: labelOf[op.archetype] ?? op.archetype,
            name: op.name,
            subtitle: op.subtitle ?? undefined,
            ghost: true,
            proposalId: messageId,
          },
        }));
        const ghostEdges: Edge[] = connects.map((op, i) => ({
          id: `ghost-${messageId}-${i}`,
          source: op.source,
          target: op.target,
          type: "intent",
          data: { intent: op.intent, ghost: true, proposalId: messageId },
        }));
        set((s) => ({
          nodes: [...s.nodes, ...ghostNodes],
          edges: [...s.edges, ...ghostEdges],
          proposals: { ...s.proposals, [messageId]: diff },
        }));
      },

      materializeProposal: (messageId) => {
        const diff = get().proposals[messageId];
        set((s) => {
          let nodes = s.nodes.map((n) =>
            n.data.proposalId === messageId
              ? ({ ...n, data: { ...n.data, ghost: false, proposalId: undefined } } as CanvasNode)
              : n,
          );
          // ops sobre nós existentes (update/remove) aplicam na materialização
          for (const op of diff?.ops ?? []) {
            if (op.op === "update_metadata") {
              nodes = nodes.map((n) =>
                n.id === op.id ? ({ ...n, data: { ...n.data, ...op.fields } } as CanvasNode) : n,
              );
            } else if (op.op === "remove_node") {
              nodes = nodes.filter((n) => n.id !== op.id);
            }
          }
          const removed = new Set(
            (diff?.ops ?? []).filter((op) => op.op === "remove_node").map((op) => op.id),
          );
          const proposals = { ...s.proposals };
          delete proposals[messageId];
          return {
            nodes,
            edges: s.edges
              .filter((e) => !removed.has(e.source) && !removed.has(e.target))
              .map((e) =>
                (e.data as { proposalId?: string } | undefined)?.proposalId === messageId
                  ? { ...e, data: { ...e.data, ghost: false, proposalId: undefined } }
                  : e,
              ),
            proposals,
            rev: s.rev + 1, // aplicar é mudança de conteúdo → autosave + re-sim
          };
        });
      },

      dismissProposal: (messageId) =>
        set((s) => {
          const proposals = { ...s.proposals };
          delete proposals[messageId];
          return {
            nodes: s.nodes.filter((n) => n.data.proposalId !== messageId),
            edges: s.edges.filter(
              (e) => (e.data as { proposalId?: string } | undefined)?.proposalId !== messageId,
            ),
            proposals,
          };
        }),
    }),
    { limit: 100, partialize: (s) => ({ nodes: s.nodes, edges: s.edges }) },
  ),
);

export const serializeCanvas = () => {
  const { nodes, edges } = useCanvas.getState();
  // ghosts (sugestões não aceitas) nunca entram no autosave/simulação/juiz
  return {
    nodes: nodes
      .filter((n) => !n.data.ghost)
      .map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges
      .filter((e) => !(e.data as { ghost?: boolean } | undefined)?.ghost)
      .map(({ id, source, target, type, data }) => ({ id, source, target, type, data })),
  };
};
