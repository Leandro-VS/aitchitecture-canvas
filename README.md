# AIrchitecture

Canvas de arquitetura com IA dedicada na mesma tela — implementação do MVP
(specs em `../ADR/` e `../Implementação/` do diretório pai).

## MVP (`mvp/`)

100% local e 100% mock: nenhuma chamada real de LLM — Juiz, Arquiteto, bootstrap e
tutorial respondem com fixtures determinísticas nos schemas de produção
(`LLM_PROVIDER=mock`). Providers reais (Ollama/Iara) entram depois pela mesma
interface `LLMClient`.

### Subir

```bash
cd mvp
make up      # docker compose up --build (postgres+pgvector, redis, minio, api, worker, web)
make seed    # migrations (alembic) + arquétipos + usuário dev
open http://localhost:5173
```

Serviços: web `:5173` · api `:8000` (`/docs` para OpenAPI) · MinIO console `:9001`
(user `blueprint` / senha `blueprint123`).

### Comandos do dia a dia

```bash
make logs                     # logs de api + worker
make test                     # pytest + vitest
make types                    # schemas Pydantic → tipos TS (contrato único)
make revision m="mensagem"    # nova migration autogenerate
```

### Fases

- [x] **Fase 0 — Fundação**: compose, FastAPI + Alembic, LLMClient mock, auth stub, web shell
- [x] **Fase 1 — Intake + diagramas + canvas** (US1)
- [x] **Fase 2 — Metadados, comentários, simulador** (US2/US3)
- [x] **Fase 3 — Corpus + busca** (M6)
- [ ] **Fase 4 — Juiz único** (US5)
- [ ] **Fase 5 — Arquiteto + bootstrap** (US4)
- [ ] **Fase 6 — Export MD + tutorial** (US6/US8)
