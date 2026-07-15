import { isArchNode, useCanvas, type ArchNodeData } from "./store";

const field =
  "w-full select-text rounded-md border border-white/10 bg-card px-2.5 py-1.5 text-sm text-ink " +
  "placeholder:text-ink/30 focus:border-primary focus:outline-none";
const label = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50";

export function PropertiesPanel() {
  // selector retorna a referência estável s.nodes (filtrar aqui dentro criaria
  // um array novo por chamada → loop infinito de getSnapshot)
  const nodes = useCanvas((s) => s.nodes);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const selected = nodes.filter((n) => n.selected);

  if (selected.length !== 1) {
    return (
      <p className="text-xs text-ink/40">
        Selecione um componente para editar nome e subtítulo.
      </p>
    );
  }

  const node = selected[0];

  if (node.type === "annotation") {
    return (
      <div>
        <label className={label} htmlFor="note-text">Comentário</label>
        <textarea
          id="note-text"
          rows={4}
          className={field}
          placeholder="Contexto para as IAs e para o pré-ADR…"
          value={(node.data.text as string) ?? ""}
          onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
        />
        <p className="mt-2 text-[11px] text-ink/40">
          Arraste do handle do balão até um nó para ancorá-lo.
        </p>
      </div>
    );
  }

  if (!isArchNode(node)) return null;
  const data = node.data as ArchNodeData;
  const set = (fields: Partial<ArchNodeData>) => updateNodeData(node.id, fields);

  return (
    <div className="space-y-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
        {data.label}
      </span>
      <div>
        <label className={label} htmlFor="p-name">Nome</label>
        <input id="p-name" className={field} value={data.name}
          onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div>
        <label className={label} htmlFor="p-subtitle">Subtítulo</label>
        <input id="p-subtitle" className={field} placeholder="ex.: Database — Write Only"
          value={data.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} />
      </div>
      <p className="text-[11px] text-ink/40">
        Réplicas: use os botões −/+ no próprio componente.
      </p>
    </div>
  );
}
