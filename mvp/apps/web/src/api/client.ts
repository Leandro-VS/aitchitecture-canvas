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

export interface Intake {
  summary: string;
  functional_requirements: string[];
  considerations: string;
  data_classification?: "publica" | "interna" | "confidencial" | "restrita";
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
  has_intake: boolean;
  updated_at: string;
}

export interface Diagram {
  id: string;
  title: string;
  intake: Intake | null;
  canvas_state: CanvasStatePayload;
  canvas_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const listDiagrams = () => api<DiagramSummary[]>("/api/diagrams");

export const getDiagram = (id: string) => api<Diagram>(`/api/diagrams/${id}`);

export const createDiagram = (body: { title: string; intake?: Intake }) =>
  api<Diagram>("/api/diagrams", { method: "POST", body: JSON.stringify(body) });

export const patchDiagram = (
  id: string,
  body: Partial<{ title: string; intake: Intake; canvas_state: CanvasStatePayload }>,
) => api<Diagram>(`/api/diagrams/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteDiagram = (id: string) =>
  api<void>(`/api/diagrams/${id}`, { method: "DELETE" });

// --- simulação (M5) ---

export interface SimParams {
  base_rps: number;
  traffic_multiplier: number;
  read_ratio: number;
  cache_hit_rate: number;
  p99_target_ms?: number | null;
  availability_target_pct?: number | null;
}

export interface NodeMetrics {
  rps: number;
  cpu: number;
  latency_ms: number;
  error_rate: number;
  health: "ok" | "hot" | "critical";
}

export interface AdvisorTip {
  severity: "ok" | "warning" | "critical";
  message: string;
  component_refs: string[];
}

export interface SimResult {
  total_rps: number;
  avg_latency_ms: number;
  p99_ms: number;
  error_rate: number;
  availability_pct: number;
  bottleneck: string | null;
  nodes: Record<string, NodeMetrics>;
  tips: AdvisorTip[];
  targets: { p99_ms: number | null; availability_pct: number | null };
}

export const runSimulation = (
  diagramId: string,
  params: SimParams,
  canvasState: CanvasStatePayload,
) =>
  api<SimResult>("/api/simulation/run", {
    method: "POST",
    // envia o canvas atual do editor: pode estar à frente do autosave (5s)
    body: JSON.stringify({ diagram_id: diagramId, params, canvas_state: canvasState }),
  });
