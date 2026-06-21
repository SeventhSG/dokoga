import type { ChatResponse, RepairCollection, RepairProps, AnalyzeResponse } from "./types";

const API_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? (window.location.port === "5173" ? "http://localhost:8000" : "");

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
  sector: string;
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
  drivers?: string[];
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

export async function analyzeProject(p: RepairProps): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ocid: p.ocid, title: p.title, sector: p.sector, sector_name: p.sector_name,
      region: p.region, value: p.value ?? 0, planned_days: p.planned_days || 120,
      supplier: p.supplier ?? "", buyer: p.buyer ?? "", risk: p.risk, expected_days: p.expected_days,
    }),
  });
  if (!res.ok) throw new Error(`Сървърът върна ${res.status}`);
  return res.json();
}
