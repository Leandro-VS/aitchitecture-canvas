import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  DEFAULT_FORM_VALUES,
  intakeFormSchema,
  type IntakeFormValues,
} from "./schema";

const field =
  "w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink/30 focus:border-primary focus:outline-none";
const label = "mb-1 block font-mono text-xs uppercase tracking-widest text-ink/50";
const error = "mt-1 text-xs text-red-400";

interface Props {
  defaultValues?: Partial<IntakeFormValues>;
  submitLabel: string;
  onSubmit: (values: IntakeFormValues) => void;
  busy?: boolean;
}

export function IntakeForm({ defaultValues, submitLabel, onSubmit, busy }: Props) {
  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: { ...DEFAULT_FORM_VALUES, ...defaultValues },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className={label} htmlFor="title">Título</label>
        <input id="title" className={field} placeholder="ex.: Assistente RAG de atendimento"
          {...form.register("title")} />
        {errors.title && <p className={error}>{errors.title.message}</p>}
      </div>

      <div>
        <label className={label} htmlFor="summary">Descrição resumida</label>
        <textarea id="summary" rows={3} className={field}
          placeholder="O que é o sistema e que problema resolve (2–5 frases)"
          {...form.register("summary")} />
        {errors.summary && <p className={error}>{errors.summary.message}</p>}
      </div>

      <div>
        <label className={label} htmlFor="requirements">Requisitos funcionais (um por linha)</label>
        <textarea id="requirements" rows={4} className={field}
          placeholder={"Responder perguntas sobre a base de conhecimento\nEscalar para humano quando não souber"}
          {...form.register("requirements")} />
        {errors.requirements && <p className={error}>{errors.requirements.message}</p>}
      </div>

      <div>
        <label className={label} htmlFor="considerations">Considerações e restrições</label>
        <textarea id="considerations" rows={3} className={field}
          placeholder="Premissas, limitações, decisões já tomadas, integrações existentes"
          {...form.register("considerations")} />
        {errors.considerations && <p className={error}>{errors.considerations.message}</p>}
      </div>

      <div>
        <label className={label} htmlFor="data_classification">Classificação de dados</label>
        <select id="data_classification" className={field}
          {...form.register("data_classification")}>
          <option value="publica">Pública</option>
          <option value="interna">Interna</option>
          <option value="confidencial">Confidencial</option>
          <option value="restrita">Restrita</option>
        </select>
      </div>

      <div>
        <label className={label} htmlFor="out_of_scope">Fora de escopo (opcional)</label>
        <textarea id="out_of_scope" rows={2} className={field}
          placeholder="O que explicitamente não entra — evita sugestões de IA além do escopo"
          {...form.register("out_of_scope")} />
      </div>

      <button type="submit" disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white
                   hover:bg-primary/80 disabled:opacity-50">
        {busy ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
