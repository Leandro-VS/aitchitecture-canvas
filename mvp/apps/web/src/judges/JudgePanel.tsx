import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  ApiError,
  getJudgeRun,
  getLatestJudgeRun,
  runJudge,
  type JudgeRun,
} from "../api/client";
import { serializeCanvas } from "../canvas/store";
import { useTutorialSignals } from "../tutorial/signals";
import { FindingCard } from "./FindingCard";

const verdictTone: Record<string, string> = {
  pass: "bg-emerald-400/15 text-emerald-300",
  borderline: "bg-amber-400/15 text-amber-300",
  fail: "bg-red-500/15 text-red-300",
};

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onNeedContext: () => void;
}

export function JudgePanel({ diagramId, hasIntake, onNeedContext }: Props) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);

  // restaura a última avaliação ao abrir a sessão
  const latest = useQuery({
    queryKey: ["judge-latest", diagramId],
    queryFn: () => getLatestJudgeRun(diagramId),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (latest.data && !runId) {
      queryClient.setQueryData(["judge-run", latest.data.id], latest.data);
      setRunId(latest.data.id);
    }
  }, [latest.data, runId, queryClient]);

  const run = useQuery({
    queryKey: ["judge-run", runId],
    queryFn: () => getJudgeRun(runId!),
    enabled: !!runId,
    refetchInterval: (q) =>
      q.state.data && ["queued", "running"].includes(q.state.data.status) ? 1500 : false,
  });

  const start = useMutation({
    mutationFn: () => runJudge(diagramId, serializeCanvas()),
    onSuccess: (r: JudgeRun) => {
      queryClient.setQueryData(["judge-run", r.id], r);
      setRunId(r.id);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) onNeedContext();
    },
  });

  const r = run.data;
  const analyzing = start.isPending || (r && ["queued", "running"].includes(r.status));

  useEffect(() => {
    if (r?.status === "done") useTutorialSignals.getState().emit("judgeCompleted");
  }, [r?.status]);

  return (
    <div className="space-y-3">
      <button
        onClick={() => (hasIntake ? start.mutate() : onNeedContext())}
        disabled={!!analyzing}
        title={hasIntake ? undefined : "o Juiz exige o contexto preenchido"}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white
                   hover:bg-primary/80 disabled:opacity-50"
      >
        {analyzing ? "Analisando…" : "Rodar Juiz"}
      </button>
      {!hasIntake && (
        <p className="text-[11px] leading-snug text-amber-300/80">
          Requer o contexto preenchido — clique no botão acima para abri-lo.
        </p>
      )}
      {start.isError && !(start.error instanceof ApiError && start.error.status === 409) && (
        <p className="text-xs text-red-400">{String(start.error)}</p>
      )}

      {r?.status === "failed" && (
        <p className="text-xs text-red-400">Avaliação falhou: {r.error}</p>
      )}

      {r?.status === "done" && (
        <>
          <div className="flex items-center gap-3 rounded-md border border-white/10 bg-card px-3 py-2">
            <span className="font-display text-2xl font-semibold">{r.score}</span>
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest
                ${verdictTone[r.verdict ?? ""] ?? ""}`}
            >
              {r.verdict}
            </span>
            {r.cached && (
              <span
                className="ml-auto font-mono text-[9px] uppercase tracking-widest text-ink/40"
                title="sem mudanças desde a última avaliação — resultado do cache"
              >
                cache
              </span>
            )}
          </div>

          {r.strengths.length > 0 && (
            <ul className="space-y-1">
              {r.strengths.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-emerald-200/80">
                  <span>✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1.5">
            {r.findings.map((f) => (
              <FindingCard key={f.id} finding={f} runId={r.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
