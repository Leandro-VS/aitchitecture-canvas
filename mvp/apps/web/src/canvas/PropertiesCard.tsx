import { PropertiesPanel } from "./PropertiesPanel";
import { useCanvas } from "./store";

/** Card flutuante de propriedades — aparece só com um nó selecionado. */
export function PropertiesCard() {
  const nodes = useCanvas((s) => s.nodes);
  const selectedCount = nodes.filter((n) => n.selected).length;
  if (selectedCount !== 1) return null;

  return (
    <div className="absolute right-3 top-3 z-10 w-64 select-none rounded-xl border
                    border-white/10 bg-panel/95 p-3 shadow-xl backdrop-blur">
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">
        Propriedades
      </h2>
      <PropertiesPanel />
    </div>
  );
}
