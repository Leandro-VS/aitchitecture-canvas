import { useMutation, useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";

import {
  createExport,
  exportDraft,
  previewExport,
  type AdrSections,
  type ExportOut,
} from "../api/client";
import { serializeCanvas } from "../canvas/store";
import { useTutorialSignals } from "../tutorial/signals";
import { MermaidPreview } from "./MermaidPreview";

const field =
  "w-full select-text rounded-md border border-white/10 bg-card px-2.5 py-1.5 text-sm " +
  "text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none";
const label = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50";

async function captureCanvasPng(): Promise<string | null> {
  const pane = document.querySelector<HTMLElement>(".react-flow");
  if (!pane) return null;
  try {
    return await toPng(pane, { backgroundColor: "#0d5c4d", pixelRatio: 2 });
  } catch {
    return null; // imagem é bônus — export segue sem ela
  }
}

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onClose: () => void;
}

export function ExportDialog({ diagramId, hasIntake, onClose }: Props) {
  const [sections, setSections] = useState<AdrSections>({
    context: "",
    decision: "",
    consequences: "",
  });
  const [result, setResult] = useState<ExportOut | null>(null);
  const [preview, setPreview] = useState<{ markdown: string; mermaid: string } | null>(null);
  const [previewTab, setPreviewTab] = useState<"markdown" | "mermaid">("markdown");
  const emit = useTutorialSignals((s) => s.emit);

  // rascunho IA das seções editáveis (exige contexto; sem ele, campos vazios)
  const draft = useQuery({
    queryKey: ["adr-draft", diagramId],
    queryFn: () => exportDraft(diagramId, serializeCanvas()),
    enabled: hasIntake,
    staleTime: Infinity,
  });
  const draftApplied = useRef(false);
  useEffect(() => {
    if (draft.data && !draftApplied.current) {
      draftApplied.current = true;
      setSections(draft.data);
    }
  }, [draft.data]);

  const doPreview = useMutation({
    mutationFn: () => previewExport(diagramId, sections, serializeCanvas()),
    onSuccess: (out) => {
      setPreview(out);
      setPreviewTab("markdown");
      emit("exportPreviewed");
    },
  });

  const doExport = useMutation({
    mutationFn: async () =>
      createExport(diagramId, sections, await captureCanvasPng(), serializeCanvas()),
    onSuccess: (out) => {
      setResult(out);
      emit("exportDone");
    },
  });

  const set = (key: keyof AdrSections) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setSections((s) => ({ ...s, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                    bg-black/60 p-8">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Exportar diagrama</h2>
          <button onClick={onClose} className="text-sm text-ink/50 hover:text-ink">
            fechar ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-300">✓ Arquivos de exportação gerados.</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={result.md_url}
                download="pre-adr.md"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white
                           hover:bg-primary/80"
              >
                Baixar pre-adr.md
              </a>
              {result.png_url && (
                <a
                  href={result.png_url}
                  download="pre-adr.png"
                  className="rounded-md border border-white/15 px-4 py-2 text-sm text-ink/80
                             hover:border-primary/60"
                >
                  Baixar pre-adr.png
                </a>
              )}
              <a
                href={result.mermaid_url}
                download="diagram.mmd"
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-ink/80
                           hover:border-primary/60"
              >
                Baixar diagram.mmd
              </a>
            </div>
            <p className="text-xs text-ink/50">
              O Markdown referencia <code>pre-adr.png</code> e <code>diagram.mmd</code> — mantenha
              os arquivos no mesmo diretório (ex.: no repositório de ADRs).
            </p>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <p className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
              Pré-visualização somente: nenhum arquivo foi criado ainda.
            </p>
            <div className="flex rounded-md border border-white/10 bg-card p-1">
              <button
                onClick={() => setPreviewTab("markdown")}
                className={`flex-1 rounded px-3 py-1.5 text-xs transition-colors ${
                  previewTab === "markdown"
                    ? "bg-primary text-white"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                Pré-ADR (.md)
              </button>
              <button
                onClick={() => setPreviewTab("mermaid")}
                className={`flex-1 rounded px-3 py-1.5 text-xs transition-colors ${
                  previewTab === "mermaid"
                    ? "bg-primary text-white"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                Mermaid (.mmd)
              </button>
            </div>
            {previewTab === "markdown" ? (
              <pre className="panel-scroll max-h-[60vh] overflow-auto whitespace-pre-wrap
                              rounded-md border border-white/10 bg-card p-4 font-mono text-xs
                              leading-relaxed text-ink/80">
                {preview.markdown}
              </pre>
            ) : (
              <div className="space-y-3">
                <MermaidPreview source={preview.mermaid} />
                <details className="rounded-md border border-white/10 bg-card">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-ink/60
                                      hover:text-ink">
                    Ver código Mermaid que será exportado
                  </summary>
                  <pre className="panel-scroll max-h-72 overflow-auto whitespace-pre-wrap
                                  border-t border-white/10 p-4 font-mono text-xs leading-relaxed
                                  text-ink/80">
                    {preview.mermaid}
                  </pre>
                </details>
                <p className="text-xs text-ink/50">
                  A prévia acima é renderizada; o arquivo <code>diagram.mmd</code> contém o
                  código Mermaid. Componentes, nomes, comentários, conexões e intents são
                  preservados, mas o renderizador recalcula posições e quebras das arestas.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 rounded-md border border-white/15 px-4 py-2 text-sm text-ink/80
                           hover:border-primary/60"
              >
                ← Editar seções
              </button>
              <button
                onClick={() => doExport.mutate()}
                disabled={doExport.isPending}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white
                           hover:bg-primary/80 disabled:opacity-50"
              >
                {doExport.isPending ? "Gerando…" : "Confirmar e gerar arquivos"}
              </button>
            </div>
            {doExport.isError && (
              <p className="text-sm text-red-400">{String(doExport.error)}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {hasIntake && draft.isLoading && (
              <p className="text-xs text-ink/50">gerando rascunho das seções…</p>
            )}
            {!hasIntake && (
              <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2
                            text-xs text-amber-200">
                Sem o contexto preenchido, as seções abaixo começam vazias (o rascunho
                automático é um recurso de IA).
              </p>
            )}
            <div>
              <label className={label} htmlFor="adr-context">Contexto</label>
              <textarea id="adr-context" rows={3} className={field}
                value={sections.context} onChange={set("context")} />
            </div>
            <div>
              <label className={label} htmlFor="adr-decision">Decisão</label>
              <textarea id="adr-decision" rows={3} className={field}
                value={sections.decision} onChange={set("decision")} />
            </div>
            <div>
              <label className={label} htmlFor="adr-consequences">
                Consequências e próximos passos
              </label>
              <textarea id="adr-consequences" rows={3} className={field}
                value={sections.consequences} onChange={set("consequences")} />
            </div>
            <p className="text-xs text-ink/50">
              O documento inclui automaticamente: requisitos do contexto, imagem do canvas,
              tabela de componentes, comentários, resumo da última simulação e a avaliação
              do Juiz (score + findings com citações). A exportação também gera a topologia
              do diagrama em Mermaid.
            </p>
            <button
              onClick={() => doPreview.mutate()}
              disabled={doPreview.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white
                         hover:bg-primary/80 disabled:opacity-50"
            >
              {doPreview.isPending ? "Montando prévia…" : "Pré-visualizar exportação"}
            </button>
            {doPreview.isError && (
              <p className="text-sm text-red-400">{String(doPreview.error)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
