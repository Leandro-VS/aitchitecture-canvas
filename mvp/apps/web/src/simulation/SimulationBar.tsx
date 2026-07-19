import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { runSimulation, type SimResult } from "../api/client";
import { InfoDialog } from "../app/InfoDialog";
import { DEFAULT_SIM_PARAMS, serializeCanvas, useCanvas } from "../canvas/store";

function readLabel(r: number): string {
  const pct = Math.round(r * 100);
  if (r >= 0.9) return `${pct}% read · Read-heavy · Hot read path`;
  if (r >= 0.7) return `${pct}% read · Read-heavy`;
  if (r <= 0.3) return `${100 - pct}% write · Write-heavy`;
  return `${pct}% read · Balanced`;
}

const tinyLabel = "font-mono text-[9px] uppercase tracking-widest text-ink/45";
const popField =
  "w-full select-text rounded-md border border-white/10 bg-card px-2 py-1 text-xs text-ink " +
  "placeholder:text-ink/30 focus:border-primary focus:outline-none";
const SCENARIOS = [
  {
    value: "steady",
    label: "Carga constante",
    icon: "—",
    summary: "Mantém o mesmo volume durante os 60 segundos.",
    impact:
      "Aplica o multiplicador Traffic nos seis intervalos. É a referência para identificar limitações permanentes e comparar mudanças no diagrama.",
  },
  {
    value: "spike",
    label: "Pico repentino",
    icon: "↑",
    summary: "Base por 20s, pico por 20s e retorno à base.",
    impact:
      "Concentra o multiplicador nos dois intervalos centrais. Expõe erros durante rajadas e mostra se o autoscaling reage tarde demais.",
  },
  {
    value: "ramp",
    label: "Rampa de carga",
    icon: "↗",
    summary: "Aumenta gradualmente de 1× até o multiplicador.",
    impact:
      "Eleva a carga a cada intervalo. Ajuda a localizar quando cada componente sai da faixa segura e como a escala acompanha o crescimento.",
  },
  {
    value: "hot_partition",
    label: "Partição quente",
    icon: "◇",
    summary: "Concentra pressão nos stores particionados.",
    impact:
      "Mantém o tráfego configurado, mas reduz para 40% a capacidade útil de NoSQL, Object Store, Vector DB e outros stores particionados.",
  },
  {
    value: "cold_cache",
    label: "Cache frio",
    icon: "❄",
    summary: "Começa sem hits e aquece depois de 20 segundos.",
    impact:
      "Força cache hit a 0% nos dois primeiros intervalos e depois restaura o valor configurado. Mostra a pressão inicial no storage e a recuperação.",
  },
  {
    value: "prompt_attack",
    label: "Ataque de prompt",
    icon: "!",
    summary: "Mistura tráfego legítimo com ataques single-turn e multi-turn.",
    impact:
      "Injeta 20% de ataques evidentes na interação atual e 10% distribuídos no histórico recente. Torna visível onde cada guardrail bloqueia, o que ainda chega ao LLM e quando a saturação bloqueia tráfego que não pôde ser inspecionado.",
  },
] as const;

const PRIMARY_CONTROLS = [
  {
    label: "Simular",
    initial: "Ação",
    description:
      "Executa uma nova janela usando o estado que está visível no canvas, mesmo que o autosave ainda não tenha terminado. Não altera o diagrama.",
  },
  {
    label: "Traffic",
    initial: "1×",
    description:
      "Multiplica o RPS base. Em Carga constante vale por toda a janela; em Pico e Rampa representa o maior volume alcançado.",
  },
  {
    label: "Reads vs writes",
    initial: "80% / 20%",
    description:
      "Define a mistura de operações. Escritas custam mais em stores stateful e particionados; com cache, leituras e escritas também percorrem caminhos diferentes.",
  },
  {
    label: "Cenário",
    initial: "Carga constante",
    description:
      "Determina como carga, cache ou capacidade mudam durante os 60 segundos. Ele muda as condições do experimento, não a estrutura do diagrama.",
  },
  {
    label: "+ Mais opções",
    initial: "Recolhido",
    description:
      "Expande a própria barra para revelar os parâmetros adicionais. O botão só organiza a interface e não interfere no cálculo.",
  },
] as const;

const ADVANCED_CONTROLS = [
  {
    label: "Perfil de Capacidade",
    initial: "Balanceado · 1×",
    description:
      "Aplica uma margem global à capacidade de todos os nós limitados: Conservador 0,65×, Balanceado 1× e Otimista 1,5×. Representa diferenças de hardware, runtime e tuning.",
  },
  {
    label: "RPS base",
    initial: "100 RPS",
    description:
      "É a carga inicial gerada pelos Clients. Quando existem vários Clients de entrada, o motor divide esse total entre eles antes de propagar o fluxo.",
  },
  {
    label: "Cache hit",
    initial: "80%",
    description:
      "Define a fração das leituras atendida pelo cache nos caminhos cache_lookup. Os misses continuam para o armazenamento; no cenário Cache frio, o valor é 0% nos primeiros 20 segundos.",
  },
  {
    label: "p99 alvo",
    initial: "250 ms",
    description:
      "É um critério de avaliação. Não muda capacidade nem latência calculada; compara o pior p99 da janela, destaca violações no HUD e orienta os avisos.",
  },
  {
    label: "Disponibilidade alvo",
    initial: "99,9%",
    description:
      "Também é um critério, não uma causa de falha. Compara a disponibilidade resultante com o objetivo informado e sinaliza quando a arquitetura fica abaixo dele.",
  },
] as const;

/** Barra flutuante de simulação no topo do canvas (referência: System Design
 *  Playground). O botão + expande o mesmo contêiner para mostrar os parâmetros extras. */
export function SimulationBar({ diagramId }: { diagramId: string }) {
  const setSim = useCanvas((s) => s.setSim);
  const params = useCanvas((s) => s.simParams);
  const setParams = useCanvas((s) => s.setSimParams);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const scenarioMenuRef = useRef<HTMLDivElement>(null);
  const currentScenario =
    SCENARIOS.find((scenario) => scenario.value === params.scenario) ?? SCENARIOS[0];

  const run = useMutation({
    mutationFn: () =>
      runSimulation(
        diagramId,
        params,
        serializeCanvas(), // o que está na tela, não o que o autosave persistiu
      ),
    onSuccess: (result: SimResult) => setSim(result),
  });

  // re-simulação automática: depois da 1ª rodada, mudanças no canvas re-rodam
  const rev = useCanvas((s) => s.rev);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (rev === 0 || !useCanvas.getState().sim) return;
    const t = setTimeout(() => runRef.current.mutate(), 600);
    return () => clearTimeout(t);
  }, [rev]);

  useEffect(() => {
    if (!scenarioOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!scenarioMenuRef.current?.contains(event.target as Node)) setScenarioOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setScenarioOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [scenarioOpen]);

  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 select-none">
      <div className="overflow-visible rounded-xl border border-white/10 bg-panel/95 shadow-xl">
        <div className="flex items-center gap-5 px-4 py-2">
        <button
          onClick={() => {
            setScenarioOpen(false);
            run.mutate();
          }}
          disabled={run.isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-sm
                     font-medium text-white hover:bg-primary/80 disabled:opacity-50"
        >
          <span className="text-[10px]">▶</span>
          {run.isPending ? "Simulando…" : "Simular"}
        </button>

        <div className="w-40">
          <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
            <span className={tinyLabel}>Traffic</span>
            <span className="font-mono text-[10px] text-ink/70">
              ×{params.traffic_multiplier.toFixed(1)} · {Math.round(params.base_rps * params.traffic_multiplier)} rps
              {params.scenario === "spike" || params.scenario === "ramp" ? " pico" : ""}
            </span>
          </div>
          <input type="range" min={0.5} max={10} step={0.5} value={params.traffic_multiplier}
            onChange={(e) => setParams({ traffic_multiplier: Number(e.target.value) })}
            className="w-full accent-[#E8622C]" />
        </div>

        <div className="w-44">
          <div className="flex items-baseline justify-between">
            <span className={tinyLabel}>Reads vs writes</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={params.read_ratio}
            onChange={(e) => setParams({ read_ratio: Number(e.target.value) })}
            className="w-full accent-[#E8622C]" />
          <div className="font-mono text-[9px] leading-none text-ink/45">
            {readLabel(params.read_ratio)}
          </div>
        </div>

        <div ref={scenarioMenuRef} className="relative w-48">
          <button
            type="button"
            onClick={() => {
              setAdvancedOpen(false);
              setScenarioOpen((open) => !open);
            }}
            aria-haspopup="listbox"
            aria-expanded={scenarioOpen}
            className={`flex h-7 w-full items-center gap-2 rounded-md border bg-card px-2.5
                        text-left text-xs transition ${
                          scenarioOpen
                            ? "border-primary text-ink"
                            : "border-white/10 text-ink/75 hover:border-primary/50"
                        }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
              Cenário
            </span>
            <span className="text-ink/20">·</span>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10
                             font-mono text-[10px] text-primary">
              {currentScenario.icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{currentScenario.label}</span>
            <span className="text-[9px] text-ink/35">▾</span>
          </button>
          {scenarioOpen && (
            <div
              role="listbox"
              aria-label="Selecionar cenário de simulação"
              className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl
                         border border-white/10 bg-panel p-1.5 shadow-2xl"
            >
              <div className="border-b border-white/10 px-2.5 pb-2 pt-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
                  Cenário de 60 segundos
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-ink/40">
                  Escolha como a carga ou o estado muda ao longo da janela.
                </p>
              </div>
              <div className="mt-1 space-y-0.5">
                {SCENARIOS.map((scenario) => {
                  const selected = scenario.value === params.scenario;
                  return (
                    <button
                      key={scenario.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setParams({ scenario: scenario.value });
                        setScenarioOpen(false);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left
                                  transition ${
                                    selected
                                      ? "bg-primary/10 text-ink"
                                      : "text-ink/65 hover:bg-white/5 hover:text-ink"
                                  }`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                                       rounded font-mono text-[10px] ${
                                         selected
                                           ? "bg-primary/20 text-primary"
                                           : "bg-white/5 text-ink/45"
                                       }`}>
                        {scenario.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs font-medium">
                          {scenario.label}
                          {selected && <span className="text-primary">✓</span>}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-ink/40">
                          {scenario.summary}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setScenarioOpen(false);
            setAdvancedOpen((open) => !open);
          }}
          aria-controls="simulation-extra-controls"
          aria-expanded={advancedOpen}
          aria-label={advancedOpen ? "Recolher opções do simulador" : "Mostrar mais opções do simulador"}
          title={advancedOpen ? "recolher opções" : "mais opções do simulador"}
          className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono
                      text-lg leading-none transition ${
                        advancedOpen
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 text-ink/55 hover:border-primary/50 hover:text-ink"
                      }`}
        >
          {advancedOpen ? "−" : "+"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdvancedOpen(false);
            setScenarioOpen(false);
            setInfoOpen(true);
          }}
          aria-label="Como funciona o simulador"
          title="como funciona o simulador"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/60
                     bg-primary/10 font-display text-xs font-semibold text-primary shadow-sm
                     shadow-primary/20 transition hover:border-primary hover:bg-primary/20"
        >
          i
        </button>
      </div>
      {advancedOpen && (
        <div
          id="simulation-extra-controls"
          className="grid grid-cols-[11rem_6rem_10rem_7rem_8rem]
                     items-end gap-3 border-t border-white/10 px-4 py-2"
        >
          <div>
            <label className={tinyLabel} htmlFor="bar-capacity-profile">
              Perfil de capacidade
            </label>
            <select
              id="bar-capacity-profile"
              className={popField}
              value={params.capacity_profile}
              onChange={(e) => setParams({
                capacity_profile: e.target.value as typeof params.capacity_profile,
              })}
            >
              <option value="nominal">Balanceado · 1×</option>
              <option value="conservative">Conservador · 0,65×</option>
              <option value="optimistic">Otimista · 1,5×</option>
            </select>
          </div>
          <div>
            <label className={tinyLabel} htmlFor="bar-rps">RPS base</label>
            <input id="bar-rps" type="number" min={1} className={popField} value={params.base_rps}
              onChange={(e) => setParams({ base_rps: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div>
            <label className={tinyLabel}>
              Cache hit — {Math.round(params.cache_hit_rate * 100)}%
            </label>
            <input type="range" min={0} max={1} step={0.01} value={params.cache_hit_rate}
              onChange={(e) => setParams({ cache_hit_rate: Number(e.target.value) })}
              className="w-full accent-[#E8622C]" />
          </div>
          <div>
            <label className={tinyLabel} htmlFor="bar-p99">p99 alvo (ms)</label>
            <input id="bar-p99" type="number" min={1} className={popField}
              value={params.p99_target_ms ?? ""}
              onChange={(e) => setParams({
                p99_target_ms: e.target.value ? Number(e.target.value) : null,
              })}
              onBlur={(e) => {
                const value = Number(e.currentTarget.value);
                setParams({
                  p99_target_ms: Number.isFinite(value) && value > 0
                    ? Math.round(value)
                    : DEFAULT_SIM_PARAMS.p99_target_ms,
                });
              }} />
          </div>
          <div>
            <label className={tinyLabel} htmlFor="bar-avail">Disponib. alvo (%)</label>
            <input id="bar-avail" type="number" min={90} max={100} step={0.01}
              className={popField}
              value={params.availability_target_pct ?? ""}
              onChange={(e) => setParams({
                availability_target_pct: e.target.value ? Number(e.target.value) : null,
              })}
              onBlur={(e) => {
                const value = Number(e.currentTarget.value);
                setParams({
                  availability_target_pct: Number.isFinite(value) && value >= 90
                    ? Math.min(100, value)
                    : DEFAULT_SIM_PARAMS.availability_target_pct,
                });
              }} />
          </div>
        </div>
      )}
        </div>
      {run.isError && (
        <p className="mt-1 text-center text-xs text-red-400">{String(run.error)}</p>
      )}
      {infoOpen && (
        <InfoDialog
          eyebrow="Simulador determinístico"
          title="Entenda o simulador e seus controles"
          onClose={() => setInfoOpen(false)}
        >
          <section>
            <h3 className="font-medium text-ink">O que é e para que serve</h3>
            <p className="mt-1">
              O simulador é um motor determinístico de hipóteses para System Design. Ele combina a
              topologia do canvas, os intents das conexões, a capacidade configurada nos nós e os
              controles da barra para estimar como uma carga se comportaria durante 60 segundos.
              A mesma entrada sempre produz o mesmo resultado, permitindo comparar duas versões da
              arquitetura sem ruído aleatório.
            </p>
            <p className="mt-2">
              A proposta não é prever exatamente uma infraestrutura real. Ele ajuda a encontrar
              gargalos prováveis, observar propagação de carga, testar escala, cache, filas e
              incidentes e verificar se p99 e disponibilidade atendem aos objetivos informados.
              Não é benchmark, cálculo de custo nem garantia de SLA de um provedor.
            </p>
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2
                            font-mono text-[11px] text-ink/70">
              canvas + propriedades dos nós + controles + cenário → 6 intervalos de 10s → nós + HUD + timeline
            </div>
          </section>

          <section>
            <h3 className="font-medium text-ink">1. Controles sempre visíveis</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PRIMARY_CONTROLS.map((control) => (
                <div key={control.label} className="rounded-lg border border-white/10 bg-card/50 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="text-xs font-medium text-ink">{control.label}</h4>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary/75">
                      {control.initial}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink/55">{control.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-medium text-ink">2. Controles revelados pelo botão +</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ADVANCED_CONTROLS.map((control) => (
                <div key={control.label} className="rounded-lg border border-white/10 bg-card/50 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="text-xs font-medium text-ink">{control.label}</h4>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary/75">
                      {control.initial}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink/55">{control.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-medium text-ink">3. Como o diagrama participa do cálculo</h3>
            <p className="mt-1">
              O tipo de cada nó fornece uma calibração de referência e um comportamento: compute,
              store stateful, store particionado, memória, buffer, serviço com quota ou um perfil
              próprio de inferência de ML. Nas propriedades do componente, Porte multiplica a
              capacidade por 0,5×, 1× ou 2×;
              Unidades multiplica a capacidade disponível; e Escala define se essa quantidade fica
              fixa ou pode crescer após o atraso de reação do perfil.
            </p>
            <div className="mt-2 rounded-lg border border-white/10 bg-card/60 px-3 py-2 font-mono
                            text-[11px] text-ink/70">
              capacidade efetiva = calibração × porte × unidades × Perfil de Capacidade ÷ custo da operação
            </div>
            <p className="mt-2">
              As conexões dizem para onde a carga vai. <strong className="font-medium text-ink/80">request</strong> mantém
              o nó no caminho síncrono e no p99; <strong className="font-medium text-ink/80">cache_lookup</strong> aplica
              cache hit e encaminha misses; <strong className="font-medium text-ink/80">async_message</strong> encerra o
              caminho do usuário no aceite da fila e processa o worker fora desse p99; e
              <strong className="font-medium text-ink/80"> dead_letter</strong> envia à DLQ somente a fração que falhou.
              Comentários e sugestões de IA ainda não aplicadas não recebem tráfego.
            </p>
            <p className="mt-2">
              Uma conexão <strong className="font-medium text-ink/80">validation</strong> do
              orquestrador para um guardrail terminal representa uma chamada síncrona com retorno
              implícito. O guardrail decide bloquear ou liberar, mas não se torna o próximo dono do
              fluxo. Input Guardrails filtram antes das chamadas principais; Output Guardrails
              validam a resposta antes de o orquestrador devolvê-la ao cliente.
            </p>
            <p className="mt-2">
              Quando o mesmo serviço chama <strong className="font-medium text-ink/80">Feature
              Store</strong> com retrieval e <strong className="font-medium text-ink/80">Real-time
              Inference</strong> com ai_call, o motor interpreta uma composição sequencial: o serviço
              recebe as features, monta o request e chama a inferência. As duas arestas partem do
              orquestrador, mas as duas latências participam do p99.
            </p>
            <p className="mt-2">
              Em ML, <strong className="font-medium text-ink/80">Real-time Inference</strong> participa
              normalmente de p99 e disponibilidade. <strong className="font-medium text-ink/80">Async
              Inference</strong> e <strong className="font-medium text-ink/80">Batch Inference</strong>
              aceitam trabalho fora do caminho online: excesso vira backlog em vez de erro de
              requisição. <strong className="font-medium text-ink/80">Serverless Inference</strong>
              escala mais rápido, mas a primeira janela inclui cold start. Registry, treinamento e
              monitoramento são tratados como fluxos de controle ou observação e não aumentam o p99
              principal.
            </p>
            <p className="mt-2">
              Em IA generativa, <strong className="font-medium text-ink/80">Input Guardrail</strong>
              bloqueia antes do modelo e reduz suas chamadas; <strong className="font-medium text-ink/80">Output
              Guardrail</strong> avalia pergunta e resposta depois da geração, portanto não recupera o
              custo do LLM. Cada um pode usar três estratégias: <strong className="font-medium
              text-ink/80">Determinístico</strong> prioriza previsibilidade, alta capacidade e baixa
              latência; <strong className="font-medium text-ink/80">Probabilístico</strong> amplia a
              cobertura, mas admite falsos positivos e negativos; <strong className="font-medium
              text-ink/80">Generativo</strong> considera mais nuances, com menor capacidade e maior
              latência. O simulador representa essas diferenças sem vincular o componente a uma
              tecnologia ou infraestrutura específica.
            </p>
            <p className="mt-2">
              O escopo Interação atual considera apenas o turno em curso; Histórico recente também
              alcança tentativas multi-turn e aumenta o trabalho e a latência da estratégia escolhida.
              Guardrails operam sempre em fail closed: na saturação, bloqueiam inclusive tráfego
              legítimo que não pôde ser inspecionado. Bloquear um ataque detectado é uma decisão de
              segurança; bloquear tráfego legítimo por falta de capacidade afeta a disponibilidade.
            </p>
          </section>

          <section>
            <h3 className="font-medium text-ink">4. Como cada cenário altera a janela</h3>
            <p className="mt-1">
              Cada execução é dividida em seis intervalos de 10 segundos. Isso permite mostrar um
              problema temporário sem escondê-lo em uma média:
            </p>
            <div className="mt-3 space-y-2">
              {SCENARIOS.map((scenario) => (
                <div
                  key={scenario.value}
                  className="flex gap-3 rounded-lg border border-white/10 bg-card/50 px-3 py-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                                   bg-primary/10 font-mono text-xs text-primary">
                    {scenario.icon}
                  </span>
                  <div>
                    <h4 className="text-xs font-medium text-ink">{scenario.label}</h4>
                    <p className="mt-0.5 text-xs leading-5 text-ink/55">{scenario.impact}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/50">
              Escala elástica só reage depois do atraso do perfil. Por isso, mesmo quando o nó se
              recupera, o HUD mantém o pior p99 e erro da janela e a timeline mostra quando ocorreram.
            </p>
          </section>

          <section>
            <h3 className="font-medium text-ink">5. Saturação, filas e falhas</h3>
            <p className="mt-1">
              Para cada intervalo, o motor compara trabalho recebido e capacidade efetiva. Acima de
              70% o nó fica Hot e a latência começa a degradar; acima de 100% há throttling e o
              excedente pode virar erro. Uma fila entrega apenas o que seus consumidores conseguem
              processar e conserva o restante como backlog, sem transformar mensagens enfileiradas
              em erro artificial no worker. Endpoints assíncronos e jobs em lote seguem a mesma
              ideia, mas drenam o trabalho pela própria capacidade. A DLQ e seu worker recebem apenas
              falhas, não uma cópia do fluxo principal.
            </p>
          </section>

          <section>
            <h3 className="font-medium text-ink">6. O que a simulação devolve</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong className="font-medium text-ink/80">Nos nós:</strong> RPS recebido, capacidade, utilização de pico, saúde, backlog e unidades ativas.</li>
              <li><strong className="font-medium text-ink/80">No HUD:</strong> pico de RPS, pior p99, erro, disponibilidade, gargalo e comparação com os alvos.</li>
              <li><strong className="font-medium text-ink/80">Na timeline:</strong> o estado de cada intervalo e se escala, cache ou redução de carga produziram recuperação.</li>
              <li><strong className="font-medium text-ink/80">Nos avisos:</strong> hipóteses de melhoria ligadas aos componentes realmente pressionados.</li>
            </ul>
          </section>

          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-ink/60">
            Use o simulador para formular hipóteses e comparar mudanças no mesmo cenário. Antes de
            produção, valide as premissas com métricas, testes de carga e limites do serviço escolhido.
          </p>
        </InfoDialog>
      )}
    </div>
  );
}
