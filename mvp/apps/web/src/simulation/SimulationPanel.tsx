import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { runSimulation, type SimResult } from "../api/client";
import { serializeCanvas, useCanvas } from "../canvas/store";

const tipTone = {
  ok: "border-emerald-400/30 text-emerald-200/90",
  warning: "border-amber-400/40 text-amber-200/90",
  critical: "border-red-500/50 text-red-200/90",
} as const;

function Metric({ label, value, target, bad }: {
  label: string; value: string; target?: string; bad?: boolean;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-card px-2 py-1.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">{label}</div>
      <div className={`text-sm font-medium ${bad ? "text-red-400" : "text-ink"}`}>{value}</div>
      {target && <div className="font-mono text-[9px] text-ink/40">alvo {target}</div>}
    </div>
  );
}

export function SimulationPanel({ diagramId }: { diagramId: string }) {
  const sim = useCanvas((s) => s.sim);
  const setSim = useCanvas((s) => s.setSim);
  const selectNodes = useCanvas((s) => s.selectNodes);
  const nodes = useCanvas((s) => s.nodes);

  // NFRs quantitativos vivem aqui (decisão de produto), não no intake
  const [baseRps, setBaseRps] = useState(100);
  const [multiplier, setMultiplier] = useState(1);
  const [readRatio, setReadRatio] = useState(0.8);
  const [cacheHit, setCacheHit] = useState(0.8);
  const [p99Target, setP99Target] = useState<string>("");
  const [availTarget, setAvailTarget] = useState<string>("");

  const run = useMutation({
    mutationFn: () =>
      runSimulation(
        diagramId,
        {
          base_rps: baseRps,
          traffic_multiplier: multiplier,
          read_ratio: readRatio,
          cache_hit_rate: cacheHit,
          p99_target_ms: p99Target ? Number(p99Target) : null,
          availability_target_pct: availTarget ? Number(availTarget) : null,
        },
        serializeCanvas(), // o que está na tela, não o que o autosave já persistiu
      ),
    onSuccess: (result: SimResult) => setSim(result),
  });

  // re-simulação automática: depois da 1ª rodada manual, qualquer mudança no
  // canvas (nó, edge, réplica, metadado) re-roda com os mesmos parâmetros
  const rev = useCanvas((s) => s.rev);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (rev === 0 || !useCanvas.getState().sim) return;
    const t = setTimeout(() => runRef.current.mutate(), 600);
    return () => clearTimeout(t);
  }, [rev]);

  const nodeName = (id: string | null) =>
    (nodes.find((n) => n.id === id)?.data.name as string) ?? id ?? "—";

  const targets = sim?.targets;

  const targetField =
    "w-full select-text rounded-md border border-white/10 bg-card px-2 py-1 text-xs text-ink " +
    "placeholder:text-ink/30 focus:border-primary focus:outline-none";

  return (
    <div className="space-y-3">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50"
          htmlFor="sim-rps">
          RPS base
        </label>
        <input id="sim-rps" type="number" min={1} className={targetField} value={baseRps}
          onChange={(e) => setBaseRps(Math.max(1, Number(e.target.value) || 1))} />
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
          Traffic ×{multiplier.toFixed(1)} — {Math.round(baseRps * multiplier)} rps
        </label>
        <input type="range" min={0.5} max={10} step={0.5} value={multiplier}
          onChange={(e) => setMultiplier(Number(e.target.value))}
          className="w-full accent-[#1458E8]" />
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
          Read ratio — {Math.round(readRatio * 100)}% leitura
        </label>
        <input type="range" min={0} max={1} step={0.01} value={readRatio}
          onChange={(e) => setReadRatio(Number(e.target.value))}
          className="w-full accent-[#1458E8]" />
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
          Cache hit — {Math.round(cacheHit * 100)}%
        </label>
        <input type="range" min={0} max={1} step={0.01} value={cacheHit}
          onChange={(e) => setCacheHit(Number(e.target.value))}
          className="w-full accent-[#1458E8]" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50"
            htmlFor="sim-p99-target">
            p99 alvo (ms)
          </label>
          <input id="sim-p99-target" type="number" min={1} placeholder="—"
            className={targetField} value={p99Target}
            onChange={(e) => setP99Target(e.target.value)} />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50"
            htmlFor="sim-avail-target">
            Disp. alvo (%)
          </label>
          <input id="sim-avail-target" type="number" min={90} max={100} step={0.01}
            placeholder="—" className={targetField} value={availTarget}
            onChange={(e) => setAvailTarget(e.target.value)} />
        </div>
      </div>

      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white
                   hover:bg-primary/80 disabled:opacity-50"
      >
        {run.isPending ? "Simulando…" : "Simular"}
      </button>
      {run.isError && <p className="text-xs text-red-400">{String(run.error)}</p>}

      {sim && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="RPS total" value={String(Math.round(sim.total_rps))} />
            <Metric
              label="p99"
              value={`${Math.round(sim.p99_ms)} ms`}
              target={targets?.p99_ms ? `${targets.p99_ms} ms` : undefined}
              bad={!!targets?.p99_ms && sim.p99_ms > targets.p99_ms}
            />
            <Metric
              label="Erro"
              value={`${(sim.error_rate * 100).toFixed(1)}%`}
              bad={sim.error_rate > 0.001}
            />
            <Metric
              label="Disponib."
              value={`${sim.availability_pct.toFixed(2)}%`}
              target={targets?.availability_pct ? `${targets.availability_pct}%` : undefined}
              bad={
                !!targets?.availability_pct && sim.availability_pct < targets.availability_pct
              }
            />
          </div>

          {sim.bottleneck && (
            <button
              onClick={() => selectNodes([sim.bottleneck!])}
              className="w-full rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5
                         text-left text-xs text-red-200 hover:border-red-400"
            >
              gargalo: <span className="font-medium">{nodeName(sim.bottleneck)}</span>{" "}
              <span className="font-mono text-[10px]">
                (cpu {Math.round((sim.nodes[sim.bottleneck]?.cpu ?? 0) * 100)}%)
              </span>
            </button>
          )}

          <ul className="space-y-1.5">
            {sim.tips.map((tip, i) => (
              <li key={i}>
                <button
                  onClick={() => tip.component_refs.length && selectNodes(tip.component_refs)}
                  className={`w-full rounded-md border bg-card/50 px-2 py-1.5 text-left text-[11px]
                              leading-snug ${tipTone[tip.severity]}`}
                >
                  {tip.message}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
