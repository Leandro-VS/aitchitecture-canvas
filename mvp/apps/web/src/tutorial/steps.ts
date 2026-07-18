/** Tutorial da ferramenta: o caso de timeline fornece dados para exercitar o
 * canvas, mas cada etapa apresenta uma operação ou leitura do AIrchitecture. */

import type { NodeMetrics, SimParams } from "../api/client";

export type Condition =
  | { kind: "node_added"; archetype: string; count?: number }
  | { kind: "node_replicas"; archetype: string; min: number }
  | {
      kind: "node_config";
      archetype: string;
      fields: Record<string, string | number>;
      count?: number;
    }
  | { kind: "edge_intent"; intent: string; count: number }
  | {
      kind: "edge_between";
      sourceArchetype: string;
      targetArchetype: string;
      intent: string;
    }
  | { kind: "edge_absent"; sourceArchetype: string; targetArchetype: string }
  | { kind: "annotation_added" }
  | { kind: "context_filled" }
  | { kind: "context_description_saved" }
  | { kind: "simulation_ran" }
  | { kind: "simulation_scenario"; scenario: SimParams["scenario"] }
  | {
      kind: "simulation_setup";
      baseRps: number;
      multiplier: number;
      readRatio: number;
      cacheHitRate: number;
      p99Target: number;
      scenario: SimParams["scenario"];
      capacityProfile: SimParams["capacity_profile"];
    }
  | { kind: "simulation_bottleneck"; archetype: string }
  | { kind: "simulation_node_active"; archetype: string }
  | { kind: "simulation_no_errors" }
  | {
      kind: "simulation_node_metric";
      archetype: string;
      metric: keyof Pick<
        NodeMetrics,
        "attack_rps" | "blocked_rps" | "uninspected_rps" | "backlog_messages" | "cpu"
      >;
      operator: "gt" | "gte" | "lt" | "lte";
      value: number;
      nodeData?: Record<string, string | number>;
    }
  | { kind: "simulation_p99"; operator: "gt" | "lte"; value: number }
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
    id: "problem-briefing",
    kind: "info",
    title: "O problema proposto",
    body:
      "CENÁRIO DE DEMONSTRAÇÃO\n" +
      "Uma home timeline permite publicar tweets e ler, em ordem cronológica, as publicações das pessoas seguidas. O tráfego cresceu e a equipe precisa revisar o caminho de leitura e de escrita.",
  },
  {
    id: "requirements-briefing",
    kind: "info",
    title: "Confira os critérios que a ferramenta vai medir",
    body:
      "FUNCIONAIS\n" +
      "• Publicar tweets de até 280 caracteres.\n" +
      "• Seguir e deixar de seguir usuários.\n" +
      "• Exibir os tweets das pessoas seguidas em ordem cronológica.\n\n" +
      "NÃO FUNCIONAIS\n" +
      "• Avaliar 3.500 RPS, com 90% de leituras.\n" +
      "• Manter p99 abaixo de 200 ms.\n" +
      "• Responder à publicação rapidamente durante picos.\n" +
      "• Aceitar consistência eventual no feed sem perder publicações.\n\n" +
      "Esses dados serão registrados no Contexto e nos controles do simulador; não precisam virar texto dentro dos componentes.",
  },
  {
    id: "add-client",
    kind: "action",
    title: "Use a palette para adicionar a origem",
    body:
      "Na palette Componentes, clique em ‘+ Client (Web)’ ou arraste-o para o canvas. Clique adiciona no centro; arrastar permite escolher a posição.",
    done_when: [{ kind: "node_added", archetype: "client" }],
  },
  {
    id: "add-app",
    kind: "action",
    title: "Adicione um componente de processamento",
    body:
      "Adicione um App Server. O botão ✎ abre suas propriedades: nome e subtítulo descrevem o papel; porte, escala e unidades alimentam o simulador. Renomear é opcional.",
    done_when: [{ kind: "node_added", archetype: "app-server" }],
  },
  {
    id: "add-db",
    kind: "action",
    title: "Complete o caminho mínimo com armazenamento",
    body:
      "Adicione um NoSQL DB. Neste momento ele representa apenas o armazenamento necessário para tornar o fluxo simulável.",
    done_when: [{ kind: "node_added", archetype: "nosql-db" }],
  },
  {
    id: "connect-base",
    kind: "action",
    title: "Conecte os nós e declare a intenção",
    body:
      "Arraste entre os handles para criar Client → App Server e App Server → NoSQL DB. No seletor de cada conexão, escolha ‘request’. O intent define como o motor propaga a carga; ele não é apenas um rótulo visual.",
    done_when: [{ kind: "edge_intent", intent: "request", count: 2 }],
  },
  {
    id: "context",
    kind: "action",
    title: "Preencha o Contexto que acompanha o diagrama",
    body:
      "Abra ‘Contexto’ na borda esquerda. Os campos podem ser salvos parcialmente e serão usados pelo Ask AIrchitect, pelo Juiz e pelo pré-ADR. Para este exercício, registre:\n\n" +
      "Descrição:\nHome timeline para publicar tweets e ler as publicações das pessoas seguidas.\n\n" +
      "Requisitos (um por linha):\nPublicar tweets de até 280 caracteres\nSeguir e deixar de seguir usuários\nCarregar a timeline com p99 abaixo de 200 ms\n\n" +
      "Considerações:\nO feed aceita consistência eventual, mas a publicação deve responder rapidamente.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "first-simulation",
    kind: "action",
    title: "Configure uma referência e execute a primeira janela",
    body:
      "Na barra de simulação, selecione ‘Carga constante’, mantenha Traffic = 1× e clique em + para expandir a própria barra. Em Perfil de Capacidade, escolha ‘Balanceado’; defina RPS base = 3500, cache hit = 80% e p99 alvo = 200 ms. Ajuste Reads vs writes para 90% de leitura e clique ‘Simular’. A ferramenta avaliará uma janela determinística de 60 segundos.",
    done_when: [
      { kind: "simulation_ran" },
      {
        kind: "simulation_setup",
        baseRps: 3500,
        multiplier: 1,
        readRatio: 0.9,
        cacheHitRate: 0.8,
        p99Target: 200,
        scenario: "steady",
        capacityProfile: "nominal",
      },
    ],
  },
  {
    id: "read-first-result",
    kind: "info",
    title: "Leia o resultado em três níveis",
    body:
      "1. O HUD resume pico de RPS, p99, erros, disponibilidade e gargalo.\n" +
      "2. A linha do tempo mostra se o problema ocupou toda a janela ou apenas alguns intervalos.\n" +
      "3. Cada nó mostra RPS recebido, utilização de pico e estado.\n\n" +
      "Nesta rodada, o App Server médio, fixo e com uma unidade é o maior gargalo. O NoSQL também satura e o p99 ultrapassa o alvo. A capacidade exibida já considera o Perfil de Capacidade Balanceado e a mistura de leitura/escrita.",
  },
  {
    id: "scale-app",
    kind: "action",
    title: "Distribua a carga e escale a aplicação",
    body:
      "Antes de criar mais unidades, represente como a carga será distribuída. Adicione um Load Balancer pela palette. Selecione a conexão Client → App Server e pressione Delete; depois conecte Client → Load Balancer e Load Balancer → App Server usando o intent ‘request’. Por fim, abra ✎ no App Server, mantenha Porte = Medium e Escala = Fixa e defina 3 unidades. A simulação roda novamente e o gargalo deve se mover para o NoSQL DB.",
    done_when: [
      { kind: "node_added", archetype: "load-balancer" },
      {
        kind: "edge_between",
        sourceArchetype: "client",
        targetArchetype: "load-balancer",
        intent: "request",
      },
      {
        kind: "edge_between",
        sourceArchetype: "load-balancer",
        targetArchetype: "app-server",
        intent: "request",
      },
      { kind: "edge_absent", sourceArchetype: "client", targetArchetype: "app-server" },
      { kind: "node_replicas", archetype: "app-server", min: 3 },
      { kind: "simulation_bottleneck", archetype: "nosql-db" },
    ],
  },
  {
    id: "read-second-result",
    kind: "info",
    title: "Compare o novo resultado, não apenas a cor",
    body:
      "O Load Balancer permanece saudável e torna explícita a distribuição entre as unidades do App Server. A aplicação agora possui mais capacidade efetiva, mas o HUD aponta o NoSQL porque ele continua recebendo todas as operações; seu nó mostra utilização acima de 100%, throttling e p99 acima do alvo. Essa comparação confirma que a mudança resolveu uma limitação e expôs a próxima.",
  },
  {
    id: "ask-cache",
    kind: "action",
    title: "Use o Ask AIrchitect sobre o gargalo observado",
    body:
      "Envie a pergunta sugerida. O Ask AIrchitect recebe Contexto, canvas e última simulação; a resposta pode, portanto, propor uma alteração ligada ao estado que você acabou de medir.",
    suggested_prompt: CACHE_PROMPT,
    done_when: [{ kind: "architect_prompt", prompt: CACHE_PROMPT }],
  },
  {
    id: "apply-cache",
    kind: "action",
    title: "Revise a proposta tracejada e aplique o diff",
    body:
      "A sugestão aparece tracejada antes de alterar o diagrama. No card do Ask AIrchitect, clique Apply para materializar o Cache e a conexão ‘cache_lookup’.",
    done_when: [
      { kind: "node_added", archetype: "cache" },
      { kind: "edge_intent", intent: "cache_lookup", count: 1 },
    ],
  },
  {
    id: "validate-cache",
    kind: "action",
    title: "Espere a simulação automática validar o diff",
    body:
      "Com cache hit de 80%, o motor envia leituras ao Cache e apenas misses mais escritas ao NoSQL. Confirme no HUD e nos nós que a rodada constante ficou sem erros e abaixo do alvo de p99.",
    done_when: [{ kind: "simulation_no_errors" }],
  },
  {
    id: "cold-cache-scenario",
    kind: "action",
    title: "Troque o cenário sem redesenhar a arquitetura",
    body:
      "No simulador, em Cenário, selecione agora ‘Cache frio’ e clique Simular. Os mesmos RPS e componentes serão avaliados, mas o cache começa vazio nos primeiros 20 segundos.",
    done_when: [{ kind: "simulation_scenario", scenario: "cold_cache" }],
  },
  {
    id: "read-timeline",
    kind: "info",
    title: "Use a linha do tempo para separar pico de estado permanente",
    body:
      "As primeiras barras ficam críticas enquanto as leituras ainda chegam ao armazenamento; depois, o cache aquecido reduz a pressão. O resultado global conserva o pior p99 e o pior erro da janela, enquanto cada barra mostra quando isso aconteceu. Esse é o motivo de uma simulação temporal não esconder a fase ruim na média.",
  },
  {
    id: "restore-baseline",
    kind: "action",
    title: "Restaure a referência antes de continuar",
    body:
      "Volte o cenário para ‘Carga constante’ e clique Simular. Comparar mudanças contra a mesma referência evita atribuir ao diagrama um efeito causado apenas pelo cenário.",
    done_when: [
      { kind: "simulation_scenario", scenario: "steady" },
      { kind: "simulation_no_errors" },
    ],
  },
  {
    id: "write-observation",
    kind: "info",
    title: "A publicação ainda possui um caminho crítico",
    body:
      "A leitura da timeline agora está protegida pelo cache, mas a publicação ainda tem outro problema. Se o App Server atualizar, dentro da requisição, a timeline de todos os seguidores, o tempo de resposta e a chance de falha passam a depender do número de seguidores do autor. Para retirar esse fan-out do caminho síncrono, o próximo experimento modelará a publicação com fila e processamento assíncrono.",
  },
  {
    id: "ask-fanout",
    kind: "action",
    title: "Solicite um segundo diff ao Ask AIrchitect",
    body:
      "Envie a pergunta sugerida para obter uma proposta que retire o processamento pesado do caminho síncrono.",
    suggested_prompt: FANOUT_PROMPT,
    done_when: [{ kind: "architect_prompt", prompt: FANOUT_PROMPT }],
  },
  {
    id: "apply-fanout",
    kind: "action",
    title: "Aplique e inspecione os intents assíncronos",
    body:
      "Clique Apply. A proposta adiciona Message Queue e Worker ligados por ‘async_message’. Como há cache no mesmo fan-out, o motor envia ao ramo assíncrono somente os 10% de escritas.",
    done_when: [
      { kind: "node_added", archetype: "message-queue" },
      { kind: "node_added", archetype: "worker" },
      { kind: "edge_intent", intent: "async_message", count: 2 },
    ],
  },
  {
    id: "inspect-queue",
    kind: "info",
    title: "Interprete fila e consumidor separadamente",
    body:
      "No cenário de referência, fila e worker recebem cerca de 350 operações/s. O caminho de p99 termina no aceite da fila; o worker fica fora da latência síncrona. Se o consumidor não acompanhar, a fila mostrará backlog e o worker ficará limitado à sua capacidade — o motor não transforma mensagens ainda enfileiradas em erros fictícios no worker.",
  },
  {
    id: "add-dlq",
    kind: "action",
    title: "Adicione os componentes do caminho de falha",
    body:
      "Na categoria Messaging, adicione Dead Letter Queue; em Compute, adicione DLQ Worker. Eles receberão apenas mensagens que falharam, não uma cópia da carga principal.",
    done_when: [
      { kind: "node_added", archetype: "dead-letter-queue" },
      { kind: "node_added", archetype: "dlq-worker" },
    ],
  },
  {
    id: "connect-dlq",
    kind: "action",
    title: "Modele a falha com o intent correto",
    body:
      "Conecte Worker → Dead Letter Queue com ‘dead_letter’ e Dead Letter Queue → DLQ Worker com ‘async_message’. A simulação deve mostrar aproximadamente 1% do fluxo principal nesse ramo, sem escalar a DLQ como a fila principal.",
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
    title: "Registre decisões diretamente no canvas",
    body:
      "Adicione um Balão de comentário e escreva, por exemplo: ‘cache exige invalidação; feed é eventual; DLQ recebe apenas falhas’. Os quatro handles permitem ancorar o comentário pelo lado mais conveniente. Para ajustar uma conexão, selecione a aresta e arraste as alças laranja exibidas em cada quebra de 90 graus; o texto pode ser movido separadamente. Um duplo clique em uma alça restaura o traçado automático.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "judge",
    kind: "action",
    title: "Use o Juiz como revisão do estado atual",
    body:
      "Abra ‘AI Judge’ na borda direita e clique ‘Rodar Juiz’. Os findings consideram Contexto, diagrama, comentários, intents e última simulação.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Revise o artefato antes de efetivar a exportação",
    body:
      "Clique ‘Exportar’, revise as seções e escolha ‘Pré-visualizar pré-ADR’. A prévia mostra o resultado sem criar arquivo ou registro.",
    done_when: [{ kind: "export_previewed" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Você percorreu o fluxo principal da ferramenta",
    body:
      "Você criou e conectou componentes, explicitou a distribuição de carga, editou capacidade, registrou contexto, configurou uma referência, leu HUD e timeline, comparou cenários, aplicou diffs do Ask AIrchitect, representou processamento assíncrono e falhas, executou o Juiz e abriu a prévia do pré-ADR. O mesmo fluxo pode agora ser repetido com outro problema e outros critérios.",
  },
];
