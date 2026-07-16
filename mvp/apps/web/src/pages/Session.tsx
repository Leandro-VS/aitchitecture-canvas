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

import { getDiagram, patchDiagram, type Intake } from "../api/client";
import { AnnotationNode } from "../canvas/AnnotationNode";
import { ArchNode } from "../canvas/ArchNode";
import { IntentEdge } from "../canvas/IntentEdge";
import { IntentPicker } from "../canvas/IntentPicker";
import { ARCHETYPE_DRAG_TYPE, Palette } from "../canvas/Palette";
import { PropertiesPanel } from "../canvas/PropertiesPanel";
import { serializeCanvas, useCanvas, type CanvasNode } from "../canvas/store";
import { IntakeForm } from "../intake/IntakeForm";
import { toFormValues, toIntakePayload } from "../intake/schema";
import { JudgePanel } from "../judges/JudgePanel";
import { SimulationPanel } from "../simulation/SimulationPanel";

const nodeTypes = { arch: ArchNode, annotation: AnnotationNode };
const edgeTypes = { intent: IntentEdge };
const AUTOSAVE_DEBOUNCE_MS = 5000;

type SaveState = "saved" | "pending" | "saving" | "error";

function Canvas() {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const onNodesChange = useCanvas((s) => s.onNodesChange);
  const onEdgesChange = useCanvas((s) => s.onEdgesChange);
  const onConnect = useCanvas((s) => s.onConnect);
  const addFromPalette = useCanvas((s) => s.addFromPalette);
  const addAnnotation = useCanvas((s) => s.addAnnotation);
  const { screenToFlowPosition } = useReactFlow();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(ARCHETYPE_DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const payload = JSON.parse(raw) as
          | { kind: "annotation" }
          | { archetype: string; label: string };
        if ("kind" in payload) addAnnotation(position);
        else addFromPalette(payload.archetype, payload.label, position);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      fitView
      deleteKeyCode={["Backspace", "Delete"]}
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
    mutationFn: (body: { title: string; intake: Intake }) => patchDiagram(id!, body),
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
      <header className="flex select-none items-center gap-4 border-b border-white/10 bg-panel px-4 py-2">
        <Link to="/" className="font-mono text-xs text-ink/40 hover:text-primary">
          ← diagramas
        </Link>
        <h1 className="truncate font-display text-sm font-semibold">{d.title}</h1>
        <button
          onClick={() => setEditingContext(true)}
          title={d.intake ? undefined : "obrigatório para usar os recursos de IA"}
          className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest
            ${d.intake
              ? "border-white/10 text-ink/60 hover:border-primary/60"
              : "border-amber-400/50 text-amber-300 hover:border-amber-300"}`}
        >
          Contexto{!d.intake && " — pendente p/ IA"}
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
        {/* select-none: arrastar sliders não pode sair selecionando texto/canvas */}
        <aside className="w-72 shrink-0 select-none space-y-5 overflow-y-auto border-l border-white/10 bg-panel p-3">
          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/50">
              Simulação
            </h2>
            <SimulationPanel diagramId={d.id} />
          </section>
          <section className="border-t border-white/10 pt-4">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/50">
              Juiz
            </h2>
            <JudgePanel
              diagramId={d.id}
              hasIntake={d.intake !== null}
              onNeedContext={() => setEditingContext(true)}
            />
          </section>
          <section className="border-t border-white/10 pt-4">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/50">
              Propriedades
            </h2>
            <PropertiesPanel />
          </section>
        </aside>
      </div>

      <IntentPicker />

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
