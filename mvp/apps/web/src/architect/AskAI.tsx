import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  api,
  ApiError,
  applyDiff,
  dismissDiff,
  getArchitectMessages,
  streamChat,
  type Archetype,
  type ArchitectMessage,
  type ProposedDiff,
} from "../api/client";
import { serializeCanvas, useCanvas } from "../canvas/store";
import { useTutorialSignals } from "../tutorial/signals";

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onNeedContext: () => void;
  /** painel do AI Judge aberto → empurra o Ask AI para a esquerda */
  shiftLeft: boolean;
}

function DiffCard({ message, labelOf, ghostOrigin }: {
  message: ArchitectMessage;
  labelOf: Record<string, string>;
  ghostOrigin: () => { x: number; y: number };
}) {
  const queryClient = useQueryClient();
  const diff = message.proposed_diff!;
  const inStore = useCanvas((s) => Boolean(s.proposals[message.id]));
  const materializeProposal = useCanvas((s) => s.materializeProposal);
  const dismissProposal = useCanvas((s) => s.dismissProposal);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["architect-messages"] });
  const apply = useMutation({
    mutationFn: () => applyDiff(message.id),
    onSuccess: () => {
      materializeProposal(message.id);
      useTutorialSignals.getState().emit("diffApplied");
      refresh();
    },
  });
  const dismiss = useMutation({
    mutationFn: () => dismissDiff(message.id),
    onSuccess: () => {
      dismissProposal(message.id);
      refresh();
    },
  });

  const adds = diff.ops.filter((op) => op.op === "add_node").length;
  const connects = diff.ops.filter((op) => op.op === "connect").length;

  return (
    <div className="mt-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/5 p-2">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">
          sugestão de diff
        </span>
        <span className="font-mono text-[9px] text-ink/50">
          +{adds} nós · {connects} conexões
        </span>
        {message.diff_status !== "proposed" && (
          <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
            message.diff_status === "applied"
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-white/5 text-ink/40"
          }`}>
            {message.diff_status === "applied" ? "aplicado" : "descartado"}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-ink/75">{diff.rationale}</p>
      {diff.citations.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {diff.citations.map((c, i) => (
            <span key={i} title={c.excerpt}
              className="rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
              {c.doc_id} &gt; {c.section}
            </span>
          ))}
        </div>
      )}
      {message.diff_status === "proposed" && (
        <div className="mt-2 flex gap-1.5">
          {inStore ? (
            <>
              <button
                onClick={() => apply.mutate()}
                disabled={apply.isPending}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white
                           hover:bg-primary/80 disabled:opacity-50"
              >
                Apply
              </button>
              <button
                onClick={() => dismiss.mutate()}
                disabled={dismiss.isPending}
                className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-ink/70
                           hover:border-red-400/60 hover:text-red-300"
              >
                Dismiss
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                useCanvas.getState().applyProposal(message.id, diff, ghostOrigin(), labelOf)
              }
              className="rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-300
                         hover:border-cyan-300"
            >
              Mostrar no canvas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AskAI({ diagramId, hasIntake, onNeedContext, shiftLeft }: Props) {
  const queryClient = useQueryClient();
  const { screenToFlowPosition } = useReactFlow();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["architect-messages", diagramId],
    queryFn: () => getArchitectMessages(diagramId),
    enabled: open,
  });
  const archetypes = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
    staleTime: Infinity,
  });
  const labelOf = useMemo(
    () => Object.fromEntries((archetypes.data ?? []).map((a) => [a.archetype, a.label])),
    [archetypes.data],
  );

  const ghostOrigin = () => {
    const pane = document.querySelector(".react-flow");
    const r = pane?.getBoundingClientRect();
    return screenToFlowPosition({
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.top + r.height / 2 : window.innerHeight / 2,
    });
  };

  // autoscroll no fim da conversa
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data, streaming]);

  // tutorial: pergunta sugerida → abre o painel e envia automaticamente
  const suggestedPrompt = useTutorialSignals((s) => s.suggestedPrompt);
  useEffect(() => {
    if (!suggestedPrompt) return;
    const prompt = useTutorialSignals.getState().consumePrompt();
    if (!prompt) return;
    setOpen(true);
    void send(prompt);
  }, [suggestedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text: string) => {
    if (!text || streaming !== null) return;
    setInput("");
    setError(null);
    setStreaming("");
    // mostra a pergunta imediatamente (o histórico real vem no done)
    queryClient.setQueryData(
      ["architect-messages", diagramId],
      (old: ArchitectMessage[] | undefined) => [
        ...(old ?? []),
        {
          id: `tmp-${Date.now()}`, role: "user" as const, content: text,
          proposed_diff: null, diff_status: null, created_at: new Date().toISOString(),
        },
      ],
    );
    try {
      await streamChat(diagramId, text, serializeCanvas(), {
        onToken: (t) => setStreaming((s) => (s ?? "") + t),
        onProposedDiff: (diff) =>
          useCanvas.getState().applyProposal(
            diff.message_id,
            diff as ProposedDiff,
            ghostOrigin(),
            labelOf,
          ),
        onDone: () => {
          setStreaming(null);
          useTutorialSignals.getState().emit("architectReplied");
          queryClient.invalidateQueries({ queryKey: ["architect-messages", diagramId] });
        },
      });
    } catch (err) {
      setStreaming(null);
      if (err instanceof ApiError && err.status === 409) {
        onNeedContext();
      } else {
        setError(String(err));
      }
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => (hasIntake ? setOpen(true) : onNeedContext())}
        title={hasIntake ? "converse com o Arquiteto" : "requer o contexto preenchido"}
        className="absolute top-3 z-20 flex select-none items-center gap-2 rounded-full
                   border border-primary/50 bg-panel px-4 py-2 shadow-xl hover:border-primary"
        style={{ right: shiftLeft ? 340 : 12 }}
      >
        <span className="text-base">💬</span>
        <span className="font-display text-sm font-semibold text-ink">Ask AI</span>
      </button>
    );
  }

  return (
    <aside
      className="absolute bottom-3 top-3 z-30 flex w-96 select-none flex-col rounded-xl
                 border border-white/10 bg-panel shadow-2xl"
      style={{ right: shiftLeft ? 340 : 12 }}
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span>💬</span>
        <h2 className="font-display text-sm font-semibold">Ask AI</h2>
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
          arquiteto
        </span>
        <button onClick={() => setOpen(false)} className="ml-auto text-ink/40 hover:text-ink">
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        className="panel-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3"
      >
        {messages.data?.length === 0 && streaming === null && (
          <p className="text-xs leading-relaxed text-ink/50">
            Pergunte sobre o seu desenho — o Arquiteto vê o canvas, o contexto, os
            comentários e a última simulação, e fundamenta as respostas nos guidelines.
            Sugestões estruturais aparecem como nós tracejados para você aplicar ou descartar.
          </p>
        )}
        {messages.data?.map((m) => (
          <div key={m.id}>
            <div
              className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed ${
                m.role === "user"
                  ? "ml-auto bg-primary/20 text-ink"
                  : "bg-card text-ink/85"
              }`}
            >
              {m.content}
            </div>
            {m.proposed_diff && (
              <DiffCard message={m} labelOf={labelOf} ghostOrigin={ghostOrigin} />
            )}
          </div>
        ))}
        {streaming !== null && (
          <div className="max-w-[90%] rounded-lg bg-card px-2.5 py-1.5 text-[12px]
                          leading-relaxed text-ink/85">
            {streaming || "…"}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <form
        className="flex gap-2 border-t border-white/10 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input.trim());
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ex.: como reduzo a latência desse fluxo RAG?"
          className="min-w-0 flex-1 select-text rounded-md border border-white/10 bg-card px-2.5
                     py-1.5 text-sm text-ink placeholder:text-ink/30 focus:border-primary
                     focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming !== null}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white
                     hover:bg-primary/80 disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </aside>
  );
}
