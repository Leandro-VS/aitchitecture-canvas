/** Roteiro declarativo do tutorial (M14/D14): encurtador de URL.
 *  Condições avaliadas contra o store do canvas + sinais dos componentes —
 *  nenhum passo dispara chamada real de LLM (todo o MVP é mock). */

export type Condition =
  | { kind: "node_added"; archetype: string }
  | { kind: "edge_intent"; intent: string; count: number }
  | { kind: "annotation_added" }
  | { kind: "context_filled" }
  | { kind: "simulation_ran" }
  | { kind: "architect_replied" }
  | { kind: "diff_applied" }
  | { kind: "judge_completed" }
  | { kind: "export_done" };

export interface TutorialStep {
  id: string;
  kind: "info" | "action";
  title: string;
  body: string;
  done_when?: Condition[];
  /** pergunta que o passo pode enviar ao Ask AI com um clique */
  suggested_prompt?: string;
}

export const SUGGESTED_PROMPT = "Como reduzo a carga de leitura no banco?";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    kind: "info",
    title: "Encurtador de URL",
    body: "Vamos montar juntos um sistema clássico e extremamente read-heavy (~10 leituras por escrita), passando por todas as funcionalidades: canvas, contexto, simulação, Ask AI, Juiz e export.",
  },
  {
    id: "add-client",
    kind: "action",
    title: "Adicione um Client",
    body: "Na palette à esquerda, clique em \"+ Client (Web)\" (ou arraste para o canvas).",
    done_when: [{ kind: "node_added", archetype: "client" }],
  },
  {
    id: "add-app",
    kind: "action",
    title: "Adicione um App Server",
    body: "É ele que resolve o short-code e devolve o redirect.",
    done_when: [{ kind: "node_added", archetype: "app-server" }],
  },
  {
    id: "add-db",
    kind: "action",
    title: "Adicione um SQL Database",
    body: "Guarda o mapeamento short-code → URL original.",
    done_when: [{ kind: "node_added", archetype: "sql-db" }],
  },
  {
    id: "connect",
    kind: "action",
    title: "Conecte o fluxo",
    body: "Arraste do conector direito de um nó até o próximo: Client → App Server e App Server → SQL Database. Escolha o intent \"request\" nas duas.",
    done_when: [{ kind: "edge_intent", intent: "request", count: 2 }],
  },
  {
    id: "annotate",
    kind: "action",
    title: "Deixe um comentário",
    body: "Adicione um \"Balão de comentário\" pela palette, escreva algo como 'mapeia short-code → URL' e (opcional) arraste do handle do balão até o banco para ancorá-lo. Comentários alimentam as IAs e o pré-ADR.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "context",
    kind: "action",
    title: "Preencha o contexto",
    body: "Abra a aba \"Contexto\" na borda esquerda. Sugestão — descrição: 'Encurtador de URLs interno com redirecionamento de baixa latência para campanhas de marketing.'; requisitos: 'Encurtar URL' e 'Redirecionar via short-code'; considerações: 'Sistema read-heavy, ~10 leituras por escrita.'. O contexto é obrigatório para os recursos de IA.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "simulate",
    kind: "action",
    title: "Rode o simulador",
    body: "Na barra do topo, suba o Traffic para ×5 e clique Start.",
    done_when: [{ kind: "simulation_ran" }],
  },
  {
    id: "bottleneck",
    kind: "info",
    title: "Viu o vermelho?",
    body: "Cada redirecionamento consulta o banco — com a razão 10:1 de leituras, ele satura primeiro (capacidade base de 300 rps). O HUD embaixo mostra o gargalo e o p99 estourando.",
  },
  {
    id: "ask",
    kind: "action",
    title: "Pergunte ao Arquiteto",
    body: "Use o botão abaixo para enviar a pergunta sugerida ao Ask AI — ele vê seu canvas, o contexto e a simulação.",
    suggested_prompt: SUGGESTED_PROMPT,
    done_when: [{ kind: "architect_replied" }],
  },
  {
    id: "apply",
    kind: "action",
    title: "Aplique a sugestão",
    body: "O Arquiteto propôs um Cache como nós tracejados (sugestão). Clique em Apply no card do chat — a simulação re-roda sozinha e você vê o banco aliviar.",
    done_when: [{ kind: "diff_applied" }],
  },
  {
    id: "gain",
    kind: "info",
    title: "Compare o antes e depois",
    body: "Com o cache absorvendo as leituras (cache_lookup), a CPU do banco despenca e o p99 melhora — o HUD já reflete a re-simulação automática.",
  },
  {
    id: "judge",
    kind: "action",
    title: "Rode o Juiz",
    body: "Abra a aba \"AI Judge\" na borda direita e clique em \"Rodar Juiz\". Explore os findings: cite, vote 👍/👎 e marque como resolvido.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Exporte o pré-ADR",
    body: "Clique em \"Exportar\" no topo, revise as seções editáveis e gere o Markdown com a imagem do diagrama.",
    done_when: [{ kind: "export_done" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Pronto! 🎉",
    body: "Você passou por canvas, comentários, contexto, simulação, Ask AI com diff, Juiz e export — o ciclo completo da ferramenta. Este diagrama é seu: continue evoluindo ou crie um novo do zero (ou com IA).",
  },
];
