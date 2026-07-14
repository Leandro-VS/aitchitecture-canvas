export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
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
