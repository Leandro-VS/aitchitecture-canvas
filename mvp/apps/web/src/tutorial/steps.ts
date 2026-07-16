/** Roteiro declarativo do tutorial (M14/D14): home timeline do Twitter/X.
 *  Arco pedagógico: caminho quente de leitura primeiro (banco satura → cache
 *  resolve), depois a escrita com fan-out via fila (consistência eventual).
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

export const SUGGESTED_PROMPT = "Como escalo a escrita de tweets para milhões de seguidores?";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    kind: "info",
    title: "Feed do Twitter/X",
    body:
      "Vamos desenhar a home timeline e a postagem de tweets.\n\n" +
      "Requisitos:\n" +
      "    •  Postar tweets (até 280 caracteres)\n" +
      "    •  Seguir/deixar de seguir usuários\n" +
      "    •  Timeline mostra tweets dos seguidos, ordenados por tempo\n" +
      "    •  300M de usuários ativos por dia\n" +
      "    •  Timeline carregando em < 200ms",
  },
  {
    id: "add-client",
    kind: "action",
    title: "Adicione um Client",
    body: "Na palette à esquerda, clique em \"+ Client (Web)\" — são os usuários abrindo a timeline.",
    done_when: [{ kind: "node_added", archetype: "client" }],
  },
  {
    id: "add-app",
    kind: "action",
    title: "Adicione um App Server",
    body:
      "Na palette, clique em \"+ App Server\" — é o serviço que monta a home timeline e recebe os posts.\n\n" +
      "Dica (opcional): depois de adicionar, use o botão ✎ do componente para renomeá-lo para \"Timeline API\". O que conclui o passo é adicionar o componente, não o nome.",
    done_when: [{ kind: "node_added", archetype: "app-server" }],
  },
  {
    id: "add-db",
    kind: "action",
    title: "Adicione um NoSQL DB",
    body: "Tweets e timelines materializadas vivem aqui. NoSQL pela escala: 300M DAU pede sharding horizontal por user_id.",
    done_when: [{ kind: "node_added", archetype: "nosql-db" }],
  },
  {
    id: "connect",
    kind: "action",
    title: "Conecte o caminho de leitura",
    body: "Arraste do conector direito: Client → Timeline API e Timeline API → NoSQL DB, intent \"request\" nas duas.",
    done_when: [{ kind: "edge_intent", intent: "request", count: 2 }],
  },
  {
    id: "annotate",
    kind: "action",
    title: "Registre uma decisão",
    body: "Adicione um \"Balão de comentário\", escreva 'timelines shardadas por user_id; consistência eventual aceitável' e arraste do handle do balão até o NoSQL para ancorá-lo. Comentários viram restrições que as IAs respeitam.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "context",
    kind: "action",
    title: "Preencha o contexto",
    body:
      "Clique em \"Contexto\" no topo da tela. Sugestões para copiar:\n\n" +
      "Descrição:\n" +
      "    Home timeline do Twitter/X: postar tweets e ler a timeline dos seguidos, com 300M de usuários ativos por dia e leitura dominante.\n\n" +
      "Requisitos (um por linha):\n" +
      "    •  Postar tweets (até 280 caracteres)\n" +
      "    •  Seguir/deixar de seguir usuários\n" +
      "    •  Timeline carregando em < 200ms\n\n" +
      "Considerações:\n" +
      "    Leitura >> escrita; fan-out na escrita; consistência eventual aceitável no feed.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "simulate",
    kind: "action",
    title: "Simule o caminho de leitura",
    body: "Na barra do topo: abra o ⚙ e suba o RPS base para 2000 (recorte do tráfego real), deixe Reads vs writes em ~90% e clique Start.",
    done_when: [{ kind: "simulation_ran" }],
  },
  {
    id: "bottleneck",
    kind: "info",
    title: "O banco saturou",
    body: "Ler a timeline direto do armazenamento sobrecarrega o NoSQL: todo refresh vira consulta no banco e o p99 estoura os 200ms. Esse é o hot read path — e banco não escala na velocidade de um cache.",
  },
  {
    id: "add-cache",
    kind: "action",
    title: "Adicione um cache de timelines",
    body: "Adicione um Cache e conecte Timeline API → Cache com intent \"cache_lookup\". Timelines recentes ficam em memória; o banco só vê os misses. A re-simulação automática mostra o alívio no HUD.",
    done_when: [
      { kind: "node_added", archetype: "cache" },
      { kind: "edge_intent", intent: "cache_lookup", count: 1 },
    ],
  },
  {
    id: "read-solved",
    kind: "info",
    title: "Leitura resolvida — e a escrita?",
    body: "Com hit alto no cache, o banco respira e o p99 volta ao alvo. Mas ainda há um problema escondido: quando alguém com milhões de seguidores posta, atualizar TODAS as timelines na hora do post (de forma síncrona) derrubaria o sistema.",
  },
  {
    id: "ask",
    kind: "action",
    title: "Pergunte ao Arquiteto",
    body: "Use o botão abaixo para enviar a pergunta sugerida ao Ask AI — ele vê seu canvas, o contexto e a última simulação.",
    suggested_prompt: SUGGESTED_PROMPT,
    done_when: [{ kind: "architect_replied" }],
  },
  {
    id: "apply",
    kind: "action",
    title: "Aplique o fan-out on write",
    body: "O Arquiteto propôs fila + worker como nós tracejados (sugestão). Clique em Apply no card do chat: o post publica na fila e retorna; o worker materializa as timelines de forma assíncrona.",
    done_when: [{ kind: "diff_applied" }],
  },
  {
    id: "fanout",
    kind: "info",
    title: "Fan-out on write",
    body: "Note no HUD: o caminho síncrono do usuário agora termina na fila (baratíssimo). O custo é consistência eventual — a timeline dos seguidores converge em segundos, aceitável para feed. É o mesmo trade-off do Twitter real.",
  },
  {
    id: "judge",
    kind: "action",
    title: "Rode o Juiz",
    body: "Abra a aba \"AI Judge\" (borda direita) e clique em \"Rodar Juiz\". Ele avalia contra os guidelines (cache em read-heavy, fan-out por filas…) citando doc + seção. Explore: clique num finding para destacar os nós, vote 👍/👎 e resolva.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Exporte o pré-ADR",
    body: "Clique em \"Exportar\" no topo, revise as seções editáveis e gere o Markdown com a imagem do diagrama — pronto para a discussão de arquitetura.",
    done_when: [{ kind: "export_done" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Pronto! 🎉",
    body: "Você desenhou o feed com hot read path + cache e fan-out on write via fila — passando por canvas, comentários, contexto, simulação, Ask AI, Juiz e export. Este diagrama é seu: continue evoluindo (sharding explícito? réplicas?) ou crie um novo.",
  },
];
