import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { getDiagram, patchDiagram, type Intake } from "../api/client";
import { AskAI } from "../architect/AskAI";
import { AnnotationNode } from "../canvas/AnnotationNode";
import { ArchNode } from "../canvas/ArchNode";
import { IntentEdge } from "../canvas/IntentEdge";
import { IntentPicker } from "../canvas/IntentPicker";
import { ARCHETYPE_DRAG_TYPE, Palette } from "../canvas/Palette";
import { PropertiesCard } from "../canvas/PropertiesCard";
import { serializeCanvas, useCanvas, type CanvasNode } from "../canvas/store";
import { ExportDialog } from "../exports/ExportDialog";
import { IntakeForm } from "../intake/IntakeForm";
import { isIntakeComplete, toFormValues, toIntakeDraftPayload } from "../intake/schema";
import { JudgesRail } from "../judges/JudgesRail";
import { SimResults } from "../simulation/SimResults";
import { SimulationBar } from "../simulation/SimulationBar";
import { parseTutorialId } from "../tutorial/catalog";
import { useTutorialSignals } from "../tutorial/signals";
import { TutorialOverlay } from "../tutorial/TutorialOverlay";

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
  const setEditingNode = useCanvas((s) => s.setEditingNode);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const connectionOrigin = useRef<{ nodeId: string | null; handleId: string | null }>({
    nodeId: null,
    handleId: null,
  });

  return (
    <>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnectStart={(_, params) => {
        connectionOrigin.current = {
          nodeId: params.nodeId,
          handleId: params.handleId,
        };
      }}
      onConnect={(connection) => {
        const origin = connectionOrigin.current;
        const startsAtTarget = Boolean(
          origin.nodeId &&
          connection.target === origin.nodeId &&
          connection.source !== origin.nodeId,
        );
        const source = startsAtTarget ? connection.target : connection.source;
        const target = startsAtTarget ? connection.source : connection.target;
        const rawSourceHandle = startsAtTarget
          ? connection.targetHandle ?? origin.handleId
          : connection.sourceHandle ?? origin.handleId;
        const rawTargetHandle = startsAtTarget
          ? connection.sourceHandle
          : connection.targetHandle;
        const normalizeArchHandle = (
          nodeId: string | null,
          handleId: string | null,
          role: "source" | "target",
        ) => {
          const node = nodes.find((candidate) => candidate.id === nodeId);
          if (node?.type !== "arch" || !handleId) return handleId;
          const side = handleId.split("-")[0];
          return `${side}-${role}`;
        };
        onConnect(
          {
            source,
            target,
            sourceHandle: normalizeArchHandle(source, rawSourceHandle, "source"),
            targetHandle: normalizeArchHandle(target, rawTargetHandle, "target"),
          },
        );
        connectionOrigin.current = { nodeId: null, handleId: null };
      }}
      onConnectEnd={() => {
        connectionOrigin.current = { nodeId: null, handleId: null };
      }}
      onPaneClick={() => setEditingNode(null)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(ARCHETYPE_DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const payload = JSON.parse(raw) as
          | { kind: "annotation" }
          | {
              archetype: string;
              label: string;
              defaults?: {
                scaling?: "fixed" | "elastic";
                replicas?: number;
                maxReplicas?: number;
                guardrailScope?: "current_turn" | "recent_history";
                guardrailEngine?: "deterministic" | "ml" | "generative";
              };
            };
        if ("kind" in payload) addAnnotation(position);
        else addFromPalette(payload.archetype, payload.label, position, payload.defaults);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      fitView
      connectionMode={ConnectionMode.Loose}
      selectionOnDrag={multiSelectMode}
      selectionMode={SelectionMode.Partial}
      selectionKeyCode="Shift"
      multiSelectionKeyCode={["Shift", "Meta", "Control"]}
      panOnDrag={multiSelectMode ? [1, 2] : true}
      deleteKeyCode={["Backspace", "Delete"]}
      proOptions={{ hideAttribution: true }}
      className="canvas-mat"
    >
      {/* mesa de corte: grade fina + grade maior, acompanhando pan/zoom */}
      <Background
        id="mat-minor"
        variant={BackgroundVariant.Lines}
        gap={16}
        color="rgba(255,255,255,.055)"
      />
      <Background
        id="mat-major"
        variant={BackgroundVariant.Lines}
        gap={80}
        color="rgba(255,255,255,.16)"
      />
      <MiniMap pannable className="!bg-panel" position="bottom-right" />
      <Controls position="bottom-left" />
    </ReactFlow>
    <button
      type="button"
      onClick={() => setMultiSelectMode((active) => !active)}
      aria-pressed={multiSelectMode}
      title={
        multiSelectMode
          ? "desativar seleção múltipla"
          : "selecionar vários componentes por área"
      }
      className={`absolute left-[244px] top-3 z-20 flex h-9 select-none items-center gap-2
                  rounded-lg border px-3 font-mono text-[10px] uppercase tracking-wider shadow-lg
                  transition ${
                    multiSelectMode
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-primary/60 bg-panel/95 text-ink/70 hover:border-primary hover:text-ink"
                  }`}
    >
      <span className="text-sm">{multiSelectMode ? "▣" : "▧"}</span>
      {multiSelectMode ? "Selecionando" : "Selecionar"}
    </button>
    </>
  );
}

export function Session() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [editingContext, setEditingContext] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [judgesOpen, setJudgesOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tutorialId = parseTutorialId(searchParams.get("tutorial"));
  const tutorialActive = tutorialId !== null;

  // sinais do tutorial não vazam entre diagramas/sessões
  useEffect(() => {
    useTutorialSignals.getState().reset();
  }, [id]);
  // outros overlays (HUD) abrem espaço quando o dock do tutorial está visível
  useEffect(() => {
    useTutorialSignals.setState({ active: tutorialActive });
  }, [tutorialActive]);

  const diagram = useQuery({
    queryKey: ["diagram", id],
    queryFn: () => getDiagram(id!),
    staleTime: Infinity,
  });

  // carrega o estado remoto no store quando o diagrama chega
  useEffect(() => {
    if (!diagram.data) return;
    const cs = diagram.data.canvas_state;
    let simulationParams = cs.simulation_params;
    try {
      const local = window.localStorage.getItem(`blueprint-sim-params:${diagram.data.id}`);
      if (local) simulationParams = JSON.parse(local);
    } catch {
      // Um valor local inválido não impede o carregamento do diagrama remoto.
    }
    useCanvas
      .getState()
      .load(
        diagram.data.id,
        (cs.nodes as CanvasNode[]) ?? [],
        (cs.edges as Edge[]) ?? [],
        simulationParams,
      );
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

  // Ao navegar antes dos 5 s do debounce, ainda envia o estado mais recente.
  useEffect(
    () => () => {
      const canvas = useCanvas.getState();
      if (id && canvas.diagramId === id && canvas.rev > 0) {
        void patchDiagram(id, { canvas_state: serializeCanvas() });
      }
    },
    [id],
  );

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
  const hasCompleteIntake = isIntakeComplete(d.intake);
  const hasContextDescription = Boolean(d.intake?.summary?.trim());
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
          title="descrição, requisitos e restrições do diagrama"
          className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px]
                     uppercase tracking-widest text-ink/60 hover:border-primary/60 hover:text-ink"
        >
          Contexto
        </button>
        <button
          onClick={() => setExporting(true)}
          className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px]
                     uppercase tracking-widest text-ink/60 hover:border-primary/60 hover:text-ink"
        >
          Exportar
        </button>
        <span
          className={`ml-auto font-mono text-[10px] uppercase tracking-widest ${
            saveState === "error" ? "text-red-400" : "text-ink/40"
          }`}
        >
          {saveLabel[saveState]}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <ReactFlowProvider>
          <Canvas />
          <Palette />
          <SimulationBar diagramId={d.id} />
          <SimResults />
          <PropertiesCard />
          <AskAI
            diagramId={d.id}
            hasIntake={hasCompleteIntake}
            onNeedContext={() => setEditingContext(true)}
            shiftLeft={judgesOpen}
          />
          <JudgesRail
            diagramId={d.id}
            hasIntake={hasCompleteIntake}
            onNeedContext={() => setEditingContext(true)}
            open={judgesOpen}
            onToggle={setJudgesOpen}
          />
          {tutorialId && (
            <TutorialOverlay
              diagramId={d.id}
              tutorialId={tutorialId}
              hasIntake={hasCompleteIntake}
              hasContextDescription={hasContextDescription}
              onFinish={() => setSearchParams({}, { replace: true })}
            />
          )}
        </ReactFlowProvider>
      </div>

      <IntentPicker />

      {exporting && (
        <ExportDialog
          diagramId={d.id}
          hasIntake={hasCompleteIntake}
          onClose={() => setExporting(false)}
        />
      )}

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
              allowPartial
              onSubmit={(values) => saveContext.mutate(toIntakeDraftPayload(values))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
