import { JudgePanel } from "./JudgePanel";

interface Props {
  diagramId: string;
  hasIntake: boolean;
  onNeedContext: () => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** Aba vertical na borda direita que expande o painel do Juiz sobre o canvas.
 *  O estado open vive na Session: com o painel aberto, o Ask AIrchitect é "empurrado"
 *  para a esquerda em vez de ficar escondido. */
export function JudgesRail({ open, onToggle, ...panelProps }: Props) {
  if (!open) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 select-none rounded-l-md
                   border border-r-0 border-white/10 bg-panel px-2.5 py-6 font-mono
                   text-[11px] uppercase tracking-widest text-ink/60 shadow-xl hover:text-ink"
        style={{ writingMode: "vertical-rl" }}
      >
        AI Judge
      </button>
    );
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-80 select-none flex-col
                      border-l border-white/10 bg-panel shadow-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/60">AI Judge</h2>
        <button onClick={() => onToggle(false)} className="text-ink/40 hover:text-ink">
          ✕
        </button>
      </header>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-8">
        <JudgePanel {...panelProps} />
      </div>
    </aside>
  );
}
