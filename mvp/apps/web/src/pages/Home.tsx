import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { createDiagram, deleteDiagram, listDiagrams, patchDiagram } from "../api/client";
import {
  TUTORIAL_OPTIONS,
  tutorialOption,
  type TutorialId,
} from "../tutorial/catalog";

const highlights = [
  "Canvas minimalista",
  "Simulações determinísticas",
  "Consulta e Avaliação por IA",
  "Diferentes cenários de incidentes",
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="AIrchitecture — início">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/50 bg-primary/10 font-mono text-xs font-semibold text-primary">
        AI
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-ink">
        AIrchitecture
      </span>
    </Link>
  );
}

function TutorialIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M4 5.5h11.5A2.5 2.5 0 0 1 18 8v10.5H6.5A2.5 2.5 0 0 1 4 16V5.5Z" />
      <path d="M6.5 18.5A2.5 2.5 0 0 1 9 16h9M8 9h6M8 12h4" />
    </svg>
  );
}

function ArchitecturePreview() {
  return (
    <div className="home-preview overflow-hidden rounded-2xl border border-white/12 bg-panel/95">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" />
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ink/70">
            Feed architecture
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-ink/45">3,5k RPS · 90% reads</span>
      </div>

      <div>
        <svg
          viewBox="0 0 700 360"
          role="img"
          aria-labelledby="home-diagram-title home-diagram-description"
          className="block h-auto w-full"
        >
          <title id="home-diagram-title">Exemplo de arquitetura no canvas</title>
          <desc id="home-diagram-description">
            Client, Load Balancer, App Server, Database, Cache e Queue conectados.
          </desc>
          <defs>
            <pattern id="home-small-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" className="home-grid-small" />
            </pattern>
            <pattern id="home-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#home-small-grid)" />
              <path d="M100 0H0V100" className="home-grid-large" />
            </pattern>
            <marker id="home-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 8 4 0 8Z" className="home-arrow-head" />
            </marker>
          </defs>

          <rect width="700" height="360" fill="url(#home-grid)" />

          <g className="home-flow" markerEnd="url(#home-arrow)">
            <path d="M120 190H150" />
            <path d="M280 190H320" />
            <path d="M450 190H560" />
            <path d="M385 148V77H475" />
            <path d="M385 232V313H475" />
            <path className="home-flow-async" d="M585 313H616V225" />
          </g>

          <g className="home-node">
            <rect x="20" y="155" width="100" height="70" rx="11" />
            <text x="70" y="186">Client</text>
            <text className="home-node-meta" x="70" y="207">Web + Mobile</text>
          </g>
          <g className="home-node">
            <rect x="150" y="155" width="130" height="70" rx="11" />
            <text x="215" y="186">Load Balancer</text>
            <text className="home-node-meta" x="215" y="207">traffic routing</text>
          </g>
          <g className="home-node home-node-active">
            <rect x="320" y="148" width="130" height="84" rx="11" />
            <text x="385" y="185">App Server</text>
            <text className="home-node-meta" x="385" y="207">3 replicas · 78%</text>
          </g>
          <g className="home-node">
            <rect x="475" y="42" width="110" height="70" rx="11" />
            <text x="530" y="73">Cache</text>
            <text className="home-node-meta" x="530" y="94">80% hit rate</text>
          </g>
          <g className="home-node">
            <rect x="475" y="278" width="110" height="70" rx="11" />
            <text x="530" y="309">Queue</text>
            <text className="home-node-meta" x="530" y="330">350 msg/s</text>
          </g>
          <g className="home-node">
            <rect x="560" y="155" width="112" height="70" rx="11" />
            <text x="616" y="186">Database</text>
            <text className="home-node-meta" x="616" y="207">healthy</text>
          </g>
        </svg>

        <div className="grid grid-cols-3 border-t border-white/10 bg-panel/90">
          <div className="px-2 py-2 text-center sm:px-3">
            <span className="block font-mono text-[8px] uppercase tracking-wider text-ink/40 sm:text-[9px]">p99</span>
            <strong className="mt-0.5 block text-[10px] font-medium text-ink/80 sm:text-xs">65 ms</strong>
          </div>
          <div className="border-x border-white/10 px-2 py-2 text-center sm:px-3">
            <span className="block font-mono text-[8px] uppercase tracking-wider text-ink/40 sm:text-[9px]">Erros</span>
            <strong className="mt-0.5 block text-[10px] font-medium text-emerald-300 sm:text-xs">0%</strong>
          </div>
          <div className="px-2 py-2 text-center sm:px-3">
            <span className="block font-mono text-[8px] uppercase tracking-wider text-ink/40 sm:text-[9px]">Estado</span>
            <strong className="mt-0.5 block text-[10px] font-medium text-ink/80 sm:text-xs">Estável</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tutorialPickerOpen, setTutorialPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const tutorialDialogRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const diagrams = useQuery({ queryKey: ["diagrams"], queryFn: listDiagrams });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["diagrams"] });

  const startTutorial = useMutation({
    mutationFn: (tutorialId: TutorialId) =>
      createDiagram({ title: tutorialOption(tutorialId).diagramTitle }),
    onSuccess: (diagram, tutorialId) => {
      setTutorialPickerOpen(false);
      navigate(`/session/${diagram.id}?tutorial=${tutorialId}`);
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => patchDiagram(id, { title }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: deleteDiagram,
    onSuccess: () => {
      setDeleteTarget(null);
      return invalidate();
    },
  });

  useEffect(() => {
    if (!deleteTarget) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelDeleteRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !remove.isPending) {
        setDeleteTarget(null);
        remove.reset();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [deleteTarget, remove.isPending]);

  useEffect(() => {
    if (!tutorialPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tutorialDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !startTutorial.isPending) setTutorialPickerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [tutorialPickerOpen, startTutorial.isPending]);

  const beginTutorial = () => {
    startTutorial.reset();
    setTutorialPickerOpen(true);
  };

  return (
    <main className="home-page relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_75%_24%,rgba(84,211,194,0.13),transparent_35%),radial-gradient(circle_at_20%_20%,rgba(232,98,44,0.12),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-panel/85 px-3 py-3 shadow-xl backdrop-blur-md sm:px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={beginTutorial}
              disabled={startTutorial.isPending}
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50 sm:flex"
            >
              <TutorialIcon />
              {startTutorial.isPending ? "Preparando…" : "Tutorial guiado"}
            </button>
            <Link
              to="/diagrams/new"
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/15 transition hover:bg-primary/90"
            >
              Novo diagrama
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(103,232,249,0.8)]" />
              System Design com feedback em tempo real
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[4rem]">
              Desenhe. Planeje. <span className="text-primary">Estresse.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-ink/68 sm:text-base">
              System Design minimalista e direto ao ponto: planeje sua arquitetura,
              simule carga, teste cenários, consulte IA e crie seu Documento de Review
              de Arquitetura.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/diagrams/new"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Começar no canvas
                <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                onClick={beginTutorial}
                disabled={startTutorial.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-panel/70 px-5 py-3 text-sm font-medium text-ink/80 transition hover:border-cyan-300/35 hover:bg-card/80 hover:text-ink disabled:opacity-50"
              >
                <TutorialIcon />
                {startTutorial.isPending ? "Preparando tutorial…" : "Ver tutorial guiado"}
              </button>
            </div>

            {startTutorial.isError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                Não foi possível iniciar o tutorial. Verifique se a API está disponível.
              </p>
            )}

            <ul className="mt-8 grid gap-2 sm:grid-cols-2" aria-label="Recursos em destaque">
              {highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-panel/40 px-3 py-2.5 text-xs text-ink/68"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <ArchitecturePreview />
        </section>

        <section className="pb-16 sm:pb-24" aria-labelledby="diagram-list-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">Workspace</p>
              <h2 id="diagram-list-title" className="mt-1 font-display text-xl font-semibold text-ink">
                Seus diagramas
              </h2>
            </div>
            {!!diagrams.data?.length && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">
                {diagrams.data.length} projeto{diagrams.data.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {diagrams.isError && (
            <p role="alert" className="rounded-xl border border-red-300/20 bg-red-950/25 p-4 text-sm text-red-200">
              API indisponível — {String(diagrams.error)}
            </p>
          )}

          {diagrams.isLoading && (
            <div className="rounded-xl border border-white/10 bg-panel/60 p-8 text-center text-sm text-ink/50">
              Carregando diagramas…
            </div>
          )}

          {diagrams.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 bg-panel/60 p-8 text-center sm:p-10">
              <p className="text-sm text-ink/60">A mesa está vazia — crie o primeiro diagrama.</p>
              <Link
                to="/diagrams/new"
                className="mt-4 inline-flex rounded-lg border border-primary/40 px-4 py-2 text-xs font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Criar diagrama
              </Link>
            </div>
          )}

          <ul className="grid gap-3 md:grid-cols-2">
            {diagrams.data?.map((diagram) => (
              <li
                key={diagram.id}
                className="group rounded-xl border border-white/10 bg-panel/80 p-4 shadow-lg transition hover:border-primary/45 hover:bg-panel"
              >
                <Link to={`/session/${diagram.id}`} className="block min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate font-medium text-ink transition group-hover:text-primary">
                      {diagram.title}
                    </h3>
                    <span className="text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true">
                      →
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-ink/40">
                    {diagram.node_count} componente{diagram.node_count === 1 ? "" : "s"} · atualizado{" "}
                    {new Date(`${diagram.updated_at}Z`).toLocaleString("pt-BR")}
                  </p>
                </Link>
                <div className="mt-4 flex gap-2 border-t border-white/8 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const title = window.prompt("Novo título:", diagram.title);
                      if (title && title.trim().length >= 3) {
                        rename.mutate({ id: diagram.id, title: title.trim() });
                      }
                    }}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] text-ink/60 transition hover:border-primary/60 hover:text-ink"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleteTarget({ id: diagram.id, title: diagram.title });
                    }}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] text-red-300/70 transition hover:border-red-300/50 hover:text-red-200"
                  >
                    Deletar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {tutorialPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04100d]/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !startTutorial.isPending) {
              setTutorialPickerOpen(false);
            }
          }}
        >
          <div
            ref={tutorialDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-picker-title"
            tabIndex={-1}
            className="panel-scroll max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl
                       border border-primary/25 bg-panel shadow-[0_28px_90px_rgba(2,12,9,0.65)]
                       outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/80">
                  Tutorial guiado
                </p>
                <h2 id="tutorial-picker-title" className="mt-1 font-display text-2xl font-semibold text-ink">
                  Escolha um caso de System Design
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
                  Os três casos percorrem o mesmo fluxo da ferramenta, mas exercitam componentes,
                  cenários e decisões diferentes para você conhecer seus principais recursos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTutorialPickerOpen(false)}
                disabled={startTutorial.isPending}
                aria-label="Fechar seleção de tutorial"
                className="rounded-lg px-2 py-1 text-ink/40 hover:bg-white/5 hover:text-ink disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-3">
              {TUTORIAL_OPTIONS.map((tutorial, index) => {
                const pending = startTutorial.isPending && startTutorial.variables === tutorial.id;
                return (
                  <button
                    key={tutorial.id}
                    type="button"
                    onClick={() => startTutorial.mutate(tutorial.id)}
                    disabled={startTutorial.isPending}
                    className="group flex min-h-[360px] flex-col rounded-xl border border-white/10
                               bg-card/55 p-4 text-left transition hover:-translate-y-0.5
                               hover:border-primary/55 hover:bg-card disabled:translate-y-0
                               disabled:cursor-wait disabled:opacity-55"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border
                                       border-primary/30 bg-primary/10 font-mono text-xs text-primary">
                        0{index + 1}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink/40">
                        {tutorial.duration}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-ink
                                   transition group-hover:text-primary">
                      {tutorial.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-ink/60">{tutorial.summary}</p>
                    <dl className="mt-4 space-y-2 border-t border-white/8 pt-4 text-[11px]">
                      <div>
                        <dt className="font-mono text-[8px] uppercase tracking-wider text-ink/35">Info</dt>
                        <dd className="mt-0.5 text-ink/65">{tutorial.info}</dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <p className="font-mono text-[8px] uppercase tracking-wider text-ink/35">Componentes</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {tutorial.components.map((component) => (
                          <span key={component} className="rounded bg-white/5 px-1.5 py-1 text-[9px] text-ink/55">
                            {component}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto pt-5 font-mono text-[10px] font-semibold uppercase
                                    tracking-wider text-primary">
                      {pending ? "Preparando…" : "Iniciar tutorial →"}
                    </div>
                  </button>
                );
              })}
            </div>

            {startTutorial.isError && (
              <p role="alert" className="mx-5 mb-5 rounded-lg border border-red-300/20 bg-red-950/25 px-3 py-2 text-xs text-red-200 sm:mx-6 sm:mb-6">
                Não foi possível iniciar o tutorial. Verifique se a API está disponível.
              </p>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04100d]/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !remove.isPending) {
              setDeleteTarget(null);
              remove.reset();
            }
          }}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-diagram-title"
            aria-describedby="delete-diagram-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-red-300/20 bg-panel shadow-[0_28px_90px_rgba(2,12,9,0.65)]"
          >
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-300/20 bg-red-400/10 text-red-300">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 fill-none stroke-current"
                    strokeWidth="1.8"
                  >
                    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-red-300/70">
                    Confirmar exclusão
                  </p>
                  <h2 id="delete-diagram-title" className="mt-1 font-display text-xl font-semibold text-ink">
                    Excluir diagrama?
                  </h2>
                </div>
              </div>

              <p id="delete-diagram-description" className="mt-4 text-sm leading-6 text-ink/65">
                <strong className="font-medium text-ink">“{deleteTarget.title}”</strong> será removido
                da sua mesa de trabalho.
              </p>
              <p className="mt-3 rounded-lg border border-red-300/12 bg-red-400/6 px-3 py-2 text-xs text-red-200/80">
                Esta ação não pode ser desfeita.
              </p>

              {remove.isError && (
                <p role="alert" className="mt-3 text-xs text-red-300">
                  Não foi possível excluir o diagrama. Verifique a API e tente novamente.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 bg-card/35 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  remove.reset();
                }}
                disabled={remove.isPending}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-white/25 hover:bg-white/5 hover:text-ink disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(deleteTarget.id)}
                disabled={remove.isPending}
                className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/25 transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60"
              >
                {remove.isPending ? "Excluindo…" : "Excluir diagrama"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
