/** Tutorial progressivo: constrói o caminho mínimo, mede um problema real,
 * aplica um paliativo e só então introduz os padrões de cache, fila e DLQ. */

export type Condition =
  | { kind: "node_added"; archetype: string }
  | { kind: "node_replicas"; archetype: string; min: number }
  | { kind: "edge_intent"; intent: string; count: number }
  | { kind: "annotation_added" }
  | { kind: "context_filled" }
  | { kind: "simulation_ran" }
  | { kind: "simulation_total_rps"; value: number }
  | {
      kind: "simulation_setup";
      baseRps: number;
      multiplier: number;
      readRatio: number;
      cacheHitRate: number;
      p99Target: number;
    }
  | { kind: "simulation_bottleneck"; archetype: string }
  | { kind: "simulation_node_active"; archetype: string }
  | { kind: "simulation_no_errors" }
  | { kind: "architect_prompt"; prompt: string }
  | { kind: "diff_applied" }
  | { kind: "judge_completed" }
  | { kind: "export_previewed" };

export interface TutorialStep {
  id: string;
  kind: "info" | "action";
  title: string;
  body: string;
  done_when?: Condition[];
  suggested_prompt?: string;
}

export const CACHE_PROMPT = "Como reduzo a carga de leitura no banco?";
export const FANOUT_PROMPT = "Como escalo a escrita de tweets para milhões de seguidores?";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    kind: "info",
    title: "Comece pelo caminho mais simples",
    body:
      "Vamos construir uma home timeline sem antecipar soluções. Primeiro ela precisa apenas permitir postar tweets e ler, em ordem cronológica, os tweets das pessoas seguidas.\n\n" +
      "Depois vamos aumentar a carga, observar o que realmente quebra e evoluir o desenho a partir das medições.",
  },
  {
    id: "add-client",
    kind: "action",
    title: "Adicione quem faz a requisição",
    body: "Na palette à esquerda, clique em ‘+ Client (Web)’. Ele representa quem abre a timeline ou publica um tweet.",
    done_when: [{ kind: "node_added", archetype: "client" }],
  },
  {
    id: "add-app",
    kind: "action",
    title: "Adicione a aplicação",
    body: "Adicione um App Server. Ele recebe as requisições e monta a resposta da timeline. Você pode renomeá-lo para ‘Timeline API’ pelo botão ✎.",
    done_when: [{ kind: "node_added", archetype: "app-server" }],
  },
  {
    id: "add-db",
    kind: "action",
    title: "Adicione o armazenamento",
    body: "Adicione um NoSQL DB para guardar tweets e timelines. Por enquanto ele é apenas o armazenamento do caminho mínimo; ainda não estamos escolhendo sharding ou antecipando gargalos.",
    done_when: [{ kind: "node_added", archetype: "nosql-db" }],
  },
  {
    id: "connect-base",
    kind: "action",
    title: "Feche o primeiro caminho",
    body: "Conecte Client → Timeline API e Timeline API → NoSQL DB. Escolha o intent ‘request’ nas duas conexões.",
    done_when: [{ kind: "edge_intent", intent: "request", count: 2 }],
  },
  {
    id: "context",
    kind: "action",
    title: "Agora descreva o cenário de crescimento",
    body:
      "Clique em ‘Contexto’ no topo e registre o problema. Você pode usar:\n\n" +
      "Descrição:\nHome timeline do Twitter/X para postar tweets e ler os tweets das pessoas seguidas, com crescimento até centenas de milhões de usuários e leitura dominante.\n\n" +
      "Requisitos (um por linha):\nPostar tweets de até 280 caracteres\nSeguir e deixar de seguir usuários\nCarregar a timeline em menos de 200 ms\n\n" +
      "Considerações:\nO feed pode aceitar consistência eventual, mas a publicação deve responder rapidamente nos picos.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "first-simulation",
    kind: "action",
    title: "Aumente a carga e meça",
    body:
      "Abra ⚙ na barra de simulação, defina RPS base = 3500, multiplicador = 1,0, cache hit = 80% e p99 alvo = 200 ms. Ajuste Reads vs writes para 90% de leitura e clique Start. Esse é um recorte controlado do tráfego, não os 300M de usuários lançados diretamente no motor.",
    done_when: [
      { kind: "simulation_ran" },
      {
        kind: "simulation_setup",
        baseRps: 3500,
        multiplier: 1,
        readRatio: 0.9,
        cacheHitRate: 0.8,
        p99Target: 200,
      },
      { kind: "simulation_total_rps", value: 3500 },
      { kind: "simulation_bottleneck", archetype: "app-server" },
    ],
  },
  {
    id: "app-problem",
    kind: "info",
    title: "A primeira limitação é a aplicação",
    body:
      "Observe o HUD e o nó em vermelho: com uma réplica, a Timeline API recebe 3500 RPS para uma capacidade de 1500. Ela é o maior gargalo desta rodada. O NoSQL também está acima da capacidade e o p99 passa de 200 ms, mas resolver o banco primeiro esconderia a limitação anterior.",
  },
  {
    id: "scale-app",
    kind: "action",
    title: "Aplique um paliativo na API",
    body:
      "Use o botão + no App Server até chegar a 3 réplicas. Isso é escala horizontal da camada stateless. A simulação roda novamente e mostra onde a pressão foi parar.",
    done_when: [
      { kind: "node_replicas", archetype: "app-server", min: 3 },
      { kind: "simulation_bottleneck", archetype: "nosql-db" },
    ],
  },
  {
    id: "db-problem",
    kind: "info",
    title: "O gargalo se moveu para o banco",
    body:
      "Agora a API está abaixo da capacidade, mas o NoSQL recebe as 3500 operações por segundo e suporta 2000. No modelo atual, o p99 fica em torno de 205 ms — pouco acima do alvo — e o nó mostra erros de saturação. A medição, e não uma suposição, revelou o próximo problema.",
  },
  {
    id: "ask-cache",
    kind: "action",
    title: "Peça uma solução para o caminho de leitura",
    body: "Envie a pergunta sugerida. O Arquiteto recebe o contexto, o canvas e a última simulação, por isso consegue propor uma mudança ligada ao gargalo observado.",
    suggested_prompt: CACHE_PROMPT,
    done_when: [{ kind: "architect_prompt", prompt: CACHE_PROMPT }],
  },
  {
    id: "apply-cache",
    kind: "action",
    title: "Aplique o cache sugerido",
    body: "A sugestão aparece tracejada no canvas. Clique em Apply no card do Ask AI para adicionar o Cache ligado por ‘cache_lookup’.",
    done_when: [
      { kind: "node_added", archetype: "cache" },
      { kind: "edge_intent", intent: "cache_lookup", count: 1 },
    ],
  },
  {
    id: "validate-cache",
    kind: "action",
    title: "Valide a solução na simulação",
    body:
      "Com 80% de cache hit, leituras atingem o cache e somente misses mais escritas chegam ao NoSQL. Aguarde a re-simulação automática: os componentes devem ficar sem erros e o p99 abaixo de 200 ms.",
    done_when: [{ kind: "simulation_no_errors" }],
  },
  {
    id: "write-problem",
    kind: "info",
    title: "A leitura melhorou; falta modelar a escrita",
    body:
      "O cache resolveu a repetição de leituras, mas um tweet de uma conta com milhões de seguidores não pode atualizar todas as timelines dentro da requisição. Fazer esse fan-out de modo síncrono ligaria a latência do usuário ao número de seguidores.",
  },
  {
    id: "ask-fanout",
    kind: "action",
    title: "Peça uma solução para o fan-out",
    body: "Envie a segunda pergunta sugerida para tirar o trabalho pesado do caminho síncrono.",
    suggested_prompt: FANOUT_PROMPT,
    done_when: [{ kind: "architect_prompt", prompt: FANOUT_PROMPT }],
  },
  {
    id: "apply-fanout",
    kind: "action",
    title: "Aplique fila e worker",
    body:
      "Clique em Apply. A Timeline API publica somente os 10% de escritas na fila; o worker consome e materializa as timelines no NoSQL. Leituras não são duplicadas no caminho de escrita.",
    done_when: [
      { kind: "node_added", archetype: "message-queue" },
      { kind: "node_added", archetype: "worker" },
      { kind: "edge_intent", intent: "async_message", count: 2 },
    ],
  },
  {
    id: "fanout-result",
    kind: "info",
    title: "O trabalho pesado saiu da requisição",
    body:
      "No cenário de 3500 RPS e 90% de leitura, a fila e o worker principal recebem cerca de 350 operações por segundo, não 3500. O caminho síncrono termina na publicação da fila; a contrapartida é consistência eventual no feed.",
  },
  {
    id: "add-dlq",
    kind: "action",
    title: "Separe as falhas do fluxo principal",
    body: "Adicione ‘Dead Letter Queue’ em Messaging e ‘DLQ Worker’ em Compute. Eles existem para mensagens que falharam após tentativas, não para repetir a escala da fila principal.",
    done_when: [
      { kind: "node_added", archetype: "dead-letter-queue" },
      { kind: "node_added", archetype: "dlq-worker" },
    ],
  },
  {
    id: "connect-dlq",
    kind: "action",
    title: "Conecte somente o caminho de falha",
    body:
      "Conecte Fan-out worker → Dead Letter Queue com intent ‘dead_letter’. Depois conecte Dead Letter Queue → DLQ Worker com ‘async_message’. A re-simulação deve mostrar cerca de 1% do volume principal nesse ramo.",
    done_when: [
      { kind: "edge_intent", intent: "dead_letter", count: 1 },
      { kind: "edge_intent", intent: "async_message", count: 3 },
      { kind: "simulation_node_active", archetype: "dead-letter-queue" },
      { kind: "simulation_no_errors" },
    ],
  },
  {
    id: "annotate",
    kind: "action",
    title: "Registre os trade-offs",
    body:
      "Adicione um Balão de comentário e registre algo como: ‘cache exige política de invalidação; fan-out é eventual; DLQ recebe apenas falhas’. Use qualquer uma das quatro arestas do balão para ancorá-lo a um componente.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "judge",
    kind: "action",
    title: "Rode o Juiz",
    body: "Abra ‘AI Judge’ na borda direita e clique em ‘Rodar Juiz’. Os findings devem refletir o desenho final, a simulação e as regras do corpus.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Confira antes de gerar",
    body:
      "Clique em ‘Exportar’, revise as seções e escolha ‘Pré-visualizar pré-ADR’. A prévia não cria arquivo nem registro; a geração só acontece depois de uma confirmação explícita.",
    done_when: [{ kind: "export_previewed" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Diagrama concluído",
    body:
      "Você começou com o caminho mínimo, mediu dois gargalos na ordem em que apareceram, aplicou um paliativo, consultou a IA e validou cache, processamento assíncrono e DLQ com cargas coerentes. Sharding, réplicas do armazenamento e estratégias híbridas de fan-out são próximos experimentos — agora motivados por dados.",
  },
];
