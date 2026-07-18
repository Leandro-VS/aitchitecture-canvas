# Avaliação manual de modelos (Ollama) — Ask AI e Juiz

Kit para comparar como diferentes modelos se sairiam nas duas funções de IA da
plataforma. Cada `.json` é um request **pronto** para a API de chat do Ollama,
montado com os **prompts reais da aplicação** (mesmo system prompt, mesma
serialização canônica do diagrama, mesmos trechos de guidelines que o retrieval
devolveria).

## Como rodar

```bash
# troque o modelo dentro do arquivo ("model": "...") ou via jq:
curl -s http://localhost:11434/api/chat -d @askai-1-fanout.json | jq -r '.message.content'

# para testar outro modelo sem editar o arquivo:
jq '.model = "llama3.1:8b"' askai-1-fanout.json | curl -s http://localhost:11434/api/chat -d @- | jq -r '.message.content'
```

Todos os payloads usam `temperature: 0` (comparação justa entre modelos) e
`format` com o JSON Schema que a aplicação valida — o Ollama força a saída no
schema (structured output), igual ao que o `parse_with_retry` exige em produção.

**Fidelidade:** os prompts de sistema e as mensagens de contexto são cópia fiel
de `routers/architect.py` e `judges/run.py`. Duas adaptações do harness manual,
marcadas nos payloads: (1) no Ask AI, o envelope `{content, proposed_diff}` é
instruído via prompt + `format` (na aplicação real virá de tool use); (2) a
lista de arquétipos/intents válidos foi incluída no prompt do Ask AI — a
aplicação hoje valida isso só no backend (gap conhecido: com modelo real, vale
promover a lista para o prompt de produção também).

---

## Ask AI (Arquiteto)

### 1. `askai-1-fanout.json` — feed do Twitter, escala de escrita

**Cenário:** feed com leitura já resolvida (cache de timelines presente),
pergunta: *"Como escalo a escrita de tweets para milhões de seguidores?"*.
Guidelines no contexto incluem REL-007 (filas/fan-out) e ruído proposital
(GENAI-001, irrelevante aqui).

**Resposta aproximada esperada:**

```json
{
  "content": "…fan-out síncrono acopla a latência do post ao número de seguidores… o padrão é fan-out on write via fila (REL-007 > Regra): o post publica na fila e retorna; workers materializam as timelines nos shards… custo: consistência eventual, aceitável para feed (como o comentário do diagrama já registra)…",
  "proposed_diff": {
    "rationale": "Fan-out on write assíncrono desacopla a latência do post do número de seguidores.",
    "citations": [{"doc_id": "REL-007", "section": "Regra", "excerpt": "…"}],
    "ops": [
      {"op": "add_node", "id": "novo-1", "archetype": "message-queue", "name": "Fila de fan-out"},
      {"op": "add_node", "id": "novo-2", "archetype": "worker", "name": "Fan-out worker"},
      {"op": "connect", "source": "archetype:app-server", "target": "novo-1", "intent": "async_message"},
      {"op": "connect", "source": "novo-1", "target": "novo-2", "intent": "async_message"},
      {"op": "connect", "source": "novo-2", "target": "n-db", "intent": "request"}
    ]
  }
}
```

**O que avaliar:** propôs fila+worker (não outra coisa)? citou REL-007 e **não**
citou GENAI-001 (ruído)? intents `async_message` corretos? refs resolvíveis
(id existente, nome exato ou `archetype:`)? aproveitou o comentário sobre
consistência eventual? DLQ mencionada é bônus (REL-007 > Requisitos).

### 2. `askai-2-guardrails.json` — RAG externo, proteger a saída do LLM

**Cenário:** assistente RAG para clientes externos, dados confidenciais, **sem
guardrails** no desenho. Pergunta: *"Como protejo as respostas do LLM antes de
chegarem ao cliente?"*.

**Resposta aproximada esperada:** content citando **SEC-012 > Regra**
(obrigatório em canal externo) e possivelmente REF-ARCH-RAG-01; diff com
`add_node guardrails` + `connect archetype:llm-gateway → guardrails` com intent
`validation`. Bônus: reconhecer o que **já existe** (Semantic Cache, LLM
Gateway) e não recomendar de novo.

**O que avaliar:** citação exata SEC-012 > Regra? intent `validation` (não
inventou `guardrail_check`, que é legado)? não sugeriu componentes que já estão
no diagrama? content conciso e em PT?

### 3. `askai-3-microsservicos.json` — pergunta sem guideline aplicável

**Cenário:** checkout monolítico estável, time de 4 devs, pergunta opinativa:
*"Vale a pena quebrar o checkout em microsserviços agora?"*. Nenhum guideline
do contexto trata de microsserviços — só ruído plausível (REL-005/REL-007).

**Resposta aproximada esperada:** análise ponderada (provavelmente "não agora":
time pequeno, monólito estável, custo operacional) **sem citação** — ou
declarando explicitamente que não há guideline aplicável — e
`"proposed_diff": null`.

**O que avaliar (o teste mais revelador):** resistiu a citar guideline
irrelevante só porque estava no contexto? resistiu a propor um diff gratuito?
considerou os fatos do intake (time de 4, ERP por fila)? Modelos fracos
alucinam citação e diff aqui.

---

## Juiz

### 1. `judge-1-encurtador.json` — read-heavy sem cache, gargalo simulado

**Cenário:** encurtador com Cliente → Redirector → SQL, 90% leitura, simulação
mostrando o banco a 200% (erro 50%, disponibilidade 50%, gargalo declarado).

**Resposta aproximada esperada:**

```json
{
  "score": 45–60, "verdict": "fail" (ou borderline),
  "strengths": ["fluxo explícito…", "comentário documenta o mapeamento…"],
  "findings": [
    {"severity": "critical", "basis": "guideline",
     "citation": {"doc_id": "REL-005", "section": "Regra"},
     "component_refs": ["n-db"],
     "recommendation": "adicionar cache no caminho de leitura… a simulação mostra o banco a 200%…"},
    {"severity": "warning", "basis": "general", "citation": null,
     "component_refs": ["n-db"], "recommendation": "réplica única = ponto único de falha…"}
  ]
}
```

**O que avaliar:** usou a **simulação** como evidência? citou REL-005 (e **não**
SEC-012/GENAI-001, que estão no contexto como ruído — não há LLM no desenho)?
`basis`/`citation` coerentes (geral ⇒ citation null)? score condizente com um
sistema caindo pela metade?

### 2. `judge-2-rag-sem-guardrails.json` — segurança GenAI

**Cenário:** o RAG externo confidencial do askai-2, sem guardrails.

**Resposta aproximada esperada:** finding **critical** citando SEC-012 > Regra
(refs no LLM Gateway/fluxo de saída); strengths reconhecendo o que está certo
(gateway único conforme GENAI-001, semantic cache conforme REF-ARCH); score
~55–70, verdict borderline/fail (canal externo + confidencial sem guardrail é
grave).

**O que avaliar:** o modelo **leu o diagrama** ou só repetiu guidelines? (erro
clássico: recomendar "use um LLM Gateway" quando ele já existe — desconto
grande); severidade calibrada (guardrail ausente em canal externo = critical,
não info).

### 3. `judge-3-feed-maduro.json` — arquitetura saudável (não inventar problema)

**Cenário:** feed completo e bem resolvido: cache com TTL, fila de fan-out com
DLQ e retry documentado, réplicas em tudo, simulação verde (p99 88ms, erro 0%).

**Resposta aproximada esperada:** score 80–95, verdict **pass**, strengths
citando cache (REL-005 atendido) e fan-out por fila com DLQ (REL-007 atendido);
poucos findings, no máximo `info`/`warning` legítimos (ex.: validar taxa de hit
em produção, dimensionar consumidores — REL-005 > Dimensionamento / REL-007 >
Requisitos) e nenhum critical.

**O que avaliar:** o teste de honestidade — modelos ruins inventam problema
grave para "parecer úteis" ou dão fail num sistema saudável. Também: JSON
válido no schema, sem campos extras, sem findings duplicados.

---

## Checklist transversal (vale para as 6 respostas)

| Critério | O que olhar |
|---|---|
| JSON válido no schema | é o mínimo — falhou aqui, o modelo é inviável para a função |
| Disciplina D15 | `basis=guideline` ⇒ citação real do contexto; `basis=general` ⇒ citation null; nunca doc/seção inventados |
| Resistência a ruído | os payloads incluem guidelines irrelevantes de propósito — citar ruído é falha |
| Leitura do diagrama | refere-se aos componentes pelo nome/id certos; não recomenda o que já existe |
| Uso da simulação | trata métricas (gargalo, erro, p99) como evidência, não decoração |
| Refs resolvíveis | `component_refs`/`source`/`target` por id, nome exato ou `archetype:slug` |
| Intents corretos | só os 6 válidos (`async_message`, não `async_enqueue`) |
| Português | resposta natural em PT-BR (alguns modelos pequenos derrapam para EN) |

Sugestão de planilha: linhas = modelo, colunas = 6 casos × (schema ok / citação ok /
leitura do diagrama / qualidade da recomendação, 0–2 pontos cada).
