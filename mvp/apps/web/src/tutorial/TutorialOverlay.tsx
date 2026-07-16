import { useEffect, useState } from "react";

import { useCanvas } from "../canvas/store";
import { useTutorialSignals } from "./signals";
import { TUTORIAL_STEPS, type Condition } from "./steps";

const storageKey = (diagramId: string) => `blueprint-tutorial:${diagramId}`;

function useConditionMet(conditions: Condition[] | undefined, hasIntake: boolean): boolean {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const sim = useCanvas((s) => s.sim);
  const signals = useTutorialSignals();

  if (!conditions) return true;
  return conditions.every((c) => {
    switch (c.kind) {
      case "node_added":
        return nodes.some(
          (n) => n.type === "arch" && !n.data.ghost && n.data.archetype === c.archetype,
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
      case "architect_replied":
        return signals.architectReplied;
      case "diff_applied":
        return signals.diffApplied;
      case "judge_completed":
        return signals.judgeCompleted;
      case "export_done":
        return signals.exportDone;
    }
  });
}

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onFinish: () => void;
}

/** Dock do tutorial (M14): passos declarativos, ações bloqueiam o Next até a
 *  condição ser satisfeita observando os stores. Progresso em localStorage. */
export function TutorialOverlay({ diagramId, hasIntake, onFinish }: Props) {
  const [index, setIndex] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey(diagramId)));
    return Number.isFinite(saved) ? Math.min(saved, TUTORIAL_STEPS.length - 1) : 0;
  });
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

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 select-none border-t border-primary/40
                    bg-panel/95 px-4 py-3 shadow-2xl backdrop-blur">
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
          <p className="mt-0.5 text-xs leading-relaxed text-ink/70">{step.body}</p>
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
