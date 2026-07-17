"""Catálogo de arquétipos do MVP (M2, modo agnóstico) + tabela base do simulador (§6.1).

Fonte de verdade do seed de `archetypes_config`. base_rps=None → capacidade infinita.
"""

CATEGORY_ORDER = [
    "Client",
    "Traffic & Edge",
    "Compute",
    "Storage",
    "Messaging",
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
    # category: AI & Agents
    {"archetype": "llm-gateway", "archetype_class": "llm", "label": "LLM Gateway",
     "category": "AI & Agents", "base_rps": 100, "base_latency_ms": 900,
     "params": {"ttft_ms": 400, "tokens_per_second": 60}},
    {"archetype": "embedding-service", "archetype_class": "embedding", "label": "Embedding Service",
     "category": "AI & Agents", "base_rps": 500, "base_latency_ms": 45},
    {"archetype": "guardrails", "archetype_class": "guardrail", "label": "Guardrails",
     "category": "AI & Agents", "base_rps": 900, "base_latency_ms": 60},
    {"archetype": "semantic-cache", "archetype_class": "semantic-cache", "label": "Semantic Cache",
     "category": "AI & Agents", "base_rps": 5_000, "base_latency_ms": 8},
    {"archetype": "agent-orchestrator", "archetype_class": "agent-orchestrator",
     "label": "Agent Orchestrator", "category": "AI & Agents",
     "base_rps": 300, "base_latency_ms": 30, "params": {"avg_tool_calls": 2}},
    {"archetype": "model-router", "archetype_class": "gateway", "label": "Model Router",
     "category": "AI & Agents", "base_rps": 3_000, "base_latency_ms": 10},
    {"archetype": "model-endpoint-realtime", "archetype_class": "llm",
     "label": "Model Endpoint (Realtime)", "category": "AI & Agents", "base_rps": 100,
     "base_latency_ms": 900, "params": {"ttft_ms": 400, "tokens_per_second": 60}},
    {"archetype": "model-endpoint-batch", "archetype_class": "batch",
     "label": "Model Endpoint (Batch)", "category": "AI & Agents", "base_rps": 50,
     "base_latency_ms": 1_500},
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
     "base_latency_ms": 5},
]

ARCHETYPE_IDS: set[str] = {item["archetype"] for item in CATALOG}
