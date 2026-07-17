import { useEffect } from "react";

import { INTENTS, useCanvas, type Intent } from "./store";

const DESCRIPTIONS: Record<Intent, string> = {
  request: "chamada síncrona padrão",
  cache_lookup: "consulta a cache (hit não segue adiante)",
  async_message: "publica em fila/evento — sai do caminho síncrono",
  retrieval: "busca em índice (search ou vetores/RAG)",
  ai_call: "chamada a modelo ou serviço de IA",
  validation: "checagem: auth, regra de negócio, guardrail",
  dead_letter: "encaminha somente mensagens que falharam para a DLQ",
};

/** Aberto ao conectar dois nós: toda edge tem um intent (M2/§5.5). */
export function IntentPicker() {
  const pending = useCanvas((s) => s.pendingConnection);
  const confirm = useCanvas((s) => s.confirmConnection);
  const cancel = useCanvas((s) => s.cancelConnection);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, cancel]);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={cancel}>
      <div
        className="w-80 rounded-xl border border-white/10 bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink/50">
          Intent da conexão
        </h3>
        <ul className="space-y-1">
          {INTENTS.map((intent) => (
            <li key={intent}>
              <button
                onClick={() => confirm(intent)}
                className="w-full rounded-md border border-white/10 bg-card px-3 py-2 text-left
                           hover:border-primary/60"
              >
                <span className="font-mono text-xs text-ink">{intent}</span>
                <span className="block text-[11px] text-ink/50">{DESCRIPTIONS[intent]}</span>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={cancel} className="mt-3 text-xs text-ink/50 hover:text-ink">
          cancelar (Esc)
        </button>
      </div>
    </div>
  );
}
