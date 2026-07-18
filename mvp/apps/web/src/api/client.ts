export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`${status}: ${detail}`);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b.detail ?? JSON.stringify(b))
      .catch(() => res.statusText);
    throw new ApiError(res.status, String(detail));
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
  description: string;
  category: string;
  base_rps: number | null;
  base_latency_ms: number;
  params: Record<string, unknown>;
}

export interface Intake {
  summary?: string | null;
  functional_requirements?: string[];
  considerations?: string | null;
  data_classification?: "publica" | "interna" | "confidencial" | "restrita" | null;
  out_of_scope?: string | null;
  inferred_fields?: string[];
}

export interface CanvasStatePayload {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number } | null;
  simulation_params?: SimParams | null;
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

// --- arquiteto / Ask AIrchitect (M8) + bootstrap (M13) ---

export interface DiffOpAddNode {
  op: "add_node";
  id: string;
  archetype: string;
  name: string;
  subtitle?: string | null;
}
export interface DiffOpConnect {
  op: "connect";
  source: string;
  target: string;
  intent: string;
}
export interface DiffOpUpdate {
  op: "update_metadata";
  id: string;
  fields: Record<string, unknown>;
}
export interface DiffOpRemove {
  op: "remove_node";
  id: string;
}
export type DiffOp = DiffOpAddNode | DiffOpConnect | DiffOpUpdate | DiffOpRemove;

export interface ProposedDiff {
  rationale: string;
  citations: JudgeCitation[];
  ops: DiffOp[];
}

export interface ArchitectMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposed_diff: ProposedDiff | null;
  diff_status: "proposed" | "applied" | "dismissed" | null;
  created_at: string;
}

export const getArchitectMessages = (diagramId: string) =>
  api<ArchitectMessage[]>(`/api/architect/messages?diagram_id=${diagramId}`);

export const applyDiff = (messageId: string) =>
  api<ArchitectMessage>(`/api/architect/diffs/${messageId}/apply`, { method: "POST" });

export const dismissDiff = (messageId: string) =>
  api<ArchitectMessage>(`/api/architect/diffs/${messageId}/dismiss`, { method: "POST" });

export const bootstrapPrefill = (text: string) =>
  api<Intake>("/api/architect/bootstrap/prefill", {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const bootstrapSketch = (diagramId: string) =>
  api<ProposedDiff>("/api/architect/bootstrap/sketch", {
    method: "POST",
    body: JSON.stringify({ diagram_id: diagramId }),
  });

export interface ChatHandlers {
  onToken: (token: string) => void;
  onProposedDiff: (diff: ProposedDiff & { message_id: string }) => void;
  onDone: (messageId: string) => void;
}

/** POST + ReadableStream (EventSource nativo só faz GET). */
export async function streamChat(
  diagramId: string,
  message: string,
  canvasState: CanvasStatePayload,
  handlers: ChatHandlers,
): Promise<void> {
  const res = await fetch("/api/architect/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagram_id: diagramId, message, canvas_state: canvasState }),
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b.detail ?? JSON.stringify(b))
      .catch(() => res.statusText);
    throw new ApiError(res.status, String(detail));
  }

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const handleBlock = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).replace(/^ /, "");
    }
    if (event === "token") handlers.onToken(data);
    else if (event === "proposed_diff") handlers.onProposedDiff(JSON.parse(data));
    else if (event === "done") handlers.onDone(JSON.parse(data).message_id);
  };
  // blocos SSE separados por linha em branco — sse-starlette usa \r\n
  const separator = /\r?\n\r?\n/;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let match;
    while ((match = separator.exec(buffer)) !== null) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      separator.lastIndex = 0;
      if (block.trim()) handleBlock(block);
    }
  }
}

// --- export pré-ADR (M9) ---

export interface AdrSections {
  context: string;
  decision: string;
  consequences: string;
}

export interface ExportOut {
  id: string;
  format: string;
  md_url: string;
  png_url: string | null;
  created_at: string;
}

export const exportDraft = (diagramId: string, canvasState: CanvasStatePayload) =>
  api<AdrSections>("/api/exports/draft", {
    method: "POST",
    body: JSON.stringify({ diagram_id: diagramId, canvas_state: canvasState }),
  });

export const previewExport = (
  diagramId: string,
  sections: AdrSections,
  canvasState: CanvasStatePayload,
) =>
  api<{ markdown: string }>("/api/exports/preview", {
    method: "POST",
    body: JSON.stringify({ diagram_id: diagramId, sections, canvas_state: canvasState }),
  });

export const createExport = (
  diagramId: string,
  sections: AdrSections,
  pngDataUrl: string | null,
  canvasState: CanvasStatePayload,
) =>
  api<ExportOut>("/api/exports", {
    method: "POST",
    body: JSON.stringify({
      diagram_id: diagramId,
      sections,
      png_data_url: pngDataUrl,
      canvas_state: canvasState,
    }),
  });

// --- simulação (M5) ---

export interface SimParams {
  base_rps: number;
  traffic_multiplier: number;
  read_ratio: number;
  cache_hit_rate: number;
  scenario: "steady" | "spike" | "ramp" | "hot_partition" | "cold_cache" | "prompt_attack";
  capacity_profile: "conservative" | "nominal" | "optimistic";
  p99_target_ms?: number | null;
  availability_target_pct?: number | null;
}

export interface NodeMetrics {
  rps: number;
  work_units: number;
  capacity_rps: number | null;
  cpu: number;
  latency_ms: number;
  error_rate: number;
  health: "ok" | "hot" | "critical";
  status: "steady" | "scaling" | "backlogged" | "throttled";
  profile: string;
  size: "small" | "medium" | "large";
  scaling: "fixed" | "elastic";
  active_units: number;
  max_units: number;
  backlog_messages: number;
  scaling_events: number;
  attack_rps: number;
  blocked_rps: number;
  uninspected_rps: number;
}

export interface SimulationTimelinePoint {
  second: number;
  input_rps: number;
  p99_ms: number;
  error_rate: number;
  backlog_messages: number;
  bottleneck: string | null;
}

export interface ScalingEvent {
  node_id: string;
  second: number;
  from_units: number;
  to_units: number;
}

export interface AdvisorTip {
  severity: "ok" | "warning" | "critical";
  message: string;
  component_refs: string[];
}

export interface SimResult {
  total_rps: number;
  peak_rps: number;
  duration_seconds: number;
  scenario: SimParams["scenario"];
  capacity_profile: SimParams["capacity_profile"];
  avg_latency_ms: number;
  p99_ms: number;
  error_rate: number;
  availability_pct: number;
  max_backlog_messages: number;
  bottleneck: string | null;
  nodes: Record<string, NodeMetrics>;
  timeline: SimulationTimelinePoint[];
  scaling_events: ScalingEvent[];
  tips: AdvisorTip[];
  targets: { p99_ms: number | null; availability_pct: number | null };
}

// --- juiz (M7) ---

export interface JudgeCitation {
  doc_id: string;
  section: string;
  excerpt: string;
}

export interface JudgeFinding {
  id: string;
  severity: "critical" | "warning" | "info";
  basis: "guideline" | "general";
  citation: JudgeCitation | null;
  component_refs: string[];
  recommendation: string;
  feedback: "up" | "down" | null;
  resolved_at: string | null;
}

export interface JudgeRun {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  cached: boolean;
  score: number | null;
  verdict: "pass" | "borderline" | "fail" | null;
  strengths: string[];
  findings: JudgeFinding[];
  error: string | null;
  created_at: string;
}

export const runJudge = (diagramId: string, canvasState: CanvasStatePayload) =>
  api<JudgeRun>("/api/judges/run", {
    method: "POST",
    body: JSON.stringify({ diagram_id: diagramId, canvas_state: canvasState }),
  });

export const getJudgeRun = (runId: string) => api<JudgeRun>(`/api/judges/runs/${runId}`);

export const getLatestJudgeRun = (diagramId: string) =>
  api<JudgeRun | null>(`/api/judges/latest?diagram_id=${diagramId}`);

export const patchFinding = (
  findingId: string,
  body: { feedback?: "up" | "down"; clear_feedback?: boolean; resolved?: boolean },
) => api<JudgeFinding>(`/api/findings/${findingId}`, { method: "PATCH", body: JSON.stringify(body) });

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
