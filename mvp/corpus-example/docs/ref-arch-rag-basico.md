---
id: REF-ARCH-RAG-01
title: Arquitetura de referência — RAG básico de atendimento
doc_type: reference-architecture
domain: genai
version: "1"
effective_date: 2026-04-10
status: active
tags: [genai, rag, referencia]
---

## Visão geral

Pipeline RAG mínimo aprovado para assistentes de atendimento: Client → API Gateway →
App Server → (Semantic Cache → LLM Gateway) com Retriever consultando um Vector DB.
Guardrails de entrada e saída envolvem a chamada ao LLM quando o canal é externo
(ver SEC-012).

## Componentes obrigatórios

- **LLM Gateway**: único ponto de acesso a modelos (ver GENAI-001).
- **Semantic Cache**: na frente do LLM Gateway em fluxos de pergunta-resposta;
  taxa de hit típica de 30–40% em atendimento reduz custo e p99.
- **Vector DB**: índice dos documentos de conhecimento; atualização assíncrona
  via fila, nunca no caminho da requisição.
- **Guardrails (saída)**: obrigatório em canais externos.

## Anti-padrões

- Chamar o provedor de modelo direto do App Server (viola GENAI-001).
- Indexação síncrona de documentos no caminho da requisição do usuário.
- Ausência de cache semântico em fluxos read-heavy de perguntas repetitivas.
