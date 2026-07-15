import { z } from "zod";

import type { Intake } from "../api/client";

/** Espelha as validações do Pydantic (blueprint/schemas/intake.py) — US1: raso não passa. */
export const intakeFormSchema = z.object({
  title: z.string().min(3, "mínimo 3 caracteres").max(200),
  summary: z
    .string()
    .min(40, "mínimo 40 caracteres — descreva o que é o sistema e que problema resolve"),
  requirements: z
    .string()
    .refine(
      (s) => s.split("\n").some((l) => l.trim().length >= 5),
      "liste ao menos um requisito (um por linha)",
    ),
  considerations: z
    .string()
    .min(20, "mínimo 20 caracteres — premissas, restrições, decisões já tomadas"),
  base_rps: z.coerce.number().int().positive("informe o RPS estimado"),
  p99_ms: z.coerce.number().int().positive("informe o p99 alvo em ms"),
  availability_pct: z.coerce.number().min(90, "mínimo 90%").max(100),
  read_ratio: z.coerce.number().min(0).max(1),
  data_classification: z.enum(["publica", "interna", "confidencial", "restrita"]),
  out_of_scope: z.string().optional(),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

export function toIntakePayload(v: IntakeFormValues): { title: string; intake: Intake } {
  return {
    title: v.title,
    intake: {
      summary: v.summary,
      functional_requirements: v.requirements
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      considerations: v.considerations,
      nfr: {
        base_rps: v.base_rps,
        p99_ms: v.p99_ms,
        availability_pct: v.availability_pct,
        read_ratio: v.read_ratio,
        data_classification: v.data_classification,
      },
      out_of_scope: v.out_of_scope?.trim() ? v.out_of_scope : null,
    },
  };
}

export function toFormValues(title: string, intake: Intake): IntakeFormValues {
  return {
    title,
    summary: intake.summary,
    requirements: intake.functional_requirements.join("\n"),
    considerations: intake.considerations,
    base_rps: intake.nfr.base_rps,
    p99_ms: intake.nfr.p99_ms,
    availability_pct: intake.nfr.availability_pct,
    read_ratio: intake.nfr.read_ratio,
    data_classification: intake.nfr.data_classification,
    out_of_scope: intake.out_of_scope ?? "",
  };
}

export const DEFAULT_FORM_VALUES: Partial<IntakeFormValues> = {
  availability_pct: 99.9,
  read_ratio: 0.8,
  data_classification: "interna",
};
