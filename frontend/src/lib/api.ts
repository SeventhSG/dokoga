import type { ChatResponse, RepairCollection } from "./types";

const API_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "http://localhost:8000";

export async function loadRepairs(): Promise<RepairCollection> {
  const res = await fetch("/projects.geojson");
  if (!res.ok) throw new Error("Данните за ремонтите не се заредиха.");
  return res.json();
}

export async function askDokoga(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Сървърът върна ${res.status}`);
  return res.json();
}

export interface PredictInput {
  category: string;
  value: number;
  region: string;
  month: number;
  planned_days: number;
  n_tenderers: number;
  is_repair: number;
}
export interface PredictResult {
  risk: number;
  level: "low" | "med" | "high";
  expected_days: number;
  error?: string;
}
export async function predictRepair(body: PredictInput): Promise<PredictResult> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Сървърът върна ${res.status}`);
  return res.json();
}
