import type { Edge } from "@xyflow/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SIM_PARAMS, useCanvas, type CanvasClipboard, type CanvasNode } from "./store";

const sourceNodes: CanvasNode[] = [
  {
    id: "app",
    type: "arch",
    position: { x: 100, y: 120 },
    selected: true,
    data: {
      archetype: "app-server",
      label: "App Server",
      name: "API",
      replicas: 2,
    },
  },
  {
    id: "database",
    type: "arch",
    position: { x: 360, y: 120 },
    selected: true,
    data: {
      archetype: "sql-database",
      label: "SQL Database",
      name: "Primary DB",
    },
  },
];

const sourceEdges: Edge[] = [
  {
    id: "request",
    source: "app",
    target: "database",
    sourceHandle: "right-source",
    targetHandle: "left-target",
    type: "intent",
    data: { intent: "request", routeY1: 180, labelX: 270 },
  },
];

describe("pasteElements", () => {
  beforeEach(() => {
    useCanvas.setState({
      diagramId: "test",
      nodes: structuredClone(sourceNodes),
      edges: structuredClone(sourceEdges),
      rev: 0,
      sim: null,
      simParams: DEFAULT_SIM_PARAMS,
      editingNodeId: null,
      pendingConnection: null,
      proposals: {},
    });
    useCanvas.temporal.getState().clear();
  });

  it("duplica os nós e somente as arestas internas com deslocamento", () => {
    const clipboard: CanvasClipboard = {
      nodes: structuredClone(sourceNodes),
      edges: structuredClone(sourceEdges),
    };

    useCanvas.getState().pasteElements(clipboard, { x: 36, y: 36 });

    const state = useCanvas.getState();
    const pasted = state.nodes.filter((node) => node.selected);
    expect(pasted).toHaveLength(2);
    expect(pasted.map((node) => node.position)).toEqual([
      { x: 136, y: 156 },
      { x: 396, y: 156 },
    ]);
    expect(state.edges).toHaveLength(2);
    const pastedEdge = state.edges[1];
    expect(pastedEdge.source).toBe(pasted[0].id);
    expect(pastedEdge.target).toBe(pasted[1].id);
    expect(pastedEdge.data).toEqual(sourceEdges[0].data);
    expect(state.rev).toBe(1);
  });

  it("preserva o tamanho de um grupo visual sem compartilhar os dados", () => {
    const group: CanvasNode = {
      id: "group",
      type: "visualGroup",
      position: { x: 20, y: 40 },
      zIndex: -1,
      data: { name: "Conta AWS", width: 640, height: 360 },
    };

    useCanvas.getState().pasteElements({ nodes: [group], edges: [] }, { x: 72, y: 72 });

    const pasted = useCanvas.getState().nodes.at(-1)!;
    expect(pasted.type).toBe("visualGroup");
    expect(pasted.position).toEqual({ x: 92, y: 112 });
    expect(pasted.data).toEqual(group.data);
    expect(pasted.data).not.toBe(group.data);
    expect(pasted.zIndex).toBe(-1);
  });
});
