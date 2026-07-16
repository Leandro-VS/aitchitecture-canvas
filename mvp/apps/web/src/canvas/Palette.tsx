import { useQuery } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { api, type Archetype } from "../api/client";
import { useCanvas } from "./store";

export const ARCHETYPE_DRAG_TYPE = "application/blueprint-archetype";

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
  const { screenToFlowPosition } = useReactFlow();
  const [minimized, setMinimized] = useState(false);
  const [search, setSearch] = useState("");
  const cascade = useRef(0);

  const centerPosition = () => {
    const pane = document.querySelector(".react-flow");
    const r = pane?.getBoundingClientRect();
    const offset = (cascade.current++ % 6) * 28;
    return screenToFlowPosition({
      x: (r ? r.left + r.width / 2 : window.innerWidth / 2) + offset,
      y: (r ? r.top + r.height / 2 : window.innerHeight / 2) + offset,
    });
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
                   text-ink/60 shadow-xl backdrop-blur hover:text-ink"
      >
        ▸ Componentes
      </button>
    );
  }

  return (
    <aside className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-56
                      select-none flex-col rounded-xl border border-white/10 bg-panel/95
                      shadow-xl backdrop-blur">
      <header className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/50">Componentes</h2>
        <button onClick={() => setMinimized(true)} className="text-ink/40 hover:text-ink"
          title="minimizar">
          ▾
        </button>
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
            onClick={() => addAnnotation(centerPosition())}
            onDragStart={(e) => {
              e.dataTransfer.setData(ARCHETYPE_DRAG_TYPE, JSON.stringify({ kind: "annotation" }));
              e.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-pointer rounded-md border border-dashed border-amber-400/40
                       bg-amber-200/5 px-2.5 py-1.5 text-xs text-amber-200/80
                       hover:border-amber-300"
          >
            + Balão de comentário
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
                  onClick={() => addFromPalette(a.archetype, a.label, centerPosition())}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      ARCHETYPE_DRAG_TYPE,
                      JSON.stringify({ archetype: a.archetype, label: a.label }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-pointer rounded-md border border-white/10 bg-card px-2.5
                             py-1.5 text-xs text-ink/80 hover:border-primary/60"
                  title={`${a.base_rps ?? "∞"} rps · ${a.base_latency_ms} ms — clique para adicionar ou arraste`}
                >
                  + {a.label}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
