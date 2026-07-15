import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { createDiagram } from "../api/client";
import { IntakeForm } from "../intake/IntakeForm";
import { toIntakePayload } from "../intake/schema";

export function NewDiagram() {
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: createDiagram,
    onSuccess: (diagram) => navigate(`/session/${diagram.id}`),
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8">
        <Link to="/" className="font-mono text-xs text-ink/40 hover:text-primary">
          ← diagramas
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">Novo diagrama</h1>
        <p className="mt-1 text-sm text-ink/60">
          Antes do canvas, racionalize o problema — este contexto acompanha o diagrama e
          fundamenta o Arquiteto e o Juiz.
        </p>
      </header>

      <div className="rounded-xl border border-white/10 bg-panel p-6">
        <IntakeForm
          submitLabel="Criar e abrir o canvas"
          busy={create.isPending}
          onSubmit={(values) => create.mutate(toIntakePayload(values))}
        />
        {create.isError && (
          <p className="mt-3 text-sm text-red-400">Erro ao criar: {String(create.error)}</p>
        )}
      </div>
    </div>
  );
}
