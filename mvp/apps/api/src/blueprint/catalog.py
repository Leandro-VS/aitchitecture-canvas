"""Catálogo de arquétipos do MVP (M2, modo agnóstico) + calibração do simulador.

`base_rps` é a referência nominal de work units por segundo para uma unidade
Medium, não um limite prometido por AWS ou outro provedor. O motor a combina
com porte, perfil de capacidade, mix da operação, escala e cenário.
`base_rps=None` representa uma origem de tráfego sem capacidade própria.
"""

CATEGORY_ORDER = [
    "Client",
    "Traffic & Edge",
    "Compute",
    "Storage",
    "Messaging",
    "Machine Learning",
    "AI & Agents",
]

CATALOG: list[dict] = [
    # category: Client
    {"archetype": "client", "archetype_class": "client", "label": "Client (Web)",
     "category": "Client", "base_rps": None, "base_latency_ms": 0},
    {"archetype": "mobile", "archetype_class": "client", "label": "Mobile",
     "category": "Client", "base_rps": None, "base_latency_ms": 0},
    # category: Traffic & Edge
    {"archetype": "dns", "archetype_class": "edge", "label": "DNS",
     "category": "Traffic & Edge", "base_rps": 100_000, "base_latency_ms": 1},
    {"archetype": "cdn", "archetype_class": "edge", "label": "CDN",
     "category": "Traffic & Edge", "base_rps": 100_000, "base_latency_ms": 1},
    {"archetype": "load-balancer", "archetype_class": "edge", "label": "Load Balancer",
     "category": "Traffic & Edge", "base_rps": 100_000, "base_latency_ms": 1},
    {"archetype": "api-gateway", "archetype_class": "gateway", "label": "API Gateway",
     "category": "Traffic & Edge", "base_rps": 3_000, "base_latency_ms": 5},
    # category: Compute
    {"archetype": "app-server", "archetype_class": "compute", "label": "App Server",
     "category": "Compute", "base_rps": 1_500, "base_latency_ms": 25},
    {"archetype": "worker", "archetype_class": "compute", "label": "Worker",
     "category": "Compute", "base_rps": 1_500, "base_latency_ms": 25},
    {"archetype": "serverless", "archetype_class": "compute", "label": "Serverless",
     "category": "Compute", "base_rps": 1_500, "base_latency_ms": 25},
    {"archetype": "dlq-worker", "archetype_class": "compute", "label": "DLQ Worker",
     "category": "Compute", "base_rps": 1_500, "base_latency_ms": 25},
    # category: Storage
    {"archetype": "sql-db", "archetype_class": "database", "label": "SQL Database",
     "category": "Storage", "base_rps": 300, "base_latency_ms": 20},
    {"archetype": "nosql-db", "archetype_class": "store", "label": "NoSQL DB",
     "category": "Storage", "base_rps": 2_000, "base_latency_ms": 40},
    {"archetype": "cache", "archetype_class": "cache", "label": "Cache",
     "category": "Storage", "base_rps": 30_000, "base_latency_ms": 2},
    {"archetype": "object-store", "archetype_class": "store", "label": "Object Store",
     "category": "Storage", "base_rps": 2_000, "base_latency_ms": 40},
    {"archetype": "vector-db", "archetype_class": "vector-db", "label": "Vector DB",
     "category": "Storage", "base_rps": 800, "base_latency_ms": 25},
    # category: Messaging
    {"archetype": "message-queue", "archetype_class": "queue", "label": "Message Queue",
     "category": "Messaging", "base_rps": 10_000, "base_latency_ms": 8},
    {"archetype": "event-stream", "archetype_class": "queue", "label": "Event Stream",
     "category": "Messaging", "base_rps": 10_000, "base_latency_ms": 8},
    {"archetype": "dead-letter-queue", "archetype_class": "queue",
     "label": "Dead Letter Queue", "category": "Messaging", "base_rps": 10_000,
     "base_latency_ms": 8},
    # category: Machine Learning
    {"archetype": "feature-store", "archetype_class": "feature-store",
     "label": "Feature Store", "category": "Machine Learning", "base_rps": 5_000,
     "base_latency_ms": 8, "params": {"simulation_profile": "partitioned_store"}},
    {"archetype": "ml-training-pipeline", "archetype_class": "ml-training",
     "label": "ML Training Pipeline", "category": "Machine Learning", "base_rps": 50,
     "base_latency_ms": 100, "params": {"simulation_profile": "batch_inference",
                                          "default_scaling": "elastic",
                                          "default_max_units": 20}},
    {"archetype": "model-registry", "archetype_class": "ml-control",
     "label": "Model Registry", "category": "Machine Learning", "base_rps": 1_000,
     "base_latency_ms": 20, "params": {"simulation_profile": "control_plane"}},
    {"archetype": "model-endpoint-realtime", "archetype_class": "ml-realtime",
     "label": "Real-time Inference", "category": "Machine Learning", "base_rps": 600,
     "base_latency_ms": 35, "params": {"simulation_profile": "realtime_inference"}},
    {"archetype": "model-endpoint-async", "archetype_class": "ml-async",
     "label": "Async Inference", "category": "Machine Learning", "base_rps": 250,
     "base_latency_ms": 25, "params": {"simulation_profile": "async_inference",
                                         "default_scaling": "elastic",
                                         "default_max_units": 10}},
    {"archetype": "model-endpoint-batch", "archetype_class": "ml-batch",
     "label": "Batch Inference", "category": "Machine Learning", "base_rps": 500,
     "base_latency_ms": 30, "params": {"simulation_profile": "batch_inference",
                                         "default_scaling": "elastic",
                                         "default_max_units": 20}},
    {"archetype": "model-endpoint-serverless", "archetype_class": "ml-serverless",
     "label": "Serverless Inference", "category": "Machine Learning", "base_rps": 300,
     "base_latency_ms": 45, "params": {"simulation_profile": "serverless_inference",
                                         "default_scaling": "elastic",
                                         "default_max_units": 20,
                                         "cold_start_ms": 600}},
    {"archetype": "model-monitoring", "archetype_class": "ml-observability",
     "label": "Model Monitoring / Drift", "category": "Machine Learning", "base_rps": 10_000,
     "base_latency_ms": 5, "params": {"simulation_profile": "observation_sink"}},
    # category: AI & Agents
    {"archetype": "llm-gateway", "archetype_class": "llm", "label": "LLM Gateway",
     "category": "AI & Agents", "base_rps": 100, "base_latency_ms": 900,
     "params": {"ttft_ms": 400, "tokens_per_second": 60}},
    {"archetype": "embedding-service", "archetype_class": "embedding", "label": "Embedding Service",
     "category": "AI & Agents", "base_rps": 500, "base_latency_ms": 45},
    {"archetype": "guardrails", "archetype_class": "input-guardrail",
     "label": "Input Guardrail", "category": "AI & Agents", "base_rps": 1_200,
     "base_latency_ms": 20, "params": {
         "simulation_profile": "input_guardrail",
         "default_guardrail_scope": "current_turn",
         "default_guardrail_engine": "deterministic",
     }},
    {"archetype": "output-guardrail", "archetype_class": "output-guardrail",
     "label": "Output Guardrail", "category": "AI & Agents", "base_rps": 900,
     "base_latency_ms": 60, "params": {
         "simulation_profile": "output_guardrail",
         "default_guardrail_scope": "current_turn",
         "default_guardrail_engine": "generative",
     }},
    {"archetype": "semantic-cache", "archetype_class": "semantic-cache", "label": "Semantic Cache",
     "category": "AI & Agents", "base_rps": 5_000, "base_latency_ms": 8},
    {"archetype": "agent-orchestrator", "archetype_class": "agent-orchestrator",
     "label": "Agent Orchestrator", "category": "AI & Agents",
     "base_rps": 300, "base_latency_ms": 30, "params": {"avg_tool_calls": 2}},
    {"archetype": "model-router", "archetype_class": "gateway", "label": "Model Router",
     "category": "AI & Agents", "base_rps": 3_000, "base_latency_ms": 10},
    {"archetype": "rag-retriever", "archetype_class": "compute", "label": "RAG Retriever",
     "category": "AI & Agents", "base_rps": 1_200, "base_latency_ms": 20},
    {"archetype": "tool-registry", "archetype_class": "store", "label": "Tool Registry",
     "category": "AI & Agents", "base_rps": 2_000, "base_latency_ms": 20},
    {"archetype": "agent-memory", "archetype_class": "store", "label": "Agent Memory",
     "category": "AI & Agents", "base_rps": 2_000, "base_latency_ms": 25},
    {"archetype": "prompt-store", "archetype_class": "store", "label": "Prompt / Config Store",
     "category": "AI & Agents", "base_rps": 2_000, "base_latency_ms": 20},
    {"archetype": "mcp-gateway", "archetype_class": "gateway", "label": "MCP Gateway",
     "category": "AI & Agents", "base_rps": 3_000, "base_latency_ms": 10},
    {"archetype": "llm-observability", "archetype_class": "observability",
     "label": "LLM Observability / Evals", "category": "AI & Agents", "base_rps": 15_000,
     "base_latency_ms": 5, "params": {"simulation_profile": "observation_sink"}},
]

# Explicações curtas e agnósticas de fornecedor. Além da palette, esse texto é
# exibido no início das propriedades e, portanto, também atende diagramas já
# salvos sem duplicar conteúdo no canvas_state.
DESCRIPTIONS: dict[str, str] = {
    "client": "Origem de requisições feitas por usuários em navegadores web.",
    "mobile": "Aplicativo móvel que inicia requisições e consome APIs do sistema.",
    "dns": "Resolve nomes de domínio e direciona clientes ao ponto de entrada correto.",
    "cdn": "Entrega conteúdo próximo do usuário e reduz tráfego e latência na origem.",
    "load-balancer": "Distribui requisições entre múltiplas unidades de uma aplicação ou serviço.",
    "api-gateway": "Centraliza a entrada de APIs, roteamento, autenticação, quotas e políticas.",
    "app-server": "Executa regras de negócio e coordena chamadas aos demais componentes.",
    "worker": "Processa tarefas em segundo plano, normalmente consumidas de filas ou eventos.",
    "serverless": "Executa código sob demanda com infraestrutura e escala gerenciadas.",
    "dlq-worker": "Analisa ou reprocessa mensagens que chegaram à fila de falhas.",
    "sql-db": "Armazena dados relacionais com esquema, consultas SQL e transações.",
    "nosql-db": "Armazena dados não relacionais com escala distribuída e acesso por chave.",
    "cache": "Mantém dados frequentes em memória para reduzir latência e carga na origem.",
    "object-store": "Armazena arquivos e objetos duráveis, como imagens, documentos e artefatos.",
    "vector-db": "Indexa vetores para busca por similaridade semântica e recuperação contextual.",
    "message-queue": "Desacopla produtores e consumidores com entrega assíncrona e durável.",
    "event-stream": "Mantém uma sequência ordenada de eventos para consumo contínuo e replay.",
    "dead-letter-queue": (
        "Isola mensagens que falharam para diagnóstico ou reprocessamento controlado."
    ),
    "llm-gateway": "Centraliza acesso a modelos generativos, políticas, quotas e observabilidade.",
    "embedding-service": "Converte textos ou outros dados em vetores para busca e comparação.",
    "guardrails": (
        "Inspeciona a entrada antes do modelo para bloquear ataques, abuso e conteúdo "
        "inadequado, evitando chamadas desnecessárias ao LLM."
    ),
    "output-guardrail": (
        "Avalia a resposta do modelo junto da pergunta original antes de entregá-la ao usuário."
    ),
    "semantic-cache": "Reutiliza respostas para solicitações semanticamente equivalentes.",
    "agent-orchestrator": "Coordena o raciocínio do agente, uso de ferramentas e etapas do fluxo.",
    "model-router": "Seleciona e encaminha cada chamada ao modelo mais adequado ao contexto.",
    "model-endpoint-realtime": (
        "Serve modelos por chamadas síncronas para previsões interativas de baixa latência."
    ),
    "model-endpoint-async": (
        "Enfileira previsões demoradas e disponibiliza o resultado após o processamento."
    ),
    "model-endpoint-batch": (
        "Executa inferências offline sobre grandes conjuntos de dados em lote."
    ),
    "model-endpoint-serverless": (
        "Serve previsões sob demanda com escala automática e possível latência de cold start."
    ),
    "feature-store": (
        "Centraliza features reutilizáveis e consistentes para treinamento e inferência."
    ),
    "model-registry": (
        "Versiona modelos e controla sua aprovação e promoção entre ambientes."
    ),
    "ml-training-pipeline": (
        "Orquestra preparação de dados, treinamento, avaliação e publicação de modelos."
    ),
    "model-monitoring": (
        "Acompanha qualidade das previsões, drift dos dados e degradação do modelo."
    ),
    "rag-retriever": "Busca e seleciona contexto relevante antes de uma chamada ao modelo.",
    "tool-registry": "Cataloga ferramentas disponíveis para agentes e seus contratos de uso.",
    "agent-memory": "Persiste contexto e informações que o agente reutiliza entre interações.",
    "prompt-store": "Versiona prompts, configurações e templates utilizados por aplicações de IA.",
    "mcp-gateway": "Centraliza conexões MCP, controle de acesso e descoberta de ferramentas.",
    "llm-observability": "Registra traces, qualidade, custos e avaliações de aplicações com LLMs.",
}

for item in CATALOG:
    item["description"] = DESCRIPTIONS[item["archetype"]]

ARCHETYPE_ORDER: dict[str, int] = {
    item["archetype"]: index for index, item in enumerate(CATALOG)
}
ARCHETYPE_IDS: set[str] = {item["archetype"] for item in CATALOG}
