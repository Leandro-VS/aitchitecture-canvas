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
  const readRatio = form.watch("read_ratio") ?? 0.8;

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

      <fieldset className="rounded-lg border border-white/10 p-4">
        <legend className="px-2 font-mono text-xs uppercase tracking-widest text-ink/50">
          NFRs quantitativos
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="base_rps">RPS estimado</label>
            <input id="base_rps" type="number" className={field} {...form.register("base_rps")} />
            {errors.base_rps && <p className={error}>{errors.base_rps.message}</p>}
          </div>
          <div>
            <label className={label} htmlFor="p99_ms">p99 alvo (ms)</label>
            <input id="p99_ms" type="number" className={field} {...form.register("p99_ms")} />
            {errors.p99_ms && <p className={error}>{errors.p99_ms.message}</p>}
          </div>
          <div>
            <label className={label} htmlFor="availability_pct">Disponibilidade alvo (%)</label>
            <input id="availability_pct" type="number" step="0.01" className={field}
              {...form.register("availability_pct")} />
            {errors.availability_pct && <p className={error}>{errors.availability_pct.message}</p>}
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
          <div className="col-span-2">
            <label className={label} htmlFor="read_ratio">
              Read ratio — {Math.round(readRatio * 100)}% leitura
            </label>
            <input id="read_ratio" type="range" min="0" max="1" step="0.01"
              className="w-full accent-[#1458E8]" {...form.register("read_ratio")} />
          </div>
        </div>
      </fieldset>

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
