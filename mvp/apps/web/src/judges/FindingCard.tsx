import { useMutation, useQueryClient } from "@tanstack/react-query";

import { patchFinding, type JudgeFinding } from "../api/client";
import { useCanvas } from "../canvas/store";

const severityTone: Record<JudgeFinding["severity"], string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-400",
  info: "border-l-sky-400",
};

export function FindingCard({ finding, runId }: { finding: JudgeFinding; runId: string }) {
  const queryClient = useQueryClient();
  const selectNodes = useCanvas((s) => s.selectNodes);
  const resolved = finding.resolved_at !== null;

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof patchFinding>[1]) => patchFinding(finding.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["judge-run", runId] }),
  });

  const vote = (dir: "up" | "down") =>
    patch.mutate(finding.feedback === dir ? { clear_feedback: true } : { feedback: dir });

  const voteBtn = (dir: "up" | "down", glyph: string) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        vote(dir);
      }}
      title={dir === "up" ? "finding útil" : "finding ruim/genérico"}
      className={`rounded px-1.5 py-0.5 text-xs ${
        finding.feedback === dir
          ? "bg-primary/30 text-ink"
          : "text-ink/40 hover:bg-white/5 hover:text-ink/80"
      }`}
    >
      {glyph}
    </button>
  );

  return (
    <div
      onClick={() => finding.component_refs.length && selectNodes(finding.component_refs)}
      className={`cursor-pointer rounded-md border border-white/10 border-l-2 bg-card/60 p-2
        ${severityTone[finding.severity]} ${resolved ? "opacity-45" : ""}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink/50">
          {finding.severity}
        </span>
        {finding.citation ? (
          <span
            className="truncate rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200"
            title={finding.citation.excerpt}
          >
            {finding.citation.doc_id} &gt; {finding.citation.section}
          </span>
        ) : (
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-ink/40">
            análise geral
          </span>
        )}
        {resolved && (
          <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
            resolvido
          </span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-ink/85">{finding.recommendation}</p>
      <div className="mt-1.5 flex items-center gap-1">
        {voteBtn("up", "👍")}
        {voteBtn("down", "👎")}
        <button
          onClick={(e) => {
            e.stopPropagation();
            patch.mutate({ resolved: !resolved });
          }}
          className="ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide
                     text-ink/40 hover:bg-white/5 hover:text-ink/80"
        >
          {resolved ? "reabrir" : "resolver"}
        </button>
      </div>
    </div>
  );
}
