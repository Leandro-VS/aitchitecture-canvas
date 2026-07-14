---
id: GENAI-001
title: Acesso a LLMs exclusivamente via gateway corporativo
doc_type: guideline
domain: genai
version: "2"
effective_date: 2026-03-15
status: active
tags: [genai, gateway, governanca]
---

## Regra

Toda chamada a modelos de linguagem DEVE passar pelo gateway corporativo de LLM.
Nenhum serviço acessa provedores de modelo diretamente; credenciais de provedor não
residem em serviços de aplicação.

## Racional

O gateway centraliza auditoria, políticas de conteúdo, telemetria de custo por
feature e controle de quotas. Chamadas diretas quebram a governança e impedem a
atribuição de custo.

## Implicações de arquitetura

Componentes de aplicação que fazem `llm_call` devem apontar para o componente
LLM Gateway no diagrama. Chamadas em lote (avaliações, indexação) devem ser
assíncronas, com circuit breaker e backoff exponencial, dada a latência mediana
de ~1,1s por chamada.
