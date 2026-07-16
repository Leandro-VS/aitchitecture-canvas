import { useState } from "react";

import { JudgePanel } from "./JudgePanel";

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onNeedContext: () => void;
}

/** Aba vertical na borda direita (estilo da inspiração) que expande o painel
 *  do Juiz sobre o canvas. */
export function JudgesRail(props: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 select-none rounded-l-md
                   border border-r-0 border-white/10 bg-panel px-1.5 py-4 font-mono
                   text-[10px] uppercase tracking-widest text-ink/60 shadow-xl hover:text-ink"
        style={{ writingMode: "vertical-rl" }}
      >
        AI Judge
      </button>
    );
  }

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-80 select-none flex-col
                      border-l border-white/10 bg-panel/95 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/60">AI Judge</h2>
        <button onClick={() => setOpen(false)} className="text-ink/40 hover:text-ink">
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <JudgePanel {...props} />
      </div>
    </aside>
  );
}
