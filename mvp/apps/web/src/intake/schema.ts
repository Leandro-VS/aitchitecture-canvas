import { z } from "zod";

import type { Intake } from "../api/client";

/** Espelha as validações do Pydantic (blueprint/schemas/intake.py).
 *  Contexto qualitativo apenas — NFRs quantitativos vivem no painel de simulação. */
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
  data_classification: z.enum(["publica", "interna", "confidencial", "restrita"]),
  out_of_scope: z.string().optional(),
});

/** O rascunho é persistível a qualquer momento. A validação completa continua
 *  sendo aplicada somente antes de chamar os recursos de IA. */
export const intakeDraftFormSchema = z.object({
  title: z.string().min(3, "mínimo 3 caracteres").max(200),
  summary: z.string(),
  requirements: z.string(),
  considerations: z.string(),
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
      data_classification: v.data_classification,
      out_of_scope: v.out_of_scope?.trim() ? v.out_of_scope : null,
    },
  };
}

export function toIntakeDraftPayload(v: IntakeFormValues): { title: string; intake: Intake } {
  return {
    title: v.title,
    intake: {
      summary: v.summary.trim() || null,
      functional_requirements: v.requirements
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      considerations: v.considerations.trim() || null,
      data_classification: v.data_classification,
      out_of_scope: v.out_of_scope?.trim() || null,
    },
  };
}

export function isIntakeComplete(intake: Intake | null): boolean {
  return Boolean(
    intake?.summary &&
      intake.summary.length >= 40 &&
      intake.considerations &&
      intake.considerations.length >= 20 &&
      intake.functional_requirements?.some((requirement) => requirement.trim().length >= 5) &&
      intake.data_classification,
  );
}

export function toFormValues(
  title: string,
  intake: Intake | null,
): IntakeFormValues | Partial<IntakeFormValues> {
  if (!intake) return { ...DEFAULT_FORM_VALUES, title };
  return {
    title,
    summary: intake.summary ?? "",
    requirements: (intake.functional_requirements ?? []).join("\n"),
    considerations: intake.considerations ?? "",
    data_classification: intake.data_classification ?? "interna",
    out_of_scope: intake.out_of_scope ?? "",
  };
}

export const DEFAULT_FORM_VALUES: Partial<IntakeFormValues> = {
  data_classification: "interna",
};
