import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getDiagram, patchDiagram, type Diagram } from "../api/client";
import { ArchNode } from "../canvas/ArchNode";
import { ARCHETYPE_DRAG_TYPE, Palette } from "../canvas/Palette";
import { serializeCanvas, useCanvas, type CanvasNode } from "../canvas/store";
import { IntakeForm } from "../intake/IntakeForm";
import { toFormValues, toIntakePayload } from "../intake/schema";

const nodeTypes = { arch: ArchNode };
const AUTOSAVE_DEBOUNCE_MS = 5000;

type SaveState = "saved" | "pending" | "saving" | "error";

function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addFromPalette } = useCanvas();
  const { screenToFlowPosition } = useReactFlow();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(ARCHETYPE_DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        const { archetype, label } = JSON.parse(raw) as { archetype: string; label: string };
        addFromPalette(archetype, label, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      fitView
      proOptions={{ hideAttribution: true }}
      className="bg-bg"
    >
      <Background variant={BackgroundVariant.Dots} gap={48} color="rgba(59,130,246,.18)" />
      <MiniMap pannable className="!bg-panel" />
      <Controls />
    </ReactFlow>
  );
}

export function Session() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [editingContext, setEditingContext] = useState(false);

  const diagram = useQuery({
    queryKey: ["diagram", id],
    queryFn: () => getDiagram(id!),
    staleTime: Infinity,
  });

  // carrega o estado remoto no store quando o diagrama chega
  useEffect(() => {
    if (!diagram.data) return;
    const cs = diagram.data.canvas_state;
    useCanvas
      .getState()
      .load(diagram.data.id, (cs.nodes as CanvasNode[]) ?? [], (cs.edges as Edge[]) ?? []);
    setSaveState("saved");
  }, [diagram.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // autosave: debounce por inatividade observando rev do store
  const rev = useCanvas((s) => s.rev);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (rev === 0 || !id) return;
    setSaveState("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await patchDiagram(id, { canvas_state: serializeCanvas() });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [rev, id]);

  // undo/redo (Ctrl+Z / Ctrl+Shift+Z)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const t = useCanvas.temporal.getState();
        if (e.shiftKey) t.redo();
        else t.undo();
        // undo/redo também é mudança de conteúdo → acorda o autosave
        useCanvas.setState((s) => ({ rev: s.rev + 1 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveContext = useMutation({
    mutationFn: (body: { title: string; intake: Diagram["intake"] }) => patchDiagram(id!, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["diagram", id], updated);
      setEditingContext(false);
    },
  });

  if (diagram.isLoading) return <p className="p-8 text-ink/60">carregando…</p>;
  if (diagram.isError || !diagram.data)
    return <p className="p-8 text-red-400">Diagrama não encontrado.</p>;

  const d = diagram.data;
  const saveLabel: Record<SaveState, string> = {
    saved: "salvo",
    pending: "alterações pendentes…",
    saving: "salvando…",
    error: "erro ao salvar — tentará de novo na próxima edição",
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-white/10 bg-panel px-4 py-2">
        <Link to="/" className="font-mono text-xs text-ink/40 hover:text-primary">
          ← diagramas
        </Link>
        <h1 className="truncate font-display text-sm font-semibold">{d.title}</h1>
        <button
          onClick={() => setEditingContext(true)}
          className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink/60 hover:border-primary/60"
        >
          Contexto
        </button>
        <span
          className={`ml-auto font-mono text-[10px] uppercase tracking-widest ${
            saveState === "error" ? "text-red-400" : "text-ink/40"
          }`}
        >
          {saveLabel[saveState]}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="min-w-0 flex-1">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </main>
      </div>

      {editingContext && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-8">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Contexto do diagrama</h2>
              <button
                onClick={() => setEditingContext(false)}
                className="text-sm text-ink/50 hover:text-ink"
              >
                fechar ✕
              </button>
            </div>
            <IntakeForm
              defaultValues={toFormValues(d.title, d.intake)}
              submitLabel="Salvar contexto"
              busy={saveContext.isPending}
              onSubmit={(values) => saveContext.mutate(toIntakePayload(values))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
