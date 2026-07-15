export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Archetype {
  archetype: string;
  archetype_class: string;
  label: string;
  category: string;
  base_rps: number | null;
  base_latency_ms: number;
  params: Record<string, unknown>;
}

export interface NFR {
  base_rps: number;
  p99_ms: number;
  availability_pct: number;
  read_ratio: number;
  data_classification: "publica" | "interna" | "confidencial" | "restrita";
}

export interface Intake {
  summary: string;
  functional_requirements: string[];
  considerations: string;
  nfr: NFR;
  out_of_scope?: string | null;
  inferred_fields?: string[];
}

export interface CanvasStatePayload {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number } | null;
}

export interface DiagramSummary {
  id: string;
  title: string;
  status: string;
  node_count: number;
  updated_at: string;
}

export interface Diagram {
  id: string;
  title: string;
  intake: Intake;
  canvas_state: CanvasStatePayload;
  canvas_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const listDiagrams = () => api<DiagramSummary[]>("/api/diagrams");

export const getDiagram = (id: string) => api<Diagram>(`/api/diagrams/${id}`);

export const createDiagram = (body: { title: string; intake: Intake }) =>
  api<Diagram>("/api/diagrams", { method: "POST", body: JSON.stringify(body) });

export const patchDiagram = (
  id: string,
  body: Partial<{ title: string; intake: Intake; canvas_state: CanvasStatePayload }>,
) => api<Diagram>(`/api/diagrams/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteDiagram = (id: string) =>
  api<void>(`/api/diagrams/${id}`, { method: "DELETE" });
