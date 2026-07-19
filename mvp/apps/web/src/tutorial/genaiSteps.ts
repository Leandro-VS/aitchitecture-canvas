import type { TutorialStep } from "./steps";

export const OUTPUT_GUARDRAIL_PROMPT =
  "Como faço o fluxo de RAG validar uma resposta antes de devolvê-la ao App Server?";

export const GENAI_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "problem",
    kind: "info",
    title: "O problema proposto",
    body:
      "Uma empresa quer oferecer um assistente conversacional que responda usando sua base interna. O sistema precisa manter contexto, citar conhecimento recuperado e resistir a tentativas de manipular o modelo sem transformar toda interação bloqueada em indisponibilidade.",
  },
  {
    id: "requirements",
    kind: "info",
    title: "Critérios que serão exercitados",
    body:
      "FUNCIONAIS\n• Responder perguntas em linguagem natural.\n• Recuperar contexto da base de conhecimento.\n• Manter histórico recente da conversa.\n\nNÃO FUNCIONAIS\n• Sustentar 100 RPS com p99 abaixo de 2.500 ms.\n• Evitar chamadas repetidas ao LLM.\n• Bloquear ataques evidentes antes do modelo.\n• Avaliar pergunta e resposta antes da entrega.\n• Detectar ataques distribuídos em múltiplos turnos.",
  },
  {
    id: "add-baseline",
    kind: "action",
    title: "Monte o menor caminho conversacional",
    body:
      "Adicione Client (Web), App Server e LLM Gateway. Começar pequeno permite usar a simulação para justificar cada próximo componente.",
    done_when: [
      { kind: "node_added", archetype: "client" },
      { kind: "node_added", archetype: "app-server" },
      { kind: "node_added", archetype: "llm-gateway" },
    ],
  },
  {
    id: "connect-baseline",
    kind: "action",
    title: "Declare o caminho síncrono",
    body:
      "Conecte Client → App Server com request e App Server → LLM Gateway com ai_call. O segundo intent deixa explícito que a latência e a quota do modelo pertencem ao caminho online.",
    done_when: [
      { kind: "edge_between", sourceArchetype: "client", targetArchetype: "app-server", intent: "request" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "llm-gateway", intent: "ai_call" },
    ],
  },
  {
    id: "context",
    kind: "action",
    title: "Registre o contexto do exercício",
    body:
      "Abra Contexto e preencha todos os campos abaixo. O AI Judge só será liberado quando o contexto obrigatório estiver completo.\n\nDescrição:\nAssistente conversacional com RAG que responde perguntas usando a base interna da empresa e mantém contexto recente.\n\nRequisitos (um por linha):\nResponder perguntas em linguagem natural\nRecuperar e citar conhecimento da base interna\nManter o histórico recente da conversa\nBloquear entradas e respostas inseguras\n\nConsiderações:\nCanal externo com respostas fundamentadas; a memória pode aceitar consistência eventual, mas dados internos não podem vazar.\n\nClassificação de dados:\nConfidencial\n\nFora de escopo:\nIngestão offline de documentos, atendimento humano e treinamento de modelos.",
    done_when: [{ kind: "context_filled" }],
  },
  {
    id: "baseline-simulation",
    kind: "action",
    title: "Crie a referência do assistente",
    body:
      "No simulador escolha Carga constante. Expanda com + e defina RPS base 100, Traffic 1×, 100% reads, cache hit 70%, p99 alvo 2500 ms e Perfil de Capacidade Balanceado. Clique Simular.",
    done_when: [
      { kind: "simulation_ran" },
      { kind: "simulation_setup", baseRps: 100, multiplier: 1, readRatio: 1, cacheHitRate: 0.7, p99Target: 2500, scenario: "steady", capacityProfile: "nominal" },
    ],
  },
  {
    id: "read-baseline",
    kind: "info",
    title: "Observe quota e latência antes de otimizar",
    body:
      "O LLM recebe uma chamada por pergunta e opera no limite nominal de uma unidade. Sua latência base é de 900ms, ao chegar a 100% da capacidade, sua latência degrada e o p99 do caminho ultrapassa os 2.500 ms configurados como alvo. O nó mostra essa utilização e o HUD compara o resultado observado com o alvo.",
  },
  {
    id: "semantic-cache",
    kind: "action",
    title: "Adicione reutilização semântica",
    body:
      "Adicione Semantic Cache. Remova App Server → LLM e conecte App Server → Semantic Cache com cache_lookup e App Server → LLM Gateway com ai_call. Quando há cache no mesmo fan-out, o motor envia apenas misses ao caminho restante.",
    done_when: [
      { kind: "node_added", archetype: "semantic-cache" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "semantic-cache", intent: "cache_lookup" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "llm-gateway", intent: "ai_call" },
    ],
  },
  {
    id: "validate-cache",
    kind: "action",
    title: "Meça a redução de chamadas",
    body:
      "Clique Simular novamente. Com 70% de hit, o LLM deve receber aproximadamente 30 RPS, enquanto o Semantic Cache recebe as consultas. Confirme a rodada sem erros.",
    done_when: [{ kind: "simulation_no_errors" }],
  },
  {
    id: "cold-cache",
    kind: "action",
    title: "Teste o paliativo em uma condição adversa",
    body:
      "No simulador, em Cenário, selecione Cache frio e clique Simular. Nos primeiros 20 segundos o hit é zero: a timeline revela a pressão temporária no LLM que a média esconderia.",
    done_when: [{ kind: "simulation_scenario", scenario: "cold_cache" }],
  },
  {
    id: "restore",
    kind: "action",
    title: "Volte à referência",
    body: "Selecione Carga constante e simule novamente antes de alterar a finalidade do sistema.",
    done_when: [{ kind: "simulation_scenario", scenario: "steady" }],
  },
  {
    id: "grounding-problem",
    kind: "info",
    title: "O cache não cria respostas fundamentadas",
    body:
      "Reutilizar respostas reduz custo, mas não conecta o assistente ao conhecimento interno. Agora o diagrama precisa representar recuperação e geração como responsabilidades distintas.",
  },
  {
    id: "add-rag",
    kind: "action",
    title: "Modele o caminho de recuperação",
    body:
      "Adicione RAG Retriever, Embedding Service e Vector DB. O Retriever será o orquestrador do pipeline: remova App Server → Semantic Cache e App Server → LLM Gateway; conecte App Server → RAG Retriever com retrieval. A partir do RAG Retriever, conecte Semantic Cache com cache_lookup, Embedding Service com ai_call, Vector DB com retrieval e LLM Gateway com ai_call. As respostas dessas chamadas retornam implicitamente ao Retriever, que devolve o resultado ao App Server. Em cache hit ele pode encerrar cedo; em miss, gera o embedding, consulta o índice, monta o contexto e chama o modelo.",
    done_when: [
      { kind: "node_added", archetype: "rag-retriever" },
      { kind: "node_added", archetype: "embedding-service" },
      { kind: "node_added", archetype: "vector-db" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "rag-retriever", intent: "retrieval" },
      { kind: "edge_between", sourceArchetype: "rag-retriever", targetArchetype: "semantic-cache", intent: "cache_lookup" },
      { kind: "edge_between", sourceArchetype: "rag-retriever", targetArchetype: "embedding-service", intent: "ai_call" },
      { kind: "edge_between", sourceArchetype: "rag-retriever", targetArchetype: "vector-db", intent: "retrieval" },
      { kind: "edge_between", sourceArchetype: "rag-retriever", targetArchetype: "llm-gateway", intent: "ai_call" },
      { kind: "edge_absent", sourceArchetype: "app-server", targetArchetype: "llm-gateway" },
      { kind: "edge_absent", sourceArchetype: "app-server", targetArchetype: "semantic-cache" },
    ],
  },
  {
    id: "attack-scenario",
    kind: "action",
    title: "Exponha o sistema a ataques de prompt",
    body:
      "No simulador, em Cenário, selecione Ataque de prompt e clique Simular. O cenário mistura 70% de tráfego legítimo, 20% de ataques evidentes na interação e 10% de ataques multi-turn.",
    done_when: [
      { kind: "simulation_scenario", scenario: "prompt_attack" },
      { kind: "simulation_node_metric", archetype: "llm-gateway", metric: "attack_rps", operator: "gt", value: 0 },
    ],
  },
  {
    id: "read-unprotected",
    kind: "info",
    title: "Diferencie ataque recebido de erro",
    body:
      "O LLM mostra attack RPS porque ainda não há proteção. Isso é uma exposição de segurança. Já um ataque detectado e bloqueado será uma decisão esperada, não erro de disponibilidade.",
  },
  {
    id: "input-current",
    kind: "action",
    title: "Bloqueie ataques evidentes antes do LLM",
    body:
      "Adicione Input Guardrail e conecte App Server → Input Guardrail com validation. Mantenha App Server → RAG Retriever. Nas propriedades, mantenha Estratégia = Determinístico e Interação atual. A resposta da validação volta implicitamente ao App Server: se houver bloqueio, o App responde ao usuário; se houver liberação, chama o RAG Retriever. Simule.",
    done_when: [
      { kind: "node_added", archetype: "guardrails" },
      { kind: "node_config", archetype: "guardrails", fields: { guardrailEngine: "deterministic", guardrailScope: "current_turn" } },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "guardrails", intent: "validation" },
      { kind: "edge_absent", sourceArchetype: "guardrails", targetArchetype: "semantic-cache" },
      { kind: "edge_absent", sourceArchetype: "guardrails", targetArchetype: "rag-retriever" },
      { kind: "simulation_node_metric", archetype: "guardrails", metric: "blocked_rps", operator: "gt", value: 0, nodeData: { guardrailScope: "current_turn" } },
    ],
  },
  {
    id: "multi-turn-remains",
    kind: "info",
    title: "Uma interação isolada não revela todo ataque",
    body:
      "Guardrails podem usar três estratégias. A determinística prioriza previsibilidade e baixa latência. A probabilística amplia a cobertura, mas admite falsos positivos e negativos. A generativa considera mais nuances, com maior custo e latência. O primeiro filtro remove ataques evidentes; para a parcela multi-turn, usaremos a estratégia probabilística somente depois desse filtro barato.",
  },
  {
    id: "memory-history-guard",
    kind: "action",
    title: "Adicione memória e proteção multi-turn",
    body:
      "Adicione Agent Memory e um segundo Input Guardrail. Conecte App Server → Agent Memory com retrieval e App Server → segundo Input Guardrail com validation. O App Server orquestra somente a proteção de entrada e recebe as respostas implicitamente. Abra o segundo guardrail, escolha Estratégia = Probabilístico e Histórico recente. Depois das liberações, o App chama apenas o RAG Retriever, que coordena o restante. Simule novamente.",
    done_when: [
      { kind: "node_added", archetype: "agent-memory" },
      { kind: "node_added", archetype: "guardrails", count: 2 },
      { kind: "node_config", archetype: "guardrails", fields: { guardrailEngine: "ml", guardrailScope: "recent_history" } },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "agent-memory", intent: "retrieval" },
      { kind: "edge_between", sourceArchetype: "app-server", targetArchetype: "guardrails", intent: "validation", targetData: { guardrailEngine: "ml", guardrailScope: "recent_history" } },
      { kind: "edge_absent", sourceArchetype: "agent-memory", targetArchetype: "guardrails" },
    ],
  },
  {
    id: "history-result",
    kind: "info",
    title: "Leia o custo da defesa em camadas",
    body:
      "O App Server chama primeiro a validação da interação atual. Quando ela libera, consulta a memória e executa a validação histórica; só depois chama o RAG Retriever. A partir daí, o Retriever coordena cache, recuperação e geração. As arestas mostram chamadas iniciadas por cada orquestrador, e os retornos são implícitos. A estratégia probabilística com histórico recente tem menor capacidade e maior latência que a determinística, mas reconhece grande parte da tentativa multi-turn.",
  },
  {
    id: "ask-output",
    kind: "action",
    title: "Consulte o Ask AIrchitect sobre a resposta",
    body:
      "Envie a pergunta sugerida. Revise a proposta tracejada e clique Apply. O Output Guardrail deve ser uma chamada validation iniciada pelo RAG Retriever depois que ele recebe a saída do LLM. Com a liberação, o Retriever devolve a resposta ao App Server, e o App responde ao cliente.",
    suggested_prompt: OUTPUT_GUARDRAIL_PROMPT,
    done_when: [
      { kind: "architect_prompt", prompt: OUTPUT_GUARDRAIL_PROMPT },
      { kind: "node_added", archetype: "output-guardrail" },
      { kind: "edge_between", sourceArchetype: "rag-retriever", targetArchetype: "output-guardrail", intent: "validation" },
      { kind: "edge_absent", sourceArchetype: "app-server", targetArchetype: "output-guardrail" },
      { kind: "edge_absent", sourceArchetype: "llm-gateway", targetArchetype: "output-guardrail" },
    ],
  },
  {
    id: "output-properties",
    kind: "action",
    title: "Defina o contexto da validação de saída",
    body:
      "Nas propriedades do Output Guardrail escolha Estratégia = Generativo e Histórico recente, depois simule. O RAG Retriever envia a pergunta original, a resposta e os turnos anteriores para validação; com a liberação, retorna ao App Server. O modelo conversacional já foi chamado: proteção de saída reduz exposição, não seu custo de geração.",
    done_when: [
      { kind: "node_config", archetype: "output-guardrail", fields: { guardrailEngine: "generative", guardrailScope: "recent_history" } },
      { kind: "simulation_node_active", archetype: "output-guardrail" },
    ],
  },
  {
    id: "spike",
    kind: "action",
    title: "Estresse as quotas do fluxo completo",
    body:
      "Selecione Pico repentino, ajuste Traffic para 3× e simule. Use a timeline para observar os dois intervalos de pico; guardrails, embedding, vector store e LLM possuem limites próprios.",
    done_when: [{ kind: "simulation_scenario", scenario: "spike" }],
  },
  {
    id: "observability",
    kind: "action",
    title: "Separe observação do caminho crítico",
    body:
      "Adicione LLM Observability / Evals e conecte LLM Gateway → observabilidade com telemetry. Esse intent envia o fluxo para análise, mas não soma a latência do observador ao p99 principal.",
    done_when: [
      { kind: "node_added", archetype: "llm-observability" },
      { kind: "edge_between", sourceArchetype: "llm-gateway", targetArchetype: "llm-observability", intent: "telemetry" },
    ],
  },
  {
    id: "annotate",
    kind: "action",
    title: "Registre a política operacional",
    body:
      "Adicione um comentário com as decisões: bloqueios não entram na memória; entrada usa filtro barato antes do histórico; saída é bloqueante; saturação dos guardrails também bloqueia o excesso. Comentários também entram no Juiz e no pré-ADR.",
    done_when: [{ kind: "annotation_added" }],
  },
  {
    id: "judge",
    kind: "action",
    title: "Submeta o desenho à revisão",
    body: "Abra AI Judge e clique Rodar Juiz.",
    done_when: [{ kind: "judge_completed" }],
  },
  {
    id: "export",
    kind: "action",
    title: "Confira o documento resultante",
    body:
      "Clique Exportar e abra Pré-visualizar exportação. Confira o pré-ADR e alterne para Mermaid (.mmd); a prévia ainda não cria arquivos.",
    done_when: [{ kind: "export_previewed" }],
  },
  {
    id: "done",
    kind: "info",
    title: "Assistente conversacional revisado",
    body:
      "Você usou a ferramenta para partir de um fluxo mínimo, medir quota e p99, testar cache frio, modelar RAG, observar ataques single-turn e multi-turn, posicionar guardrails de entrada e saída, separar telemetria e concluir com Juiz, pré-ADR e Mermaid.",
  },
];
