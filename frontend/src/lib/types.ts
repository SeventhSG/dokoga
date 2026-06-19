export interface RepairProps {
  ocid: string;
  title: string;
  value: number | null;
  region: string;
  locality: string | null;
  buyer: string | null;
  supplier: string | null;
  risk: number;
  expected_days: number;
  overrun_days: number;
  is_repair: number;
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

export interface ChatResponse {
  answer: string;
  tool?: string;
  arg?: string;
  data?: unknown;
  error?: string;
}
