import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  api,
  bootstrapPrefill,
  bootstrapSketch,
  createDiagram,
  patchDiagram,
  type Archetype,
  type Intake,
  type ProposedDiff,
} from "../api/client";
import { dagreLayout } from "../canvas/layout";
import { IntakeForm } from "../intake/IntakeForm";
import { toFormValues, toIntakePayload, type IntakeFormValues } from "../intake/schema";

const INFERRED_LABELS: Record<string, string> = {
  summary: "descrição",
  functional_requirements: "requisitos",
  considerations: "considerações",
  data_classification: "classificação de dados",
  out_of_scope: "fora de escopo",
};

function diffToCanvas(diff: ProposedDiff, labelOf: Record<string, string>) {
  const adds = diff.ops.filter((op) => op.op === "add_node");
  const connects = diff.ops.filter((op) => op.op === "connect");
  const positions = dagreLayout(
    adds.map((op) => ({ id: op.id })),
    connects.map((op) => ({ source: op.source, target: op.target })),
  );
  return {
    nodes: adds.map((op) => ({
      id: op.id,
      type: "arch",
      position: positions[op.id] ?? { x: 0, y: 0 },
      data: {
        archetype: op.archetype,
        label: labelOf[op.archetype] ?? op.archetype,
        name: op.name,
        subtitle: op.subtitle ?? undefined,
      },
    })),
    edges: connects.map((op, i) => ({
      id: `sk-e${i}`,
      source: op.source,
      target: op.target,
      type: "intent",
      data: { intent: op.intent },
    })),
    viewport: null,
  };
}

export function NewDiagram() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"blank" | "ai">("blank");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prefilled, setPrefilled] = useState<Intake | null>(null);

  const archetypes = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
    staleTime: Infinity,
  });

  const createBlank = useMutation({
    mutationFn: () => createDiagram({ title: title.trim() }),
    onSuccess: (diagram) => navigate(`/session/${diagram.id}`),
  });

  const prefill = useMutation({
    mutationFn: () => bootstrapPrefill(description.trim()),
    onSuccess: (intake) => setPrefilled(intake),
  });

  const createWithSketch = useMutation({
    mutationFn: async (values: IntakeFormValues) => {
      const diagram = await createDiagram(toIntakePayload(values));
      try {
        const diff = await bootstrapSketch(diagram.id);
        const labelOf = Object.fromEntries(
          (archetypes.data ?? []).map((a) => [a.archetype, a.label]),
        );
        await patchDiagram(diagram.id, { canvas_state: diffToCanvas(diff, labelOf) });
      } catch {
        // esboço nunca bloqueia a criação: cai no canvas vazio com intake preservado
      }
      return diagram;
    },
    onSuccess: (diagram) => navigate(`/session/${diagram.id}`),
  });

  const tab = (value: "blank" | "ai", label: string) => (
    <button
      onClick={() => setMode(value)}
      className={`rounded-md px-3 py-1.5 text-sm ${
        mode === value ? "bg-primary text-white" : "text-ink/60 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/" className="font-mono text-xs text-ink/40 hover:text-primary">
        ← diagramas
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold">Novo diagrama</h1>

      <div className="mt-4 flex w-fit gap-1 rounded-lg border border-white/10 bg-panel p-1">
        {tab("blank", "Canvas em branco")}
        {tab("ai", "Descrever com IA")}
      </div>

      {mode === "blank" && (
        <form
          className="mt-4 rounded-xl border border-white/10 bg-panel p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length >= 3) createBlank.mutate();
          }}
        >
          <label htmlFor="title"
            className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink/50">
            Título
          </label>
          <input
            id="title"
            autoFocus
            className="w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm
                       text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
            placeholder="ex.: Assistente RAG de atendimento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={title.trim().length < 3 || createBlank.isPending}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium
                       text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {createBlank.isPending ? "Criando…" : "Criar e abrir o canvas"}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-ink/50">
            Você pode desenhar e simular sem preencher mais nada. O contexto fica na aba
            lateral da sessão — obrigatório para os recursos de IA (Ask AIrchitect e Juiz).
          </p>
        </form>
      )}

      {mode === "ai" && !prefilled && (
        <form
          className="mt-4 rounded-xl border border-white/10 bg-panel p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (description.trim().length >= 20) prefill.mutate();
          }}
        >
          <label htmlFor="description"
            className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink/50">
            Descreva o sistema em linguagem natural
          </label>
          <textarea
            id="description"
            rows={5}
            autoFocus
            className="w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm
                       text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
            placeholder="ex.: Quero um assistente de atendimento com RAG para responder clientes a partir da nossa base de conhecimento, com escalonamento para humano…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="submit"
            disabled={description.trim().length < 20 || prefill.isPending}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium
                       text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {prefill.isPending ? "Analisando…" : "Pré-preencher contexto com IA"}
          </button>
          {prefill.isError && (
            <p className="mt-2 text-sm text-red-400">{String(prefill.error)}</p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink/50">
            A IA preenche o contexto a partir da descrição e você revisa antes de gerar o
            esboço — o auto-preenchimento nunca pula a revisão humana.
          </p>
        </form>
      )}

      {mode === "ai" && prefilled && (
        <div className="mt-4 rounded-xl border border-white/10 bg-panel p-6">
          <div className="mb-4 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2
                          text-xs leading-relaxed text-amber-200">
            Campos inferidos pela IA — revise antes de continuar:{" "}
            {(prefilled.inferred_fields ?? [])
              .map((f) => INFERRED_LABELS[f] ?? f)
              .join(", ")}
            .
            <button
              onClick={() => setPrefilled(null)}
              className="ml-2 underline hover:text-amber-100"
            >
              recomeçar
            </button>
          </div>
          <IntakeForm
            defaultValues={toFormValues(title, prefilled)}
            submitLabel={
              createWithSketch.isPending ? "Gerando esboço…" : "Criar e gerar esboço com IA"
            }
            busy={createWithSketch.isPending}
            onSubmit={(values) => createWithSketch.mutate(values)}
          />
          {createWithSketch.isError && (
            <p className="mt-3 text-sm text-red-400">{String(createWithSketch.error)}</p>
          )}
        </div>
      )}
    </div>
  );
}
