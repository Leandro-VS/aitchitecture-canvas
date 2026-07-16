# AGENT.md — guia de contexto para agentes

Este arquivo orienta um agente Claude começando uma sessão limpa neste repo.
Leia-o antes de qualquer mudança. Última atualização: 16/07/2026 (fim da Fase 5).

## O que é o projeto

**AIrchitecture** (codinome "Blueprint" nos docs): canvas de arquitetura de
software com **IA dedicada na mesma tela**. Engenheiros desenham arquiteturas
(tradicionais e GenAI) num playground React Flow e contam com:

- **Arquiteto IA ("Ask AI")** — chat com contexto do desenho que responde
  dúvidas e propõe mudanças estruturais como *ghost nodes* (Apply/Dismiss);
- **Juiz IA** — avalia o diagrama contra guidelines corporativos (RAG) com
  score, verdict e findings **sempre citando doc + seção** (decisão D15);
- **Simulador determinístico** — carga, gargalos, p99, disponibilidade;
- **Export pré-ADR** (Fase 6, pendente) — a sessão vira documento.

As **specs completas** vivem FORA do repo, no diretório pai:
`../ADR/blueprint-mvp.md` (escopo M1–M14 do MVP), `../ADR/blueprint-implementacao.md`
(visão completa, decisões D1–D17), `../Implementação/implementacao-mvp-local.md`
e `../Implementação/implementacao-completa.md` (companions técnicos).

## Decisões estruturais do MVP (não violar)

1. **Mock-only**: NENHUMA chamada real de LLM. `LLM_PROVIDER=mock` é o único
   provider implementado; Juiz/Arquiteto/bootstrap respondem com **fixtures
   determinísticas** em `mvp/apps/api/fixtures/llm/` (resolução:
   `{feature}-{hash8 da última msg}.json` → fallback `{feature}-default.json`).
   Os schemas das fixtures são os de produção — trocar mock por Ollama/Iara
   depois é implementar a interface `LLMClient` (`blueprint/llm/base.py`), sem
   tocar em features.
2. **Local-only**: tudo roda com `docker compose` (postgres+pgvector, redis,
   minio, api, worker, web). Sem AWS/Terraform/OIDC por enquanto. Auth é stub
   por e-mail (`dev@local`, admin) — o app recusa stub fora de `ENV=local`.
3. **Retrieval mock**: pseudo-embeddings (hash determinístico) não têm
   semântica; a busca do corpus usa **FTS do Postgres** (config `portuguese`)
   como caminho principal + complemento vetorial pgvector. A coluna vector
   (1024 dims) existe para o provider real futuro.
4. **Refs semânticas nas fixtures**: findings do Juiz e ops de diff referenciam
   componentes por `archetype:<slug>` ou nome; o backend resolve para ids reais
   do canvas do usuário (juiz: `judges/serialize.py`; arquiteto:
   `architect/diff.py`). É o que permite roteiros estáticos funcionarem em
   qualquer diagrama.

## Decisões de produto que DIVERGEM das specs originais

Registradas em conversa com o Leandro (dono do projeto) — prevalecem sobre os docs:

- **Intake (contexto) é opcional na criação** — só título obrigatório; desenhar
  e simular funcionam sem contexto. Recursos de IA exigem intake completo
  (gate `require_intake` → HTTP 409; front abre o formulário).
- **NFRs quantitativos** (RPS base, p99 alvo, disponibilidade, read ratio) vivem
  no **painel de simulação** (`SimParams`), não no intake. O intake é só
  qualitativo (summary, requisitos, considerações, classificação de dados,
  fora de escopo).
- **Metadados de componente**: só nome + subtítulo, ambos opcionais, SEM gate
  nem badge de pendência. Réplicas controladas por botões −/+ no próprio nó
  (afetam a capacidade na simulação).
- **UX do playground** (referência: System Design Playground): canvas em tela
  cheia com overlays flutuantes — barra de simulação no topo (Start/Traffic/
  Reads-vs-writes + ⚙), HUD de resultados embaixo, palette flutuante com
  clique-para-adicionar, abas verticais nas bordas (AI Judge à direita,
  Contexto à esquerda), balão "Ask AI" no canto superior direito.

## Status da construção

- [x] Fase 0 — Fundação (compose, FastAPI+Alembic, MockLLMClient, auth stub)
- [x] Fase 1 — Intake + CRUD de diagramas + canvas com autosave/undo (US1)
- [x] Fase 2 — Comentários (D13), edges com intent, simulador determinístico (US2/US3)
- [x] Fase 3 — Corpus: parser do pacote §8.1, indexação no worker, busca com citação (M6)
- [x] Fase 4 — Juiz único: fixtures, D15 no schema, cache por hash, painel de findings (US5)
- [x] Fase 4.5 — Passe de UX do playground
- [x] Fase 5 — Ask AI (chat SSE + ghost diff) e bootstrap por linguagem natural (US4/M13)
- [ ] **Fase 6 — Export pré-ADR (Markdown + PNG via Jinja2/MinIO) e tutorial
  guiado (M14/D14: engine de overlay declarativa + roteiro + fixtures)** ← próxima

Cada fase foi commitada separadamente com mensagem descritiva — `git log` é a
melhor linha do tempo. Migrations Alembic 0001–0007 aplicadas.

## Layout do repo

```
airchitecture/
├── AGENT.md              # este arquivo
├── README.md             # visão do produto + arquitetura final (mermaid)
└── mvp/
    ├── README.md         # arquitetura local + como executar (leia!)
    ├── docker-compose.yml
    ├── Makefile          # up, seed, migrate, test, types, revision
    ├── corpus-example/   # pacote de guidelines de exemplo (SEC-012, GENAI-001, REF-ARCH-RAG-01)
    └── apps/
        ├── api/          # FastAPI + worker arq (mesma imagem)
        │   ├── src/blueprint/
        │   │   ├── routers/     # diagrams, simulation, corpus, judges, architect…
        │   │   ├── simulation/  # motor determinístico puro (testes hypothesis)
        │   │   ├── corpus/      # parser/ingest/search (FTS + pgvector)
        │   │   ├── judges/      # schemas (D15), serialize, run (cache Redis)
        │   │   ├── architect/   # diff (ProposedDiff), bootstrap
        │   │   └── llm/         # LLMClient (Protocol), mock, parse_with_retry
        │   ├── fixtures/llm/    # respostas roteirizadas do "LLM"
        │   ├── migrations/      # alembic 0001–0007
        │   └── tests/           # 53 testes; API tests usam DB blueprint_test isolado
        └── web/          # React 18 + Vite + TS + Tailwind v4 + React Flow
            └── src/      # canvas/ (store zustand+zundo), simulation/, judges/,
                          # architect/ (AskAI), intake/, pages/
```

## Como rodar / verificar

Ver `mvp/README.md` para o passo a passo completo. Resumo: `make up && make seed`
em `mvp/`, front em `:5173`, api em `:8000/docs`. Corpus de exemplo:
`POST /api/corpus/publish {"version":"2026.07.14"}`. Testes: `make test`
(backend roda no host via `uv`, precisa da stack de pé para os testes de API —
eles pulam sozinhos se o Postgres estiver fora).

## Preferências do Leandro (importante)

- **Ele executa builds e subida da stack pessoalmente** — para `docker compose
  up/build/restart` de serviços, oriente o comando + resultado esperado e deixe
  ele rodar. Escrever código, rodar testes/lint/typecheck e curls de verificação
  você faz normalmente.
- Conversa em **português**; commits com mensagem em PT e co-autoria
  `Co-Authored-By: Claude ...`.
- Fluxo por fase: implementar → verificar você mesmo (testes + browser) →
  passar checklist para ele testar → **commitar só depois do ok dele** → próxima fase.
- Ele gosta de entender decisões técnicas (ex.: perguntou por que APIRouter,
  por que Alembic) — explique com contexto quando relevante.

## Pegadinhas conhecidas (aprendidas na prática)

- **Worker arq**: o `--watch` NÃO recarrega módulos importados — mudou código
  de job (`worker.py`, `judges/run.py`, `corpus/ingest.py`), peça
  `docker compose restart worker`.
- **Dependência Python nova** (`uv add`): a imagem precisa de rebuild
  (`docker compose build api worker`) — o container não tem as deps do host.
- **Dependência JS nova**: `docker compose exec web pnpm install` (ou restart
  do serviço web). pnpm 11 roda com `CI=true` + `--no-frozen-lockfile` +
  `minimumReleaseAge: 0` + `allowBuilds: esbuild` (ver `pnpm-workspace.yaml`).
- **SSE**: sse-starlette termina linhas com `\r\n` — o parser do front
  (`streamChat` em `api/client.ts`) já trata; não "simplifique" para `\n\n`.
- **Zustand**: selector que retorna array/objeto novo a cada chamada causa loop
  infinito de `getSnapshot` (tela preta) — selecione referências estáveis.
- **SQLAlchemy**: `default=uuid4` só atribui id no flush — `session.flush()`
  antes de usar `run.id`/`message.id` em objetos filhos.
- **Ghost nodes** (sugestões do Arquiteto): têm `data.ghost=true` e ficam FORA
  de `serializeCanvas()` (autosave/simulação/juiz) até o Apply materializar.
- **Simulação/Juiz/Chat** aceitam `canvas_state` no body (estado da tela pode
  estar à frente do autosave de 5s) — mantenha esse padrão em endpoints novos.
- Testes entre módulos: `tests/` não é pacote; fixtures compartilhadas vivem no
  `conftest.py` (`_state["maker"]` dá acesso ao sessionmaker do DB de teste).

## O que vem depois do MVP (pós-validação, fora de escopo agora)

Providers reais (Ollama local → gateway Iara) via `LLMClient` + reindexação do
corpus; deploy AWS (Terraform, OIDC); multi-juiz com consenso; export DOCX/PDF
e `.drawio`; chaos engineering; trilha educacional completa. Ver `../ADR/`.
