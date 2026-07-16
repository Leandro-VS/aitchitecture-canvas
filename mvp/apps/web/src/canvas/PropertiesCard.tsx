import { isArchNode, useCanvas, type ArchNodeData } from "./store";

const field =
  "w-full select-text rounded-md border border-white/10 bg-card px-2.5 py-1.5 text-sm " +
  "text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none";
const label = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50";

/** Card de propriedades — abre pelo botão ✎ dentro do próprio componente.
 *  Tudo opcional: preenche se quiser, fecha e segue desenhando. */
export function PropertiesCard({ shiftLeft }: { shiftLeft: boolean }) {
  const editingNodeId = useCanvas((s) => s.editingNodeId);
  const nodes = useCanvas((s) => s.nodes);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const setEditingNode = useCanvas((s) => s.setEditingNode);

  const node = nodes.find((n) => n.id === editingNodeId);
  if (!node) return null;

  const close = () => setEditingNode(null);

  return (
    <div
      className="absolute top-16 z-30 w-64 select-none rounded-xl border border-white/10
                 bg-panel p-3 shadow-xl"
      style={{ right: shiftLeft ? 340 : 12 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
          {node.type === "annotation" ? "Comentário" : "Propriedades"}
        </h2>
        <button onClick={close} className="text-ink/40 hover:text-ink">✕</button>
      </div>

      {node.type === "annotation" ? (
        <div>
          <textarea
            rows={4}
            autoFocus
            className={field}
            placeholder="Contexto para as IAs e para o pré-ADR…"
            value={(node.data.text as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
          />
          <p className="mt-2 text-[11px] text-ink/40">
            Arraste do handle do balão até um nó para ancorá-lo.
          </p>
        </div>
      ) : (
        isArchNode(node) && (
          <div className="space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              {(node.data as ArchNodeData).label}
            </span>
            <div>
              <label className={label} htmlFor="p-name">Nome</label>
              <input id="p-name" autoFocus className={field} value={node.data.name}
                onChange={(e) => updateNodeData(node.id, { name: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor="p-subtitle">Subtítulo</label>
              <input id="p-subtitle" className={field} placeholder="ex.: Database — Write Only"
                value={(node.data as ArchNodeData).subtitle ?? ""}
                onChange={(e) => updateNodeData(node.id, { subtitle: e.target.value })} />
            </div>
            <p className="text-[11px] text-ink/40">
              Réplicas: use os botões −/+ no próprio componente.
            </p>
          </div>
        )
      )}
    </div>
  );
}
