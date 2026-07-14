# Fixtures do MockLLMClient

Respostas roteirizadas do "LLM" — o MVP inteiro roda contra elas (decisão: mock-only).

Convenção de resolução (ver `blueprint/llm/mock.py`):

1. `{feature}-{hash8}.json` — resposta específica para uma mensagem exata
   (hash8 = primeiros 8 chars do sha256 do conteúdo da última mensagem);
2. `{feature}-default.json` — fallback da feature.

Features previstas: `judge` (Fase 4), `architect`, `bootstrap_intake`,
`bootstrap_sketch` (Fase 5), `adr_draft` (Fase 6). As fixtures do tutorial (D14)
vivem em `fixtures/tutorial/` e usam os mesmos schemas Pydantic de produção.
