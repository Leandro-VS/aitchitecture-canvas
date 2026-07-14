---
id: SEC-012
title: Guardrails de saída em canais externos
doc_type: guideline
domain: security
version: "3"
effective_date: 2026-05-01
status: active
tags: [genai, guardrails, canais-externos]
---

## Regra

Todo fluxo em que a resposta de um LLM alcança um usuário externo DEVE passar por um
componente de guardrail de saída antes da entrega. O guardrail inspeciona a resposta
contra as políticas de conteúdo e de vazamento de dados internos.

## Racional

Respostas não inspecionadas podem vazar dados internos, expor prompts de sistema ou
entregar conteúdo fora de política. O custo do guardrail (latência adicional na casa
de dezenas de milissegundos) é ordens de magnitude menor que o custo de um incidente.

## Exceções

Fluxos internos de engenharia com dados de classificação "pública" podem operar sem
guardrail de saída, desde que registrados como exceção com aprovação do time de
segurança e revisão semestral.
