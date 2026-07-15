import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { deleteDiagram, listDiagrams, patchDiagram } from "../api/client";

export function Home() {
  const queryClient = useQueryClient();
  const diagrams = useQuery({ queryKey: ["diagrams"], queryFn: listDiagrams });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["diagrams"] });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => patchDiagram(id, { title }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteDiagram, onSuccess: invalidate });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Blueprint</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink/50">
            seus diagramas
          </p>
        </div>
        <Link
          to="/diagrams/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80"
        >
          Novo diagrama
        </Link>
      </header>

      {diagrams.data?.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-12 text-center">
          <p className="text-ink/60">Nenhum diagrama ainda.</p>
          <Link to="/diagrams/new" className="mt-2 inline-block text-sm text-primary underline">
            Criar o primeiro
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {diagrams.data?.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-panel p-4"
          >
            <Link to={`/session/${d.id}`} className="min-w-0 flex-1">
              <h2 className="truncate font-medium text-ink hover:text-primary">{d.title}</h2>
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
    </div>
  );
}
