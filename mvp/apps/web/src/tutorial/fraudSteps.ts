import type { TutorialStep } from "./steps";

export const FRAUD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "problem",
    kind: "info",
    title: "O problema proposto",
    body:
      "Uma plataforma de pagamentos precisa aprovar ou recusar transações em tempo real usando regras e um modelo antifraude. A decisão online deve continuar rápida durante crescimento de tráfego, enquanto evidências, monitoramento e evolução do modelo acontecem sem alongar o caminho do cliente.",
  },
  {
    id: "requirements",
    kind: "info",
    title: "Critérios que serão exercitados",
    body:
      "FUNCIONAIS\n• Receber uma tentativa de pagamento.\n• Consultar features consistentes com o treinamento.\n• Obter score de fraude em tempo real.\n• Registrar decisões para auditoria e evolução do modelo.\n\nNÃO FUNCIONAIS\n• Sustentar 500 RPS com p99 abaixo de 150 ms.\n• Crescer progressivamente até 3× a carga.\n• Isolar processamento offline do caminho de autorização.\n• Tornar visíveis partições quentes e backlog.",
  },
  {
    id: "baseline-nodes",
    kind: "action",
    title: "Monte o caminho de decisão mínimo",
    body:
      "Adicione Client (Web), API Gateway, App Server e Real-time Inference. Cada um representa uma responsabilidade diferente: origem, política de entrada, regras de negócio e score síncrono.",
    done_when: [
      { kind: "node_added", archetype: "client" },
      { kind: "node_added", archetype: "api-gateway" },
      { kind: "node_added", archetype: "app-server" },
      { kind: "node_added", archetype: "model-endpoint-realtime" },
    ],
  },
  {
    id: "baseline-edges",
    kind: "action",
    title: "Conecte o caminho online",
    body:
      "Conecte Client → API Gateway e API Gateway → App Server com request. Conecte App Server → Real-time Inference com ai_call. Todos participam do p99 e da disponibilidade da autorização.",
    done_when: [
      { kind: "edge_between", sourceArchetype: "client", targetArchetype: "api-gateway", intent: "request" },
      { kind: "edge_between", sourceArchetype: "api-gateway", targetArchetype: "app-server", intent: "request" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "model-endpoint-realtime", intent: "ai_call" },
    ],
  },
  {
    id: "context",
    kind: "action",
    title: "Registre a finalidade da decisão",
    body:
      "Abra Contexto e preencha todos os campos abaixo. O AI Judge só será liberado quando o contexto obrigatório estiver completo.\n\nDescrição:\nSistema antifraude para autorizar ou recusar pagamentos em tempo real usando regras e score de risco.\n\nRequisitos (um por linha):\nReceber tentativas de pagamento\nConsultar features consistentes com o treinamento\nGerar score de fraude em tempo real\nRegistrar decisões e evidências para auditoria\n\nConsiderações:\nA autorização deve manter baixa latência; auditoria e evolução do modelo não podem alongar o caminho online.\n\nClassificação de dados:\nConfidencial\n\nFora de escopo:\nRevisão manual, contestação de pagamentos, chargeback e investigação humana.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "baseline-simulation",
    kind: "action",
    title: "Meça a referência online",
    body:
      "No simulador selecione Carga constante. Expanda com + e defina RPS base 500, Traffic 1×, 90% reads, cache hit 80%, p99 alvo 150 ms e Perfil Balanceado. Clique Simular.",
    done_when: [
      { kind: "simulation_ran" },
      { kind: "simulation_setup", baseRps: 500, multiplier: 1, readRatio: 0.9, cacheHitRate: 0.8, p99Target: 150, scenario: "steady", capacityProfile: "nominal" },
    ],
  },
  {
    id: "read-baseline",
    kind: "info",
    title: "Localize a margem antes do crescimento",
    body:
      "A inferência em tempo real recebe as 500 decisões por segundo e participa do p99. A rodada deve permanecer saudável, mas o nó do endpoint já opera acima da faixa confortável de 70%, revelando pouca margem.",
  },
  {
    id: "ramp",
    kind: "action",
    title: "Descubra quando o endpoint deixa de acompanhar",
    body:
      "Selecione Rampa de carga, ajuste Traffic para 3× e simule. A timeline cresce em seis intervalos e mostra quando a inferência ultrapassa a capacidade, em vez de apresentar apenas uma média final.",
    done_when: [
      { kind: "simulation_scenario", scenario: "ramp" },
      { kind: "simulation_bottleneck", archetype: "model-endpoint-realtime" },
    ],
  },
  {
    id: "scale-online",
    kind: "action",
    title: "Aumente capacidade no caminho pressionado",
    body:
      "Defina 2 unidades fixas no App Server e 4 no Real-time Inference. Simule novamente e confirme que o erro desapareceu. Ambos continuam síncronos; apenas a capacidade do caminho online foi alterada.",
    done_when: [
      { kind: "node_replicas", archetype: "app-server", min: 2 },
      { kind: "node_replicas", archetype: "model-endpoint-realtime", min: 4 },
      { kind: "simulation_no_errors" },
    ],
  },
  {
    id: "feature-problem",
    kind: "info",
    title: "O score precisa das mesmas features do treinamento",
    body:
      "Capacidade resolveu o gargalo imediato, mas o diagrama ainda omite de onde vêm sinais como velocidade de compras, histórico do dispositivo e risco do recebedor. Essa lacuna costuma gerar divergência entre treinamento e produção.",
  },
  {
    id: "feature-store",
    kind: "action",
    title: "Torne a consulta de features explícita",
    body:
      "Adicione Feature Store e conecte App Server → Feature Store com retrieval. Mantenha App Server → Real-time Inference com ai_call; não conecte o Feature Store ao endpoint. O App Server busca as features quentes, recebe o retorno implicitamente, monta o request de inferência e então chama o modelo. Se o diagrama veio da versão anterior, remova Feature Store → Real-time Inference.",
    done_when: [
      { kind: "node_added", archetype: "feature-store" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "feature-store", intent: "retrieval" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "model-endpoint-realtime", intent: "ai_call" },
      { kind: "edge_absent", sourceArchetype: "feature-store", targetArchetype: "model-endpoint-realtime" },
    ],
  },
  {
    id: "hot-partition",
    kind: "action",
    title: "Teste uma distribuição desigual",
    body:
      "No simulador, em Cenário, selecione Partição quente, ajuste Traffic para 4× e simule. O cenário reduz a capacidade útil de stores particionados a 40%; o gargalo deve migrar para o Feature Store e ultrapassar sua capacidade.",
    done_when: [
      { kind: "simulation_scenario", scenario: "hot_partition" },
      { kind: "simulation_bottleneck", archetype: "feature-store" },
    ],
  },
  {
    id: "feature-capacity",
    kind: "action",
    title: "Teste capacidade sem confundir a causa",
    body:
      "Defina 2 unidades no Feature Store e simule. Isso adiciona margem ao exercício, mas o aviso do cenário continua importante: em produção, uma chave de distribuição ruim pode não ser corrigida apenas com capacidade total.",
    done_when: [
      { kind: "node_replicas", archetype: "feature-store", min: 2 },
      { kind: "simulation_no_errors" },
    ],
  },
  {
    id: "restore",
    kind: "action",
    title: "Restaure a referência antes do plano offline",
    body: "Volte para Carga constante, Traffic 1× e clique Simular.",
    done_when: [{ kind: "simulation_scenario", scenario: "steady" }],
  },
  {
    id: "audit-problem",
    kind: "info",
    title: "Auditoria não deve segurar a autorização",
    body:
      "Persistir explicações, resultados e rótulos futuros é necessário, mas não precisa acontecer antes da resposta ao pagamento. O próximo ramo usa um buffer durável para separar o aceite online do processamento posterior.",
  },
  {
    id: "async-audit",
    kind: "action",
    title: "Modele o registro assíncrono",
    body:
      "Adicione Event Stream e Worker. Conecte Real-time Inference → Event Stream e Event Stream → Worker com async_message. O p99 termina no aceite do stream; o consumidor fica fora do caminho online.",
    done_when: [
      { kind: "node_added", archetype: "event-stream" },
      { kind: "node_added", archetype: "worker" },
      { kind: "edge_between", sourceArchetype: "model-endpoint-realtime", targetArchetype: "event-stream", intent: "async_message" },
      { kind: "edge_between", sourceArchetype: "event-stream", targetArchetype: "worker", intent: "async_message" },
    ],
  },
  {
    id: "backlog",
    kind: "action",
    title: "Faça o buffer revelar o consumidor lento",
    body:
      "Selecione Rampa de carga, Traffic 4× e simule. O Worker médio processa até sua capacidade; o excesso permanece como backlog no Event Stream, sem inventar erros no consumidor.",
    done_when: [
      { kind: "simulation_scenario", scenario: "ramp" },
      { kind: "simulation_node_metric", archetype: "event-stream", metric: "backlog_messages", operator: "gt", value: 0 },
    ],
  },
  {
    id: "worker-scale",
    kind: "action",
    title: "Escale quem realmente drena o backlog",
    body:
      "Nas propriedades do Worker escolha Escala elástica, mínimo 1 e máximo ao menos 4. Simule e acompanhe unidades ativas e eventos de escala. A fila guarda trabalho; quem aumenta a vazão é o consumidor.",
    done_when: [
      { kind: "node_config", archetype: "worker", fields: { scaling: "elastic" } },
    ],
  },
  {
    id: "monitoring",
    kind: "action",
    title: "Observe o modelo fora do p99",
    body:
      "Adicione Model Monitoring / Drift e conecte Real-time Inference → monitoring com telemetry. Métricas e previsões chegam ao observador, mas sua latência não é somada à autorização.",
    done_when: [
      { kind: "node_added", archetype: "model-monitoring" },
      { kind: "edge_between", sourceArchetype: "model-endpoint-realtime", targetArchetype: "model-monitoring", intent: "telemetry" },
    ],
  },
  {
    id: "model-lifecycle",
    kind: "action",
    title: "Represente o plano de evolução do modelo",
    body:
      "Adicione ML Training Pipeline e Model Registry. Conecte Event Stream → Training Pipeline com async_message e Training Pipeline → Model Registry com model_update. Esse intent representa publicação no plano de controle e não propaga RPS de usuário.",
    done_when: [
      { kind: "node_added", archetype: "ml-training-pipeline" },
      { kind: "node_added", archetype: "model-registry" },
      { kind: "edge_between", sourceArchetype: "event-stream", targetArchetype: "ml-training-pipeline", intent: "async_message" },
      { kind: "edge_between", sourceArchetype: "ml-training-pipeline", targetArchetype: "model-registry", intent: "model_update" },
    ],
  },
  {
    id: "annotate",
    kind: "action",
    title: "Registre decisões de risco e operação",
    body:
      "Adicione um comentário sobre fallback de regras, versionamento das features, explicabilidade, replay de eventos e promoção controlada do modelo. O desenho mostra fluxos; o comentário preserva as decisões.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "judge",
    kind: "action",
    title: "Execute a revisão do sistema",
    body: "Abra AI Judge e clique Rodar Juiz.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Confira a exportação",
    body:
      "Clique Exportar e abra Pré-visualizar exportação. Confira o pré-ADR e alterne para Mermaid (.mmd); a prévia ainda não cria arquivos.",
    done_when: [{ kind: "export_previewed" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Sistema antifraude revisado",
    body:
      "Você usou a ferramenta para medir o caminho online, testar rampa e partição quente, posicionar Feature Store, isolar auditoria com Event Stream, observar backlog, separar telemetria e representar treinamento e registro fora do p99.",
  },
];
