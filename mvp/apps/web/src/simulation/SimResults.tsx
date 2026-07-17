import { useEffect, useState } from "react";

import { useCanvas } from "../canvas/store";
import { useTutorialSignals } from "../tutorial/signals";

const tipTone = {
  ok: "border-emerald-400/30 text-emerald-200/90",
  warning: "border-amber-400/40 text-amber-200/90",
  critical: "border-red-500/50 text-red-200/90",
} as const;

function Metric({ label, value, target, bad }: {
  label: string; value: string; target?: string; bad?: boolean;
}) {
  return (
    <div className="min-w-20 px-3 first:pl-0 last:pr-0">
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">{label}</div>
      <div className={`text-sm font-medium ${bad ? "text-red-400" : "text-ink"}`}>{value}</div>
      {target && <div className="font-mono text-[9px] text-ink/40">alvo {target}</div>}
    </div>
  );
}

/** HUD flutuante com o resultado da última simulação (parte inferior do canvas). */
export function SimResults() {
  const sim = useCanvas((s) => s.sim);
  const diagramId = useCanvas((s) => s.diagramId);
  const nodes = useCanvas((s) => s.nodes);
  const selectNodes = useCanvas((s) => s.selectNodes);
  const [collapsed, setCollapsed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // com o dock do tutorial aberto, o HUD sobe para não ficar escondido
  const tutorialActive = useTutorialSignals((s) => s.active);
  const baseBottom = tutorialActive ? 128 : 12;

  useEffect(() => {
    if (!diagramId) return;
    try {
      const saved = window.localStorage.getItem(`blueprint-sim-hud:${diagramId}`);
      setOffset(saved ? JSON.parse(saved) : { x: 0, y: 0 });
    } catch {
      setOffset({ x: 0, y: 0 });
    }
  }, [diagramId]);

  useEffect(() => {
    if (diagramId) {
      window.localStorage.setItem(`blueprint-sim-hud:${diagramId}`, JSON.stringify(offset));
    }
  }, [diagramId, offset]);

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, offset };
    const move = (pointer: PointerEvent) =>
      setOffset({
        x: start.offset.x + pointer.clientX - start.x,
        y: start.offset.y + pointer.clientY - start.y,
      });
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const position = {
    left: `calc(50% + ${offset.x}px)`,
    bottom: `${baseBottom - offset.y}px`,
    transform: "translateX(-50%)",
  };

  if (!sim) return null;
  const targets = sim.targets;
  const nodeName = (id: string | null) =>
    (nodes.find((n) => n.id === id)?.data.name as string) ?? id ?? "—";

  if (collapsed) {
    return (
      <div
        style={position}
        className="absolute z-20 flex items-center rounded-full border border-white/10
                   bg-panel/95 px-2 py-1.5 font-mono text-[10px] text-ink/70 shadow-xl"
      >
        <span
          onPointerDown={startDrag}
          onDoubleClick={() => setOffset({ x: 0, y: 0 })}
          className="cursor-move px-1 text-ink/35"
          title="arraste o HUD; duplo clique restaura"
        >
          ⠿
        </span>
        <button onClick={() => setCollapsed(false)} className="px-2 hover:text-ink">
          p99 {Math.round(sim.p99_ms)} ms · erro {(sim.error_rate * 100).toFixed(1)}% ▴
        </button>
      </div>
    );
  }

  return (
    <div style={position} className="absolute z-20 w-[600px] max-w-[calc(100%-8rem)]
                    select-none rounded-xl border border-white/10 bg-panel p-3 shadow-xl">
      <div className="flex items-center divide-x divide-white/10">
        <span
          onPointerDown={startDrag}
          onDoubleClick={() => setOffset({ x: 0, y: 0 })}
          className="cursor-move pr-2 text-ink/30"
          title="arraste o HUD; duplo clique restaura"
        >
          ⠿
        </span>
        <Metric label="RPS total" value={String(Math.round(sim.total_rps))} />
        <Metric
          label="p99"
          value={`${Math.round(sim.p99_ms)} ms`}
          target={targets?.p99_ms ? `${targets.p99_ms} ms` : undefined}
          bad={!!targets?.p99_ms && sim.p99_ms > targets.p99_ms}
        />
        <Metric label="Erro" value={`${(sim.error_rate * 100).toFixed(1)}%`}
          bad={sim.error_rate > 0.001} />
        <Metric
          label="Disponib."
          value={`${sim.availability_pct.toFixed(2)}%`}
          target={targets?.availability_pct ? `${targets.availability_pct}%` : undefined}
          bad={!!targets?.availability_pct && sim.availability_pct < targets.availability_pct}
        />
        {sim.bottleneck && (
          <button
            onClick={() => selectNodes([sim.bottleneck!])}
            className="ml-1 min-w-0 flex-1 truncate px-3 text-left"
            title="clique para destacar o nó"
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-red-400/70">
              gargalo
            </span>
            <span className="block truncate text-sm font-medium text-red-300">
              {nodeName(sim.bottleneck)}
            </span>
          </button>
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto self-start pl-3 text-ink/40 hover:text-ink"
          title="recolher"
        >
          ▾
        </button>
      </div>

      {sim.tips.length > 0 && (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
          {sim.tips.map((tip, i) => (
            <li key={i}>
              <button
                onClick={() => tip.component_refs.length && selectNodes(tip.component_refs)}
                className={`w-full rounded-md border bg-card/50 px-2 py-1 text-left text-[11px]
                            leading-snug ${tipTone[tip.severity]}`}
              >
                {tip.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
