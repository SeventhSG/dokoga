// Integrity layer API client — talks to the FastAPI /integrity/* endpoints.
const API_BASE =
  (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ??
  (window.location.port === "5173" ? "http://localhost:8000" : "");

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Сървърът върна ${res.status}`);
  return res.json();
}

export interface Kpis {
  contracts: number; value_eur: number; organizations: number; buyers: number;
  suppliers: number; flags: number; high: number; single_bid_pct: number;
}
export interface MlMetrics { roc_auc: number; pr_auc: number; base_rate: number; label: string; }
export interface Summary { kpis: Kpis; flags_summary: Record<string, number>; ml: MlMetrics | null; }
export interface Region {
  region_name: string; contracts: number; value_eur: number; high: number;
  single_bid_pct: number; risk_index: number; high_pct: number; avg_risk: number;
}
export interface Case {
  id: string; supplier: string | null; buyer: string | null; obshtina: string | null;
  amount_eur: number | null; cpv: string | null; blended: number;
  level: "low" | "med" | "high"; codes: string[]; reasons: string[];
}
export interface Company {
  eik: string; name: string; contracts: number; won_eur: number; buyers: number;
  single_bid_pct: number; flags: number;
}
export interface Buyer {
  eik: string; name: string; contracts: number; spend_eur: number; suppliers: number;
  single_bid_pct: number; top_supplier_share: number; region: string | null;
}
export interface Sector { cpv_division: string; contracts: number; value_eur: number; single_bid_pct: number; }
export interface TopRisk {
  id: string; supplier: string | null; buyer: string | null; amount_eur: number | null;
  cpv: string | null; blended: number; codes: string[];
}
export interface NetworkLink {
  person: string; id_type: string; count: number; won_eur: number; flags: number;
  companies: { eik: string; name: string | null }[];
}
export interface Explain {
  bundle: Record<string, unknown> | null; narrative: string | null; error?: string;
}

export const getSummary = () => getJSON<Summary>("/integrity/summary");
export const getRegions = () => getJSON<{ regions: Region[]; coverage_pct: number }>("/integrity/regions");
export const getCompanies = () => getJSON<{ companies: Company[] }>("/integrity/companies");
export const getBuyers = () => getJSON<{ buyers: Buyer[] }>("/integrity/buyers");
export const getSectors = () => getJSON<{ sectors: Sector[] }>("/integrity/sectors");
export const getTopRisk = () => getJSON<{ top_risk: TopRisk[] }>("/integrity/top-risk");
export const getNetwork = () => getJSON<{ network: NetworkLink[] }>("/integrity/network");
export const getCases = () => getJSON<{ cases: Case[] }>("/integrity/cases");

export async function explain(target: string): Promise<Explain> {
  const res = await fetch(`${API_BASE}/integrity/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error(`Сървърът върна ${res.status}`);
  return res.json();
}

export const fmtEur = (n: number | null | undefined) =>
  n == null ? "—" : "€" + new Intl.NumberFormat("bg-BG").format(Math.round(n));
export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("bg-BG").format(n);
export const levelOf = (s: number): "low" | "med" | "high" => (s >= 0.66 ? "high" : s >= 0.33 ? "med" : "low");
