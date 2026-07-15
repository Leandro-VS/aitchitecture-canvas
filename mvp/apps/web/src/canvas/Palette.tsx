import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, type Archetype } from "../api/client";

export const ARCHETYPE_DRAG_TYPE = "application/blueprint-archetype";

export function Palette() {
  const { data } = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
    staleTime: Infinity,
  });

  const groups = useMemo(() => {
    const byCategory = new Map<string, Archetype[]>();
    for (const a of data ?? []) {
      byCategory.set(a.category, [...(byCategory.get(a.category) ?? []), a]);
    }
    return [...byCategory.entries()];
  }, [data]);

  return (
    <aside className="w-56 shrink-0 select-none overflow-y-auto border-r border-white/10 bg-panel p-3">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink/50">
        Componentes
      </h2>
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
          className="cursor-grab rounded-md border border-dashed border-amber-400/40
                     bg-amber-200/5 px-2.5 py-1.5 text-xs text-amber-200/80
                     hover:border-amber-300 active:cursor-grabbing"
        >
          Balão de comentário
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
                    JSON.stringify({ archetype: a.archetype, label: a.label }),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="cursor-grab rounded-md border border-white/10 bg-card px-2.5 py-1.5
                           text-xs text-ink/80 hover:border-primary/60 active:cursor-grabbing"
                title={`${a.base_rps ?? "∞"} rps · ${a.base_latency_ms} ms`}
              >
                {a.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
