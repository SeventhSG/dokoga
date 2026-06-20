export interface RepairProps {
  ocid: string;
  title: string;
  value: number | null;
  region: string;
  locality: string | null;
  buyer: string | null;
  supplier: string | null;
  sector: string;
  sector_name: string;
  planned_days: number;
  risk: number;
  expected_days: number;
  overrun_days: number;
  is_repair: number;
  // --- активни обществени поръчки (от ЦАИС ЕОП), по избор ---
  is_active?: number;
  regnum?: string;
  deadline?: string | null;
  deadline_raw?: string | null;
  procedure?: string | null;
  object_type?: string | null;
  n_documents?: number;
  documents?: { filename: string | null; url: string | null }[];
  value_currency?: string | null;
  eop_url?: string | null;
  risk_basis?: string | null;
}

export interface AnalyzeResponse {
  analysis: string;
  drivers: string[];
  region_stats?: { found?: boolean; дял_просрочка?: number; договори?: number };
  contractor_stats?: { found?: boolean };
}

export interface RepairFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: RepairProps;
}

export interface RepairCollection {
  type: "FeatureCollection";
  features: RepairFeature[];
}

export interface ChatFocus {
  ocid?: string | null;
  region?: string | null;
}

export interface ChatResponse {
  answer: string;
  tool?: string;
  arg?: string;
  data?: unknown;
  focus?: ChatFocus | null;
  error?: string;
}
