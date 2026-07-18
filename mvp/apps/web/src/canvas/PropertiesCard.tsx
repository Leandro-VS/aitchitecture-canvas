import { useQuery } from "@tanstack/react-query";

import { api, type Archetype } from "../api/client";
import { isArchNode, useCanvas, type ArchNodeData } from "./store";

const field =
  "w-full select-text rounded-md border border-white/10 bg-card px-2.5 py-1.5 text-sm " +
  "text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none";
const label = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50";
const NO_CAPACITY = new Set(["client", "mobile"]);

/** Card de propriedades — atualiza o canvas durante a edição e fecha ao salvar
 *  ou ao clicar no pane. Tudo continua opcional. */
export function PropertiesCard() {
  const { data: archetypes } = useQuery({
    queryKey: ["archetypes"],
    queryFn: () => api<Archetype[]>("/api/archetypes"),
    staleTime: Infinity,
  });
  const editingNodeId = useCanvas((s) => s.editingNodeId);
  const nodes = useCanvas((s) => s.nodes);
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const setEditingNode = useCanvas((s) => s.setEditingNode);

  const node = nodes.find((n) => n.id === editingNodeId);
  if (!node) return null;

  const selectedArchetype = isArchNode(node)
    ? archetypes?.find((item) => item.archetype === node.data.archetype)
    : undefined;
  const archetypeDescription = selectedArchetype?.description;
  const isGuardrail = selectedArchetype?.archetype_class === "input-guardrail"
    || selectedArchetype?.archetype_class === "output-guardrail";

  const close = () => setEditingNode(null);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    close();
  };

  return (
    <div
      className="absolute left-[252px] top-4 z-30 max-h-[calc(100%-2rem)] w-64 select-none
                 overflow-y-auto rounded-xl border border-white/10 bg-panel p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
          {node.type === "annotation" ? "Comentário" : "Propriedades"}
        </h2>
        <button onClick={close} className="text-ink/40 hover:text-ink">✕</button>
      </div>

      {node.type === "annotation" ? (
        <form onSubmit={submit}>
          <textarea
            rows={4}
            autoFocus
            className={field}
            placeholder="Contexto para as IAs e para o pré-ADR…"
            value={(node.data.text as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                close();
              }
            }}
          />
          <p className="mt-2 text-[11px] text-ink/40">
            Arraste do handle do balão até um nó para ancorá-lo.
          </p>
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium
                       text-white transition hover:bg-primary/80"
          >
            Salvar comentário
          </button>
        </form>
      ) : (
        isArchNode(node) && (
          <form onSubmit={submit} className="space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              {(node.data as ArchNodeData).label}
            </span>
            {archetypeDescription && (
              <p className="rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-2
                            text-[11px] leading-relaxed text-ink/60">
                {archetypeDescription}
              </p>
            )}
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
            {isGuardrail && (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <p className="text-[10px] leading-relaxed text-ink/55">
                  {selectedArchetype?.archetype_class === "input-guardrail"
                    ? "Bloqueios aqui evitam que a requisição chegue ao LLM."
                    : "A resposta já consumiu o LLM; este estágio decide se ela pode ser entregue."}
                </p>
                <div>
                  <label className={label} htmlFor="p-guardrail-scope">Contexto analisado</label>
                  <select
                    id="p-guardrail-scope"
                    className={field}
                    value={node.data.guardrailScope ?? "current_turn"}
                    onChange={(e) => updateNodeData(node.id, { guardrailScope: e.target.value })}
                  >
                    <option value="current_turn">Interação atual</option>
                    <option value="recent_history">Histórico recente</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="p-guardrail-failure">Falha ou saturação</label>
                  <select
                    id="p-guardrail-failure"
                    className={field}
                    value={node.data.guardrailFailureMode ?? "fail_closed"}
                    onChange={(e) => updateNodeData(node.id, {
                      guardrailFailureMode: e.target.value,
                    })}
                  >
                    <option value="fail_closed">Fail closed · bloqueia</option>
                    <option value="fail_open">Fail open · deixa passar</option>
                  </select>
                </div>
                <p className="text-[10px] leading-relaxed text-ink/40">
                  O histórico recente detecta ataques multi-turn, mas consome mais capacidade e
                  adiciona latência. Fail closed protege por padrão; fail open preserva
                  disponibilidade e sinaliza tráfego não inspecionado.
                </p>
              </div>
            )}
            {!NO_CAPACITY.has(node.data.archetype) && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-card/50 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label} htmlFor="p-size">Porte</label>
                    <select
                      id="p-size"
                      className={field}
                      value={node.data.size ?? "medium"}
                      onChange={(e) => updateNodeData(node.id, { size: e.target.value })}
                    >
                      <option value="small">Small · 0,5×</option>
                      <option value="medium">Medium · 1×</option>
                      <option value="large">Large · 2×</option>
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="p-scaling">Escala</label>
                    <select
                      id="p-scaling"
                      className={field}
                      value={node.data.scaling ?? "fixed"}
                      onChange={(e) => updateNodeData(node.id, { scaling: e.target.value })}
                    >
                      <option value="fixed">Fixa</option>
                      <option value="elastic">Elástica</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label} htmlFor="p-min-units">
                      {(node.data.scaling ?? "fixed") === "elastic" ? "Mín. unidades" : "Unidades"}
                    </label>
                    <input
                      id="p-min-units"
                      type="number"
                      min={1}
                      max={100}
                      className={field}
                      value={node.data.replicas ?? 1}
                      onChange={(e) => {
                        const replicas = Math.min(100, Math.max(1, Number(e.target.value) || 1));
                        updateNodeData(node.id, {
                          replicas,
                          maxReplicas: Math.max(replicas, node.data.maxReplicas ?? 10),
                        });
                      }}
                    />
                  </div>
                  {(node.data.scaling ?? "fixed") === "elastic" && (
                    <div>
                      <label className={label} htmlFor="p-max-units">Máx. unidades</label>
                      <input
                        id="p-max-units"
                        type="number"
                        min={node.data.replicas ?? 1}
                        max={100}
                        className={field}
                        value={Math.max(node.data.replicas ?? 1, node.data.maxReplicas ?? 10)}
                        onChange={(e) => updateNodeData(node.id, {
                          maxReplicas: Math.min(
                            100,
                            Math.max(node.data.replicas ?? 1, Number(e.target.value) || 1),
                          ),
                        })}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[10px] leading-relaxed text-ink/40">
                  O porte altera a capacidade por unidade. Escala elástica reage com atraso
                  dentro da janela simulada, até o máximo definido.
                </p>
              </div>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium
                         text-white transition hover:bg-primary/80"
            >
              Salvar alterações
            </button>
          </form>
        )
      )}
    </div>
  );
}
