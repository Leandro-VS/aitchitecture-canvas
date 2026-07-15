import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createDiagram } from "../api/client";

export function NewDiagram() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: () => createDiagram({ title: title.trim() }),
    onSuccess: (diagram) => navigate(`/session/${diagram.id}`),
  });
  const valid = title.trim().length >= 3;

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <Link to="/" className="font-mono text-xs text-ink/40 hover:text-primary">
        ← diagramas
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold">Novo diagrama</h1>

      <form
        className="mt-6 rounded-xl border border-white/10 bg-panel p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <label
          htmlFor="title"
          className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink/50"
        >
          Título
        </label>
        <input
          id="title"
          autoFocus
          className="w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-ink
                     placeholder:text-ink/30 focus:border-primary focus:outline-none"
          placeholder="ex.: Assistente RAG de atendimento"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {title.length > 0 && !valid && (
          <p className="mt-1 text-xs text-red-400">mínimo 3 caracteres</p>
        )}

        <button
          type="submit"
          disabled={!valid || create.isPending}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white
                     hover:bg-primary/80 disabled:opacity-50"
        >
          {create.isPending ? "Criando…" : "Criar e abrir o canvas"}
        </button>
        {create.isError && (
          <p className="mt-3 text-sm text-red-400">Erro ao criar: {String(create.error)}</p>
        )}
      </form>

      <p className="mt-4 text-xs leading-relaxed text-ink/50">
        Você pode desenhar e simular à vontade sem preencher mais nada. O{" "}
        <span className="text-ink/80">contexto</span> (descrição, requisitos, NFRs) fica no
        botão "Contexto" da sessão — e é <span className="text-ink/80">obrigatório para os
        recursos de IA</span> (Arquiteto, Juiz e bootstrap).
      </p>
    </div>
  );
}
