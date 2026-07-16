import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { runSimulation, type SimResult } from "../api/client";
import { serializeCanvas, useCanvas } from "../canvas/store";

function readLabel(r: number): string {
  const pct = Math.round(r * 100);
  if (r >= 0.9) return `${pct}% read · Read-heavy · Hot read path`;
  if (r >= 0.7) return `${pct}% read · Read-heavy`;
  if (r <= 0.3) return `${100 - pct}% write · Write-heavy`;
  return `${pct}% read · Balanced`;
}

const tinyLabel = "font-mono text-[9px] uppercase tracking-widest text-ink/45";
const popField =
  "w-full select-text rounded-md border border-white/10 bg-card px-2 py-1 text-xs text-ink " +
  "placeholder:text-ink/30 focus:border-primary focus:outline-none";

/** Barra flutuante de simulação no topo do canvas (referência: System Design
 *  Playground). Parâmetros extras (RPS base, cache hit, alvos) ficam no ⚙. */
export function SimulationBar({ diagramId }: { diagramId: string }) {
  const setSim = useCanvas((s) => s.setSim);
  const [baseRps, setBaseRps] = useState(100);
  const [multiplier, setMultiplier] = useState(1);
  const [readRatio, setReadRatio] = useState(0.8);
  const [cacheHit, setCacheHit] = useState(0.8);
  const [p99Target, setP99Target] = useState("");
  const [availTarget, setAvailTarget] = useState("");
  const [gearOpen, setGearOpen] = useState(false);

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
        serializeCanvas(), // o que está na tela, não o que o autosave persistiu
      ),
    onSuccess: (result: SimResult) => setSim(result),
  });

  // re-simulação automática: depois da 1ª rodada, mudanças no canvas re-rodam
  const rev = useCanvas((s) => s.rev);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (rev === 0 || !useCanvas.getState().sim) return;
    const t = setTimeout(() => runRef.current.mutate(), 600);
    return () => clearTimeout(t);
  }, [rev]);

  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 select-none">
      <div className="flex items-center gap-5 rounded-xl border border-white/10 bg-panel/95 px-4 py-2 shadow-xl backdrop-blur">
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-sm
                     font-medium text-white hover:bg-primary/80 disabled:opacity-50"
        >
          <span className="text-[10px]">▶</span>
          {run.isPending ? "Simulando…" : "Start"}
        </button>

        <div className="w-40">
          <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
            <span className={tinyLabel}>Traffic</span>
            <span className="font-mono text-[10px] text-ink/70">
              ×{multiplier.toFixed(1)} · {Math.round(baseRps * multiplier)} rps
            </span>
          </div>
          <input type="range" min={0.5} max={10} step={0.5} value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="w-full accent-[#1458E8]" />
        </div>

        <div className="w-44">
          <div className="flex items-baseline justify-between">
            <span className={tinyLabel}>Reads vs writes</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={readRatio}
            onChange={(e) => setReadRatio(Number(e.target.value))}
            className="w-full accent-[#1458E8]" />
          <div className="font-mono text-[9px] leading-none text-ink/45">
            {readLabel(readRatio)}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setGearOpen((o) => !o)}
            title="parâmetros: RPS base, cache hit, alvos"
            className={`rounded-md border px-2 py-1 text-sm ${
              gearOpen ? "border-primary text-ink" : "border-white/10 text-ink/50 hover:text-ink"
            }`}
          >
            ⚙
          </button>
          {gearOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-60 space-y-2.5 rounded-xl
                            border border-white/10 bg-panel p-3 shadow-xl">
              <div>
                <label className={tinyLabel} htmlFor="bar-rps">RPS base</label>
                <input id="bar-rps" type="number" min={1} className={popField} value={baseRps}
                  onChange={(e) => setBaseRps(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <label className={tinyLabel}>Cache hit — {Math.round(cacheHit * 100)}%</label>
                <input type="range" min={0} max={1} step={0.01} value={cacheHit}
                  onChange={(e) => setCacheHit(Number(e.target.value))}
                  className="w-full accent-[#1458E8]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={tinyLabel} htmlFor="bar-p99">p99 alvo (ms)</label>
                  <input id="bar-p99" type="number" min={1} placeholder="—" className={popField}
                    value={p99Target} onChange={(e) => setP99Target(e.target.value)} />
                </div>
                <div>
                  <label className={tinyLabel} htmlFor="bar-avail">Disp. alvo (%)</label>
                  <input id="bar-avail" type="number" min={90} max={100} step={0.01}
                    placeholder="—" className={popField} value={availTarget}
                    onChange={(e) => setAvailTarget(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {run.isError && (
        <p className="mt-1 text-center text-xs text-red-400">{String(run.error)}</p>
      )}
    </div>
  );
}
