import dagre from "@dagrejs/dagre";
import type { XYPosition } from "@xyflow/react";

const NODE_W = 190;
const NODE_H = 84;

/** Auto-layout hierárquico (esboço do bootstrap): Client à esquerda, dados à direita. */
export function dagreLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
): Record<string, XYPosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const positions: Record<string, XYPosition> = {};
  for (const n of nodes) {
    const pos = g.node(n.id);
    positions[n.id] = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
  }
  return positions;
}
