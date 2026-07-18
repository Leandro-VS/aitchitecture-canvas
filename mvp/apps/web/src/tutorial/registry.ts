import type { TutorialId } from "./catalog";
import { FRAUD_TUTORIAL_STEPS } from "./fraudSteps";
import { GENAI_TUTORIAL_STEPS } from "./genaiSteps";
import { TUTORIAL_STEPS } from "./steps";

export const TUTORIAL_DEFINITIONS = {
  "social-feed": { version: 4, steps: TUTORIAL_STEPS },
  "conversational-rag": { version: 4, steps: GENAI_TUTORIAL_STEPS },
  "realtime-fraud": { version: 1, steps: FRAUD_TUTORIAL_STEPS },
} satisfies Record<TutorialId, { version: number; steps: typeof TUTORIAL_STEPS }>;
