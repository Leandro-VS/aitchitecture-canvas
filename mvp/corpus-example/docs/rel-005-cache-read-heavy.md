---
id: REL-005
title: Cache em caminhos de leitura intensiva
doc_type: guideline
domain: infra
version: "2"
effective_date: 2026-02-10
status: active
tags: [confiabilidade, cache, escala, read-heavy]
---

## Regra

Caminhos de requisição com perfil de leitura dominante (acima de ~70% de
leituras) DEVEM ter uma camada de cache antes do armazenamento primário.
Leituras repetitivas não devem atingir o banco no caminho crítico.

## Racional

Armazenamentos primários (SQL ou NoSQL) têm capacidade de leitura ordens de
magnitude menor que caches em memória. Em sistemas read-heavy — feeds,
catálogos, redirecionadores, timelines — o banco satura primeiro e vira o
gargalo de p99. Um cache com taxa de hit típica de 80–95% remove a maior parte
da carga e protege o banco contra picos.

## Dimensionamento

A estratégia de invalidação (TTL curto, invalidação por evento ou write-through)
deve ser explícita no desenho. Valide a taxa de hit esperada em simulação:
caminhos com hit abaixo de 50% indicam chave de cache mal escolhida.

## Exceções

Fluxos com exigência de leitura fortemente consistente (saldo, estoque
transacional) podem dispensar cache mediante registro da decisão no ADR.
