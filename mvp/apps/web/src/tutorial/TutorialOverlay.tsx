import { useEffect, useState } from "react";

import { useCanvas } from "../canvas/store";
import { useTutorialSignals } from "./signals";
import { TUTORIAL_STEPS, type Condition } from "./steps";

const storageKey = (diagramId: string) => `blueprint-tutorial:${diagramId}`;

function useConditionMet(conditions: Condition[] | undefined, hasIntake: boolean): boolean {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const sim = useCanvas((s) => s.sim);
  const simParams = useCanvas((s) => s.simParams);
  const signals = useTutorialSignals();

  if (!conditions) return true;
  return conditions.every((c) => {
    switch (c.kind) {
      case "node_added":
        return nodes.some(
          (n) => n.type === "arch" && !n.data.ghost && n.data.archetype === c.archetype,
        );
      case "node_replicas":
        return nodes.some(
          (n) =>
            n.type === "arch" &&
            !n.data.ghost &&
            n.data.archetype === c.archetype &&
            (n.data.replicas ?? 1) >= c.min,
        );
      case "edge_intent":
        return (
          edges.filter(
            (e) => (e.data as { intent?: string } | undefined)?.intent === c.intent,
          ).length >= c.count
        );
      case "annotation_added":
        return nodes.some((n) => n.type === "annotation");
      case "context_filled":
        return hasIntake;
      case "simulation_ran":
        return sim !== null;
      case "simulation_total_rps":
        return sim?.total_rps === c.value;
      case "simulation_setup":
        return (
          simParams.base_rps === c.baseRps &&
          simParams.traffic_multiplier === c.multiplier &&
          Math.abs(simParams.read_ratio - c.readRatio) < 0.001 &&
          Math.abs(simParams.cache_hit_rate - c.cacheHitRate) < 0.001 &&
          simParams.p99_target_ms === c.p99Target
        );
      case "simulation_bottleneck": {
        const bottleneck = nodes.find((node) => node.id === sim?.bottleneck);
        return bottleneck?.type === "arch" && bottleneck.data.archetype === c.archetype;
      }
      case "simulation_node_active": {
        const match = nodes.find(
          (node) => node.type === "arch" && node.data.archetype === c.archetype,
        );
        return Boolean(match && (sim?.nodes[match.id]?.rps ?? 0) > 0);
      }
      case "simulation_no_errors":
        return sim !== null && sim.error_rate <= 0.001;
      case "architect_prompt":
        return signals.lastArchitectPrompt === c.prompt;
      case "diff_applied":
        return signals.diffApplied;
      case "judge_completed":
        return signals.judgeCompleted;
      case "export_previewed":
        return signals.exportPreviewed;
    }
  });
}

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onFinish: () => void;
}

/** Dock do tutorial (M14): passos declarativos com Voltar/Próximo; ações
 *  bloqueiam o avanço até a condição real acontecer. Progresso em localStorage. */
export function TutorialOverlay({ diagramId, hasIntake, onFinish }: Props) {
  const [index, setIndex] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey(diagramId)));
    return Number.isFinite(saved) ? Math.min(saved, TUTORIAL_STEPS.length - 1) : 0;
  });
  const [minimized, setMinimized] = useState(false);
  const suggestPrompt = useTutorialSignals((s) => s.suggestPrompt);

  const step = TUTORIAL_STEPS[index];
  const satisfied = useConditionMet(step.done_when, hasIntake);
  const blocked = step.kind === "action" && !satisfied;
  const isLast = index === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    localStorage.setItem(storageKey(diagramId), String(index));
  }, [diagramId, index]);

  const finish = () => {
    localStorage.removeItem(storageKey(diagramId));
    onFinish();
  };

  if (minimized) {
    // minimizado ≠ sumido: o passo atual continua visível para o tutorial não
    // perder o fio — clique (ou ▴) expande de volta
    return (
      <button
        onClick={() => setMinimized(false)}
        title="expandir o tutorial"
        className="absolute bottom-3 left-1/2 z-40 flex max-w-[70%] -translate-x-1/2
                   select-none items-center gap-2 rounded-full border border-primary/40
                   bg-panel px-4 py-1.5 shadow-xl"
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink/50">
          tutorial {index + 1}/{TUTORIAL_STEPS.length}
        </span>
        <span className="truncate text-xs text-ink/85">{step.title}</span>
        {step.kind === "action" && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase
              tracking-widest ${
                satisfied
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-amber-400/15 text-amber-300"
              }`}
          >
            {satisfied ? "feito ✓" : "ação"}
          </span>
        )}
        <span className="shrink-0 text-ink/50">▴</span>
      </button>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 select-none border-t border-primary/40
                    bg-panel px-4 py-2.5 pr-10 shadow-2xl">
      <button
        onClick={() => setMinimized(true)}
        title="minimizar o tutorial (o passo atual continua visível)"
        className="absolute right-2 top-2 rounded px-1.5 text-sm text-ink/40
                   hover:bg-white/10 hover:text-ink"
      >
        ▾
      </button>
      <div className="mx-auto flex max-w-4xl items-start gap-4">
        <div className="mt-0.5 shrink-0 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
            tutorial
          </div>
          <div className="font-mono text-xs text-ink/70">
            {index + 1}/{TUTORIAL_STEPS.length}
          </div>
          <div className="mt-1 h-1 w-16 overflow-hidden rounded bg-white/10">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((index + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">
            {step.title}
            {step.kind === "action" && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase
                  tracking-widest ${
                    satisfied
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300"
                  }`}
              >
                {satisfied ? "feito ✓" : "ação"}
              </span>
            )}
          </h3>
          {/* whitespace-pre-line preserva quebras/identação; select-text libera
              copiar/colar (o dock é select-none para os controles) */}
          <p className="panel-scroll mt-0.5 max-h-40 cursor-text select-text overflow-y-auto
                        overscroll-contain whitespace-pre-line text-xs leading-relaxed
                        text-ink/70">
            {step.body}
          </p>
          {step.suggested_prompt && !satisfied && (
            <button
              onClick={() => suggestPrompt(step.suggested_prompt!)}
              className="mt-1.5 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs
                         text-cyan-300 hover:border-cyan-300"
            >
              💬 Enviar pergunta sugerida
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 self-center">
          <button onClick={finish} className="text-xs text-ink/40 hover:text-ink">
            Pular tutorial
          </button>
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-ink/70
                       hover:border-primary/60 disabled:opacity-30"
          >
            ← Voltar
          </button>
          <button
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            disabled={blocked}
            title={blocked ? "complete a ação acima para continuar" : undefined}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white
                       hover:bg-primary/80 disabled:opacity-40"
          >
            {isLast ? "Concluir" : blocked ? "Complete a ação" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
