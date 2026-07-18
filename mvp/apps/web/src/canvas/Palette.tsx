import { useQuery } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { api, type Archetype } from "../api/client";
import { InfoDialog } from "../app/InfoDialog";
import { useCanvas } from "./store";

export const ARCHETYPE_DRAG_TYPE = "application/blueprint-archetype";

function behaviorLabel(archetype: Archetype): string {
  if (archetype.archetype_class === "client") return "origem de tráfego";
  if (archetype.archetype_class === "queue") return "buffer durável";
  if (["cache", "semantic-cache"].includes(archetype.archetype_class)) return "store em memória";
  if (archetype.archetype_class === "database") return "store stateful";
  if (["store", "vector-db"].includes(archetype.archetype_class)) return "store particionado";
  if (["llm", "embedding", "batch"].includes(archetype.archetype_class)) return "serviço com quota";
  if (archetype.archetype_class === "ml-realtime") return "inferência síncrona";
  if (archetype.archetype_class === "ml-async") return "inferência assíncrona";
  if (["ml-batch", "ml-training"].includes(archetype.archetype_class)) {
    return "processamento em lote";
  }
  if (archetype.archetype_class === "ml-serverless") return "inferência serverless";
  if (archetype.archetype_class === "feature-store") return "store de features";
  if (archetype.archetype_class === "ml-control") return "controle de ML";
  if (archetype.archetype_class === "ml-observability") return "observabilidade de ML";
  if (archetype.archetype_class === "input-guardrail") return "proteção de entrada";
  if (archetype.archetype_class === "output-guardrail") return "proteção de saída";
  if (archetype.archetype === "serverless") return "compute elástico";
  return "compute";
}

function nodeDefaults(archetype: Archetype) {
  return {
    scaling: archetype.params.default_scaling === "elastic" ? "elastic" as const : "fixed" as const,
    replicas: 1,
    maxReplicas: typeof archetype.params.default_max_units === "number"
      ? archetype.params.default_max_units
      : 10,
    guardrailScope: archetype.params.default_guardrail_scope === "recent_history"
      ? "recent_history" as const
      : archetype.params.default_guardrail_scope === "current_turn"
        ? "current_turn" as const
        : undefined,
    guardrailEngine: archetype.params.default_guardrail_engine === "generative"
      ? "generative" as const
      : archetype.params.default_guardrail_engine === "ml"
        ? "ml" as const
        : archetype.params.default_guardrail_engine === "deterministic"
          ? "deterministic" as const
          : undefined,
  };
}

/** Palette flutuante: arrastar para posicionar OU clicar para adicionar no
 *  centro do canvas (com cascata para não empilhar). */
export function Palette() {
  const { data } = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
    staleTime: Infinity,
  });
  const addFromPalette = useCanvas((s) => s.addFromPalette);
  const addAnnotation = useCanvas((s) => s.addAnnotation);
  const { getViewport, screenToFlowPosition } = useReactFlow();
  const [minimized, setMinimized] = useState(false);
  const [search, setSearch] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const cascade = useRef(0);

  const centerPosition = (kind: "arch" | "annotation" = "arch") => {
    const canvas = document.querySelector<HTMLElement>(".react-flow.canvas-mat");
    const bounds = canvas?.getBoundingClientRect();
    const offsetPx = (cascade.current++ % 6) * 28;

    if (!bounds) {
      return screenToFlowPosition({
        x: window.innerWidth / 2 + offsetPx,
        y: window.innerHeight / 2 + offsetPx,
      });
    }

    const viewport = getViewport();
    const estimatedWidth = kind === "annotation" ? 160 : 144;
    const estimatedHeight = kind === "annotation" ? 72 : 84;
    return {
      x: (bounds.width / 2 - viewport.x + offsetPx) / viewport.zoom - estimatedWidth / 2,
      y: (bounds.height / 2 - viewport.y + offsetPx) / viewport.zoom - estimatedHeight / 2,
    };
  };

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byCategory = new Map<string, Archetype[]>();
    for (const a of data ?? []) {
      if (term && !a.label.toLowerCase().includes(term)) continue;
      byCategory.set(a.category, [...(byCategory.get(a.category) ?? []), a]);
    }
    return [...byCategory.entries()];
  }, [data, search]);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="absolute left-3 top-3 z-10 select-none rounded-xl border border-white/10
                   bg-panel/95 px-3 py-2 font-mono text-[10px] uppercase tracking-widest
                   text-ink/60 shadow-xl hover:text-ink"
      >
        ▸ Componentes
      </button>
    );
  }

  return (
    <aside className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-56
                      select-none flex-col rounded-xl border border-white/10 bg-panel/95
                      shadow-xl">
      <header className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/50">Componentes</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Como funcionam os limites dos componentes"
            title="capacidade e limites dos componentes"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/60
                       bg-primary/10 font-display text-[11px] font-semibold text-primary shadow-sm
                       shadow-primary/20 transition hover:border-primary hover:bg-primary/20"
          >
            i
          </button>
          <button onClick={() => setMinimized(true)} className="text-ink/40 hover:text-ink"
            title="minimizar">
            ▾
          </button>
        </div>
      </header>
      <div className="px-3 pb-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="buscar…"
          className="w-full select-text rounded-md border border-white/10 bg-card px-2 py-1
                     text-xs text-ink placeholder:text-ink/30 focus:border-primary
                     focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <section className="mb-4">
          <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/35">
            Annotations
          </h3>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(ARCHETYPE_DRAG_TYPE, JSON.stringify({ kind: "annotation" }));
              e.dataTransfer.effectAllowed = "move";
            }}
            className="rounded-md border border-dashed border-amber-400/40 bg-amber-200/5
                       text-xs text-amber-200/80 hover:border-amber-300"
          >
            <button
              type="button"
              onClick={() => addAnnotation(centerPosition("annotation"))}
              className="w-full cursor-pointer px-2.5 py-1.5 text-left"
            >
              + Balão de comentário
            </button>
          </div>
        </section>
        {groups.map(([category, items]) => (
          <section key={category} className="mb-4">
            <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/35">
              {category}
            </h3>
            <ul className="space-y-1">
              {items.map((a) => (
                <li
                  key={a.archetype}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      ARCHETYPE_DRAG_TYPE,
                      JSON.stringify({
                        archetype: a.archetype,
                        label: a.label,
                        defaults: nodeDefaults(a),
                      }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="rounded-md border border-white/10 bg-card text-xs text-ink/80
                             hover:border-primary/60"
                  title={`${behaviorLabel(a)} · capacidade efetiva calculada pelo porte, perfil de capacidade e carga — clique para adicionar ou arraste`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      addFromPalette(a.archetype, a.label, centerPosition(), nodeDefaults(a));
                    }}
                    className="w-full cursor-pointer px-2.5 py-1.5 text-left"
                  >
                    + {a.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {infoOpen && (
        <InfoDialog
          eyebrow="Componentes e capacidade"
          title="O que os limites dos componentes significam"
          onClose={() => setInfoOpen(false)}
        >
          <p>
            Os itens da palette são arquétipos genéricos de arquitetura, não produtos AWS, Azure ou
            GCP. Cada arquétipo possui uma calibração interna conservadora para permitir simulações
            coerentes sem exigir dezenas de parâmetros de infraestrutura.
          </p>

          <section>
            <h3 className="font-medium text-ink">Calibração não é limite universal</h3>
            <p className="mt-1">
              Um App Server ou NoSQL DB real pode entregar valores muito diferentes conforme CPU,
              memória, runtime, payload, índices, partições, rede e configuração. Por isso o número
              interno não é apresentado como uma promessa de RPS: ele é o ponto de referência usado
              para comparar os nós dentro da mesma simulação.
            </p>
          </section>

          <section>
            <h3 className="font-medium text-ink">Perfis de comportamento</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["Compute", "Satura por utilização e pode gerar throttling/erros."],
                ["Store stateful", "Escritas custam mais e a escala reage mais lentamente."],
                ["Store particionado", "Pode perder capacidade útil em uma partição quente."],
                ["Store em memória", "Alta capacidade e baixa latência, afetado por cache hit."],
                ["Buffer durável", "Acumula backlog quando consumidores não acompanham."],
                ["Serviço com quota", "Representa endpoints limitados por throughput ou quota."],
                ["Inferência síncrona", "Responde no caminho online e participa do p99 e dos erros."],
                ["Inferência assíncrona", "Aceita trabalho, acumula backlog e conclui fora do p99."],
                ["Processamento em lote", "Processa grandes volumes como trabalho offline acumulado."],
                ["Inferência serverless", "Escala sob demanda e pode introduzir cold start."],
                ["Controle de ML", "Representa registry e fluxos fora do caminho online."],
                ["Observabilidade", "Recebe telemetria sem aumentar o p99 da requisição principal."],
                ["Proteção de entrada", "Bloqueia antes do LLM e pode analisar a interação ou o histórico."],
                ["Proteção de saída", "Valida pergunta e resposta depois da geração do LLM."],
              ].map(([name, description]) => (
                <div key={name} className="rounded-lg border border-white/10 bg-card/50 px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-primary/80">
                    {name}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-ink/55">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-medium text-ink">Como ajustar um componente</h3>
            <p className="mt-1">
              Depois de adicioná-lo, clique em ✎ no nó. Porte Small, Medium ou Large altera a
              capacidade de cada unidade em 0,5×, 1× ou 2×. Escala fixa mantém a quantidade
              definida; escala elástica começa no mínimo e pode crescer até o máximo, respeitando o
              atraso de reação do perfil.
            </p>
            <p className="mt-2">
              Guardrails também oferecem Estratégia e Contexto analisado. A
              estratégia determinística prioriza previsibilidade, alta capacidade e baixa latência;
              a probabilística amplia a cobertura, mas pode produzir falsos positivos e negativos;
              a generativa considera mais nuances, com maior custo e latência. O componente representa
              esse comportamento sem impor uma tecnologia ou infraestrutura específica.
            </p>
            <p className="mt-2">
              Interação atual inspeciona apenas o turno em curso. Histórico recente permite detectar
              ataques multi-turn, mas aumenta o trabalho de qualquer estratégia. Guardrails operam
              sempre em fail closed: se não houver capacidade para inspecionar, o tráfego excedente
              é bloqueado.
            </p>
          </section>

          <section>
            <h3 className="font-medium text-ink">O que aparece no nó após simular</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong className="font-medium text-ink/80">RPS</strong>: tráfego que realmente chegou ao componente.</li>
              <li><strong className="font-medium text-ink/80">% pico</strong>: maior utilização durante a janela.</li>
              <li><strong className="font-medium text-ink/80">Hot/Throttle</strong>: proximidade ou excesso de capacidade.</li>
              <li><strong className="font-medium text-ink/80">Backlog</strong>: mensagens aguardando consumidores.</li>
              <li><strong className="font-medium text-ink/80">Unidades ativas</strong>: resultado da escala elástica.</li>
              <li><strong className="font-medium text-ink/80">Bloqueado</strong>: ataques detectados e excesso que não pôde ser inspecionado.</li>
            </ul>
          </section>

          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-ink/60">
            Para aproximar um ambiente real sem acoplar o diagrama a um fornecedor, ajuste porte,
            unidades e Perfil de Capacidade global. Use dados de teste de carga para escolher o
            perfil mais representativo do sistema que será implantado.
          </p>
        </InfoDialog>
      )}
    </aside>
  );
}
