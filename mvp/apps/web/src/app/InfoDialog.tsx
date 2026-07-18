import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal informativo compartilhado. O portal evita que transforms do canvas
 *  alterem o posicionamento fixed do backdrop. */
export function InfoDialog({ eyebrow, title, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#04100d]/80 p-4
                 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        className="panel-scroll max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto
                   rounded-2xl border border-primary/25 bg-panel shadow-[0_28px_90px_rgba(2,12,9,0.65)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b
                           border-white/10 bg-panel/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border
                             border-primary/60 bg-primary/10 font-display text-lg font-semibold
                             text-primary">
              i
            </span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/75">
                {eyebrow}
              </p>
              <h2 id="info-dialog-title" className="mt-0.5 font-display text-xl font-semibold text-ink">
                {title}
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar explicação"
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-ink/50
                       transition hover:border-primary/40 hover:text-ink"
          >
            ✕
          </button>
        </header>
        <div className="space-y-5 px-5 py-5 text-sm leading-6 text-ink/65 sm:px-6">
          {children}
        </div>
        <footer className="border-t border-white/10 bg-card/35 px-5 py-3 text-[11px] text-ink/40 sm:px-6">
          Pressione Esc ou clique fora do modal para fechar.
        </footer>
      </div>
    </div>,
    document.body,
  );
}
