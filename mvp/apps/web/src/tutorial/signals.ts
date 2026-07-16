import { create } from "zustand";

/** Sinais que os componentes emitem para as condições done_when do tutorial
 *  (as condições de canvas são lidas direto do useCanvas). */
interface TutorialSignals {
  /** tutorial em andamento — outros overlays (HUD) abrem espaço para o dock */
  active: boolean;
  architectReplied: boolean;
  diffApplied: boolean;
  judgeCompleted: boolean;
  exportDone: boolean;
  /** setado pelo tutorial → AskAI abre e envia automaticamente */
  suggestedPrompt: string | null;
  emit: (signal: "architectReplied" | "diffApplied" | "judgeCompleted" | "exportDone") => void;
  suggestPrompt: (prompt: string) => void;
  consumePrompt: () => string | null;
  reset: () => void;
}

export const useTutorialSignals = create<TutorialSignals>()((set, get) => ({
  active: false,
  architectReplied: false,
  diffApplied: false,
  judgeCompleted: false,
  exportDone: false,
  suggestedPrompt: null,
  emit: (signal) => set({ [signal]: true }),
  suggestPrompt: (prompt) => set({ suggestedPrompt: prompt }),
  consumePrompt: () => {
    const prompt = get().suggestedPrompt;
    if (prompt) set({ suggestedPrompt: null });
    return prompt;
  },
  reset: () =>
    set({
      architectReplied: false,
      diffApplied: false,
      judgeCompleted: false,
      exportDone: false,
      suggestedPrompt: null,
    }),
}));
