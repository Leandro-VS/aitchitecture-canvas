export type TutorialId = "social-feed" | "conversational-rag" | "realtime-fraud";

export interface TutorialOption {
  id: TutorialId;
  title: string;
  diagramTitle: string;
  audience: string;
  duration: string;
  difficulty: string;
  summary: string;
  components: string[];
  scenarios: string[];
}

export const TUTORIAL_OPTIONS: TutorialOption[] = [
  {
    id: "social-feed",
    title: "Feed social sob carga",
    diagramTitle: "Tutorial — Feed social sob carga",
    audience: "Backend e sistemas distribuídos",
    duration: "25–35 min",
    difficulty: "Sênior",
    summary:
      "Evolua um feed mínimo com balanceamento, cache, fan-out assíncrono e tratamento de falhas.",
    components: ["Load Balancer", "NoSQL", "Cache", "Queue", "Worker", "DLQ"],
    scenarios: ["Carga constante", "Cache frio"],
  },
  {
    id: "conversational-rag",
    title: "Assistente Conversacional com RAG",
    diagramTitle: "Tutorial — Assistente Conversacional com RAG",
    audience: "GenAI, plataforma e segurança",
    duration: "30–40 min",
    difficulty: "Sênior",
    summary:
      "Construa um assistente com cache semântico, recuperação, memória e guardrails em camadas.",
    components: ["LLM", "Semantic Cache", "RAG", "Vector DB", "Memory", "Guardrails"],
    scenarios: ["Cache frio", "Ataque de prompt", "Pico repentino"],
  },
  {
    id: "realtime-fraud",
    title: "Antifraude de pagamentos em tempo real",
    diagramTitle: "Tutorial — Antifraude de pagamentos em tempo real",
    audience: "ML Engineering e sistemas críticos",
    duration: "25–35 min",
    difficulty: "Sênior",
    summary:
      "Modele decisão online, features, inferência, auditoria assíncrona e ciclo de atualização do modelo.",
    components: ["API Gateway", "Feature Store", "Real-time Inference", "Event Stream", "Monitoring"],
    scenarios: ["Rampa de carga", "Partição quente"],
  },
];

export const tutorialOption = (id: TutorialId) =>
  TUTORIAL_OPTIONS.find((option) => option.id === id)!;

export function parseTutorialId(value: string | null): TutorialId | null {
  if (value === "1") return "social-feed";
  return TUTORIAL_OPTIONS.some((option) => option.id === value)
    ? value as TutorialId
    : null;
}
