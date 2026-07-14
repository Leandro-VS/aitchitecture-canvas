import { useQuery } from "@tanstack/react-query";

import { api, type Archetype, type Me } from "../api/client";

export function Home() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/me") });
  const archetypes = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Blueprint</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink/50">
          canvas de arquitetura · MVP — Fase 0
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-panel p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/50">Sessão</h2>
        {me.isLoading && <p className="mt-2 text-sm text-ink/60">carregando…</p>}
        {me.isError && (
          <p className="mt-2 text-sm text-red-400">API indisponível — {String(me.error)}</p>
        )}
        {me.data && (
          <p className="mt-2 text-sm">
            Logado como <span className="font-mono text-primary">{me.data.email}</span>{" "}
            <span className="rounded bg-card px-1.5 py-0.5 font-mono text-xs">{me.data.role}</span>
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/50">
          Catálogo de arquétipos {archetypes.data && `(${archetypes.data.length})`}
        </h2>
        {archetypes.data && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {archetypes.data.map((a) => (
              <li
                key={a.archetype}
                className="rounded-md border border-white/10 bg-card px-2.5 py-1 font-mono text-xs"
                title={`${a.category} · ${a.base_rps ?? "∞"} rps · ${a.base_latency_ms} ms`}
              >
                {a.label}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
