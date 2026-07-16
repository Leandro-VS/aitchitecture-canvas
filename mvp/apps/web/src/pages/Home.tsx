import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { createDiagram, deleteDiagram, listDiagrams, patchDiagram } from "../api/client";

export function Home() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const diagrams = useQuery({ queryKey: ["diagrams"], queryFn: listDiagrams });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["diagrams"] });

  const startTutorial = useMutation({
    mutationFn: () => createDiagram({ title: "Tutorial — Feed do Twitter/X" }),
    onSuccess: (d) => navigate(`/session/${d.id}?tutorial=1`),
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => patchDiagram(id, { title }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteDiagram, onSuccess: invalidate });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          sua mesa de desenho de arquitetura
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          AIrchitecture
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
          Desenhe o system design, simule a carga e valide com IA — tudo na mesma tela.
          O Ask AI conhece o seu diagrama, o Juiz avalia contra guidelines com citação,
          e a sessão vira um pré-ADR pronto para discussão.
        </p>
      </header>

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        <Link
          to="/diagrams/new"
          className="group rounded-xl border border-primary/40 bg-panel p-5 shadow-xl
                     transition-colors hover:border-primary"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Novo diagrama</h2>
            <span className="text-ink/40 transition-transform group-hover:translate-x-0.5">→</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
            Comece com o canvas em branco ou descreva o sistema em linguagem natural e
            receba um esboço inicial da IA para evoluir.
          </p>
        </Link>

        <button
          onClick={() => startTutorial.mutate()}
          disabled={startTutorial.isPending}
          className="group rounded-xl border border-white/10 bg-panel p-5 text-left shadow-xl
                     transition-colors hover:border-primary/60 disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">🎓 Tutorial guiado</h2>
            <span className="text-ink/40 transition-transform group-hover:translate-x-0.5">→</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
            Monte o feed do Twitter/X passo a passo — hot read path, cache, fan-out por
            fila — e conheça todos os recursos da ferramenta.
          </p>
        </button>
      </div>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink/50">
          Seus diagramas
        </h2>

        {diagrams.isError && (
          <p className="text-sm text-red-400">API indisponível — {String(diagrams.error)}</p>
        )}
        {diagrams.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/15 bg-panel/60 p-10 text-center">
            <p className="text-sm text-ink/60">A mesa está vazia — crie o primeiro diagrama.</p>
          </div>
        )}

        <ul className="space-y-3">
          {diagrams.data?.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-panel p-4"
            >
              <Link to={`/session/${d.id}`} className="min-w-0 flex-1">
                <h3 className="truncate font-medium text-ink hover:text-primary">{d.title}</h3>
                <p className="mt-0.5 font-mono text-xs text-ink/40">
                  {d.node_count} componente{d.node_count === 1 ? "" : "s"} · atualizado{" "}
                  {new Date(d.updated_at + "Z").toLocaleString("pt-BR")}
                </p>
              </Link>
              <div className="ml-4 flex shrink-0 gap-2">
                <button
                  onClick={() => {
                    const title = window.prompt("Novo título:", d.title);
                    if (title && title.trim().length >= 3) rename.mutate({ id: d.id, title });
                  }}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-ink/70 hover:border-primary/60"
                >
                  Renomear
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Deletar "${d.title}"?`)) remove.mutate(d.id);
                  }}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-red-400/80 hover:border-red-400/60"
                >
                  Deletar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
