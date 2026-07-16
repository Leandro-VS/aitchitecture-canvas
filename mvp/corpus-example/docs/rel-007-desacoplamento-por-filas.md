---
id: REL-007
title: Desacoplamento de escritas com fan-out por filas
doc_type: guideline
domain: infra
version: "1"
effective_date: 2026-03-02
status: active
tags: [confiabilidade, filas, fan-out, consistencia-eventual]
---

## Regra

Operações de escrita que se propagam para múltiplos destinos (fan-out — ex.:
atualizar as timelines de milhares de seguidores, notificar N consumidores)
NÃO DEVEM ser executadas de forma síncrona na requisição do usuário. A
requisição publica em uma fila ou stream e retorna; workers materializam o
fan-out de forma assíncrona.

## Racional

Fan-out síncrono acopla a latência do usuário ao número de destinos e derruba
a disponibilidade em picos. A fila absorve rajadas, dá retry com dead-letter e
permite escalar os workers independentemente do caminho de leitura. O custo é
consistência eventual — os destinos convergem em segundos, o que é aceitável
para feeds, notificações e projeções.

## Requisitos do desenho

A fila deve aparecer explicitamente no diagrama, com o produtor publicando de
forma assíncrona e os consumidores dimensionados pela vazão de escrita ×
fan-out médio. Defina política de retry e o comportamento em caso de mensagem
envenenada (dead-letter).
